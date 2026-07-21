// Enriquece o AST resolvendo, para cada alimento, os GRAMAS e os macros.
//
// IA OFICIAL: a interpretação passa pela edge function "resolve-plan-foods"
// (OpenAI/gpt-4o), que lê cada alimento EXATAMENTE como escrito e devolve
// gramas + kcal/macros. Isso corrige os erros de correspondência do banco que
// inflavam calorias (ex.: "café sem açúcar" casando com café em pó torrado,
// "leite" casando com leite condensado). Os totais por dia continuam sendo o
// SOMATÓRIO calculado (opção principal de cada refeição), agora com valores
// corretos por alimento.
//
// Fallback: se a IA não estiver disponível/à falhar por item, cai no
// casamento local com food_items/food_measures (comportamento anterior).

import { supabase } from '@/integrations/supabase/client';
import { calcNutrients, type FoodItem, type FoodMeasure } from '@/hooks/useFoodSearch';
import type { PlanAst, FoodToken } from './ast';
import { mealsToAst } from './fromMeals';
import { tokenToText } from './serialize';

const STOP = new Set([
  'de', 'da', 'do', 'com', 'sem', 'e', 'ou', 'a', 'o', 'as', 'os', 'em',
  'na', 'no', 'nas', 'nos', 'para', 'ao', 'à',
]);
function tokens(name: string): string[] {
  return (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t) && t.length > 1);
}
function score(a: string, b: string): number {
  const ta = new Set(tokens(a)); const tb = tokens(b);
  if (!ta.size || !tb.length) return 0;
  let s = 0;
  for (const t of tb) if (ta.has(t)) s += 1;
  return s / Math.max(ta.size, tb.length);
}

interface ResolvedMacro { grams: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number }

interface EnrichCache {
  foodByKey: Map<string, FoodItem | null>;
  measuresByFoodId: Map<string, FoodMeasure[]>;
  aiByKey: Map<string, ResolvedMacro | null>;
  inflight: Map<string, Promise<void>>;
}
export function makeEnrichCache(): EnrichCache {
  return { foodByKey: new Map(), measuresByFoodId: new Map(), aiByKey: new Map(), inflight: new Map() };
}

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Texto descritivo do alimento para a IA (usa o original quando disponível).
function itemText(t: FoodToken): string {
  if (t.raw && t.raw.trim()) return t.raw.trim();
  const qty = t.quantity != null ? String(t.quantity) : '';
  const measure = (t.measure || '').trim();
  const tail = [qty, measure].filter(Boolean).join(' ');
  return tail ? `${t.name} — ${tail}` : t.name;
}

// Gramas explícitos "(X g)" no texto/medida — autoridade quando presente.
function explicitGrams(t: FoodToken): number | null {
  const src = `${t.measure || ''} ${t.raw || ''}`;
  const m = src.match(/\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\)/i);
  if (m) {
    const g = Number(m[1].replace(',', '.'));
    if (Number.isFinite(g) && g > 0) return g;
  }
  return null;
}

function keyOf(t: FoodToken): string {
  return normalize(itemText(t));
}

// ─────────── Resolução via IA (batch + cache) ───────────
async function resolveBatch(cache: EnrichCache, needed: Array<{ key: string; text: string; grams: number | null }>): Promise<void> {
  if (!needed.length) return;
  const { data, error } = await supabase.functions.invoke('resolve-plan-foods', {
    body: { items: needed.map((n, i) => ({ id: String(i), text: n.text, grams: n.grams })) },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  const byId = new Map<string, any>();
  for (const it of ((data as any)?.items || [])) byId.set(String(it.id), it);
  needed.forEach((n, i) => {
    const r = byId.get(String(i));
    cache.aiByKey.set(n.key, r ? {
      grams: Number(r.grams) || (n.grams ?? 0),
      kcal: Number(r.kcal) || 0,
      protein_g: Number(r.protein_g) || 0,
      carbs_g: Number(r.carbs_g) || 0,
      fat_g: Number(r.fat_g) || 0,
    } : null);
  });
}

// Garante que todos os itens pedidos estejam resolvidos (ou marcados como
// falha → fallback). Deduplica chamadas concorrentes por chave.
async function ensureResolved(cache: EnrichCache, items: Array<{ key: string; text: string; grams: number | null }>): Promise<void> {
  const uniq = new Map<string, { key: string; text: string; grams: number | null }>();
  for (const it of items) if (!uniq.has(it.key)) uniq.set(it.key, it);

  const toFetch: Array<{ key: string; text: string; grams: number | null }> = [];
  const waits: Promise<void>[] = [];
  for (const it of uniq.values()) {
    if (cache.aiByKey.has(it.key)) continue;
    const inflight = cache.inflight.get(it.key);
    if (inflight) { waits.push(inflight); continue; }
    toFetch.push(it);
  }

  if (toFetch.length) {
    const p = resolveBatch(cache, toFetch).catch(() => {
      // Falha global do batch → marca como não-resolvido (cai no fallback local).
      for (const it of toFetch) if (!cache.aiByKey.has(it.key)) cache.aiByKey.set(it.key, null);
    }).finally(() => {
      for (const it of toFetch) cache.inflight.delete(it.key);
    });
    for (const it of toFetch) cache.inflight.set(it.key, p);
    waits.push(p);
  }
  await Promise.all(waits);
}

// ─────────── Fallback: casamento local com o banco ───────────
async function findFood(name: string, cache: EnrichCache): Promise<FoodItem | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (cache.foodByKey.has(key)) return cache.foodByKey.get(key) ?? null;
  const raw = (name || '').trim();
  const rawWords = raw.split(/\s+/).filter((w) => w.length > 1 && !STOP.has(normalize(w)));
  const q = (rawWords[0] || raw).replace(/[%_]/g, '');
  const { data } = await (supabase as any)
    .from('food_items').select('*').ilike('name', `%${q}%`).limit(20);
  const rows = (data || []) as FoodItem[];
  let best: FoodItem | null = null; let bestScore = 0;
  for (const r of rows) {
    const s = score(r.name, name);
    if (s > bestScore) { best = r; bestScore = s; }
  }
  cache.foodByKey.set(key, bestScore >= 0.34 ? best : null);
  return cache.foodByKey.get(key) ?? null;
}

async function measuresOf(foodId: string, cache: EnrichCache): Promise<FoodMeasure[]> {
  if (cache.measuresByFoodId.has(foodId)) return cache.measuresByFoodId.get(foodId)!;
  const { data } = await (supabase as any)
    .from('food_measures').select('*').eq('food_item_id', foodId);
  const list = (data || []) as FoodMeasure[];
  cache.measuresByFoodId.set(foodId, list);
  return list;
}

function gramsFromToken(token: FoodToken, measures: FoodMeasure[]): number {
  const explicit = explicitGrams(token);
  if (explicit != null) return explicit;
  const q = Number(token.quantity ?? 1) || 1;
  const m = normalize(token.measure || '');
  if (!m) return q;
  if (/^kg$/.test(m)) return q * 1000;
  if (/^(g|ml)$/.test(m)) return q;
  let best: FoodMeasure | null = null; let bestScore = 0;
  for (const mm of measures) {
    const s = score(mm.measure_name, token.measure || '');
    if (s > bestScore) { best = mm; bestScore = s; }
  }
  if (best) return q * best.measure_weight_g;
  return q * 30;
}

async function enrichTokenLocal(t: FoodToken, cache: EnrichCache): Promise<boolean> {
  if (!t.name) return false;
  const food = await findFood(t.name, cache);
  if (!food) return false;
  const measures = await measuresOf(food.id, cache);
  const grams = gramsFromToken(t, measures);
  const n = calcNutrients(food, grams);
  (t as any).foodItemId = food.id;
  t.grams = grams;
  t.calories = n.calories;
  t.protein_g = n.protein_g;
  t.carbs_g = n.carbs_g;
  t.fat_g = n.fat_g;
  return true;
}

function applyResolved(t: FoodToken, r: ResolvedMacro) {
  t.grams = r.grams;
  t.calories = r.kcal;
  t.protein_g = r.protein_g;
  t.carbs_g = r.carbs_g;
  t.fat_g = r.fat_g;
}

// Semeia o cache com os macros JÁ SALVOS do plano, para que ao reabrir um
// plano salvo os valores sejam reutilizados EXATAMENTE como estavam (nada de
// re-chamar a IA, que não é determinística) — corrige a variação de kcal/porções
// ao reabrir e elimina a lentidão (sem chamadas de IA no carregamento).
// A chave usa o MESMO texto que o editor gera (mealsToText → tokenToText), então
// bate com keyOf() dos tokens re-parseados a partir do texto.
export function seedCacheFromMeals(cache: EnrichCache, meals: any[]): void {
  if (!Array.isArray(meals) || !meals.length) return;
  const ast = mealsToAst(meals);
  for (const meal of ast.meals) {
    const groupsList = meal.options && meal.options.length
      ? meal.options.map((o) => o.groups)
      : [meal.groups];
    for (const groups of groupsList) {
      for (const g of groups) {
        for (const t of g.tokens) {
          if (!t.name) continue;
          const key = normalize(tokenToText(t));
          // Plano salvo é FIXO: registra os valores como estão (mesmo 0).
          cache.aiByKey.set(key, {
            grams: Number(t.grams) || 0,
            kcal: Number(t.calories) || 0,
            protein_g: Number(t.protein_g) || 0,
            carbs_g: Number(t.carbs_g) || 0,
            fat_g: Number(t.fat_g) || 0,
          });
        }
      }
    }
  }
}

export async function enrichAst(ast: PlanAst, cache = makeEnrichCache()): Promise<PlanAst> {
  // 1) Reúne todos os tokens (opção principal e demais opções).
  const allTokens: FoodToken[] = [];
  for (const meal of ast.meals) {
    const groupsList = meal.options && meal.options.length
      ? meal.options.map((o) => o.groups)
      : [meal.groups];
    for (const groups of groupsList) {
      for (const g of groups) {
        for (const t of g.tokens) if (t.name) allTokens.push(t);
      }
    }
  }

  // 2) Resolve via IA (batch + cache).
  const items = allTokens.map((t) => ({ key: keyOf(t), text: itemText(t), grams: explicitGrams(t) }));
  try {
    await ensureResolved(cache, items);
  } catch { /* segue com fallback local */ }

  // 3) Aplica: IA quando disponível; senão, casamento local com o banco.
  for (const t of allTokens) {
    const r = cache.aiByKey.get(keyOf(t));
    if (r) { applyResolved(t, r); continue; }
    try { await enrichTokenLocal(t, cache); } catch { /* ignore */ }
  }
  return ast;
}
