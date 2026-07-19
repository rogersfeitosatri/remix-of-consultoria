// Enriquece o AST casando cada token com food_items/food_measures do banco:
// - Busca por nome com ilike + escolha da melhor correspondência (score
//   simples por tokens comuns).
// - Se a medida citada bater com um food_measures do alimento, usa
//   measure_weight_g × quantity para grams.
// - Fallback: se a medida for "g"/"ml"/"kg", usa a quantidade direto.
// - Calcula calories/protein/carbs/fat/fiber usando calcNutrients.
//
// Feito para rodar em lote (uma consulta por lote de nomes únicos), com
// cache em memória durante a sessão do editor.

import { supabase } from '@/integrations/supabase/client';
import { calcNutrients, type FoodItem, type FoodMeasure } from '@/hooks/useFoodSearch';
import type { PlanAst, FoodToken } from './ast';

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

interface EnrichCache {
  foodByKey: Map<string, FoodItem | null>;
  measuresByFoodId: Map<string, FoodMeasure[]>;
}
export function makeEnrichCache(): EnrichCache {
  return { foodByKey: new Map(), measuresByFoodId: new Map() };
}

async function findFood(name: string, cache: EnrichCache): Promise<FoodItem | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (cache.foodByKey.has(key)) return cache.foodByKey.get(key) ?? null;
  const q = tokens(name)[0] || name;
  const { data } = await (supabase as any)
    .from('food_items').select('*').ilike('name', `%${q}%`).limit(15);
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

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function gramsFromToken(token: FoodToken, measures: FoodMeasure[]): number {
  // Autoridade: sufixo "(Xg)" na medida (formato escrito pelo editor V3
  // após applyMeasure/applyFood — já é o TOTAL resolvido). Prevalece sobre
  // heurísticas para garantir kcal/macros exatos em tempo real.
  const parenTotal = (token.measure || '').match(/\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\)/i);
  if (parenTotal) {
    const g = Number(parenTotal[1].replace(',', '.'));
    if (Number.isFinite(g) && g > 0) return g;
  }
  const q = Number(token.quantity ?? 1) || 1;
  const m = normalize(token.measure || '');
  if (!m) return q; // sem medida assumimos gramas
  if (/^kg$/.test(m)) return q * 1000;
  if (/^(g|ml)$/.test(m)) return q;
  // tenta bater com food_measures
  let best: FoodMeasure | null = null; let bestScore = 0;
  for (const mm of measures) {
    const s = score(mm.measure_name, token.measure || '');
    if (s > bestScore) { best = mm; bestScore = s; }
  }
  if (best) return q * best.measure_weight_g;
  // fallback razoável para medidas caseiras
  return q * 30;
}

/** Enriquece o token no lugar. Retorna se conseguiu casar. */
async function enrichToken(t: FoodToken, cache: EnrichCache): Promise<boolean> {
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

export async function enrichAst(ast: PlanAst, cache = makeEnrichCache()): Promise<PlanAst> {
  for (const meal of ast.meals) {
    for (const g of meal.groups) {
      for (const t of g.tokens) {
        try { await enrichToken(t, cache); } catch { /* ignore */ }
      }
    }
  }
  return ast;
}
