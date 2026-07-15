// Helpers do pipeline de geração do plano alimentar em etapas.
// - Chamada de IA com timeout curto por tentativa (~50s) + fallback (dentro do
//   limite da Edge Function).
// - Correspondência de alimentos com o banco (food_items) e cálculo
//   determinístico de macros pelo código.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
export const WEEKDAY_LABEL: Record<string, string> = {
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo",
};

interface AiProvider { name: string; endpoint: string; apiKey?: string; model: string; }

function providers(): AiProvider[] {
  const list: AiProvider[] = [
    { name: "gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: Deno.env.get("GEMINI_API_KEY"), model: "gemini-2.5-flash" },
    { name: "lovable", endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: Deno.env.get("LOVABLE_API_KEY"), model: "google/gemini-2.5-flash" },
  ];
  return list.filter((p) => !!p.apiKey);
}

// Chama a IA pedindo JSON. Timeout curto por tentativa; tenta o próximo provedor
// se o primeiro falhar/estourar o tempo. Lança se todos falharem.
export async function callAiJson(opts: {
  systemPrompt: string;
  userPrompt: string;
  perAttemptMs?: number;
}): Promise<{ data: any; provider: string; model: string }> {
  const perAttempt = opts.perAttemptMs ?? 110_000;
  const errs: string[] = [];
  for (const p of providers()) {
    // Até 3 tentativas por provedor com backoff em 429/5xx.
    let attempt = 0;
    while (attempt < 3) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), perAttempt);
      try {
        const res = await fetch(p.endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
          body: JSON.stringify({
            model: p.model,
            messages: [
              { role: "system", content: opts.systemPrompt },
              { role: "user", content: opts.userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.4,
          }),
        });
        clearTimeout(timer);
        if (!res.ok) {
          errs.push(`${p.name}:${res.status}#${attempt}`);
          if ((res.status === 429 || res.status >= 500) && attempt < 3) {
            await new Promise((r) => setTimeout(r, 1500 * attempt + Math.random() * 500));
            continue;
          }
          break; // erro definitivo — próximo provedor
        }
        const body = await res.json();
        const content = body?.choices?.[0]?.message?.content ?? "";
        const parsed = parseJson(content);
        if (parsed) return { data: parsed, provider: p.name, model: p.model };
        errs.push(`${p.name}:parse#${attempt}`);
        if (attempt < 3) { await new Promise((r) => setTimeout(r, 1000)); continue; }
        break;
      } catch (e) {
        clearTimeout(timer);
        const kind = (e as Error).name === "AbortError" ? "timeout" : (e as Error).message;
        errs.push(`${p.name}:${kind}#${attempt}`);
        break; // não retenta timeout/exceção — próximo provedor
      }
    }
  }
  throw new Error(`Falha na IA (${errs.join(" | ")})`);
}

function parseJson(s: string): any {
  if (!s) return null;
  const cleaned = s.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); } catch { /* */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
  return null;
}

// ---------- Banco de alimentos ----------
export interface FoodRow {
  id: string; name: string; norm: string;
  kcal: number; protein: number; carbs: number; fat: number; fiber: number;
}

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export async function loadFoodTable(supabase: SupabaseClient): Promise<FoodRow[]> {
  const { data } = await supabase
    .from("food_items")
    .select("id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .limit(2000);
  return (data || []).map((f: any) => ({
    id: f.id, name: f.name, norm: norm(f.name),
    kcal: Number(f.calories_per_100g) || 0, protein: Number(f.protein_per_100g) || 0,
    carbs: Number(f.carbs_per_100g) || 0, fat: Number(f.fat_per_100g) || 0, fiber: Number(f.fiber_per_100g) || 0,
  }));
}

// Melhor correspondência por sobreposição de tokens (retorna null se fraca).
export function matchFood(name: string, table: FoodRow[]): FoodRow | null {
  const n = norm(name);
  if (!n) return null;
  const exact = table.find((f) => f.norm === n);
  if (exact) return exact;
  const tokens = n.split(" ").filter((t) => t.length >= 3);
  if (!tokens.length) return null;
  let best: FoodRow | null = null; let bestScore = 0;
  for (const f of table) {
    let score = 0;
    for (const t of tokens) if (f.norm.includes(t)) score++;
    // bônus se o nome do alimento estiver contido na descrição
    if (n.includes(f.norm) || f.norm.includes(tokens[0])) score += 0.5;
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return bestScore >= Math.max(1, tokens.length * 0.5) ? best : null;
}

export interface Macros { kcal: number; cho_g: number; protein_g: number; fat_g: number; fiber_g: number; }
export const zeroMacros = (): Macros => ({ kcal: 0, cho_g: 0, protein_g: 0, fat_g: 0, fiber_g: 0 });

export function foodMacros(grams: number, f: FoodRow): Macros {
  const k = (Number(grams) || 0) / 100;
  return { kcal: f.kcal * k, cho_g: f.carbs * k, protein_g: f.protein * k, fat_g: f.fat * k, fiber_g: f.fiber * k };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, cho_g: a.cho_g + b.cho_g, protein_g: a.protein_g + b.protein_g, fat_g: a.fat_g + b.fat_g, fiber_g: a.fiber_g + b.fiber_g };
}
export const roundMacros = (m: Macros): Macros => ({
  kcal: Math.round(m.kcal), cho_g: Math.round(m.cho_g), protein_g: Math.round(m.protein_g), fat_g: Math.round(m.fat_g), fiber_g: Math.round(m.fiber_g),
});

const numOr0 = (v: any) => { const n = Number(v); return isFinite(n) && n >= 0 ? n : 0; };

// Para os alimentos SEM correspondência no banco: busca os macros por 100g via
// IA (TACO/IBGE) e SALVA em food_items (para os próximos planos). Enriquece a
// tabela em memória. Uma única chamada de IA para todos os faltantes.
export async function resolveMissingFoods(
  supabase: SupabaseClient, names: string[], table: FoodRow[], ownerUserId: string | null,
): Promise<{ added: number }> {
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const nm of names) {
    const key = norm(nm);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!matchFood(nm, table)) missing.push(nm.trim());
  }
  if (!missing.length) return { added: 0 };

  let rows: any[] = [];
  try {
    const { data } = await callAiJson({
      systemPrompt: "Você é um banco de dados nutricional brasileiro (TACO/IBGE). Estime valores confiáveis por 100g.",
      userPrompt: `Para CADA alimento da lista, retorne os macros por 100g. Responda SOMENTE JSON: {"foods":[{"name":string,"category":string,"kcal":number,"protein":number,"carbs":number,"fat":number,"fiber":number}]}. Use o nome exatamente como recebido. Lista: ${JSON.stringify(missing)}`,
      perAttemptMs: 40_000,
    });
    rows = Array.isArray(data?.foods) ? data.foods : [];
  } catch (_) { rows = []; }

  let added = 0;
  for (const r of rows) {
    if (!r?.name) continue;
    const ins = {
      name: String(r.name), category: r.category || "Outros",
      calories_per_100g: numOr0(r.kcal), protein_per_100g: numOr0(r.protein),
      carbs_per_100g: numOr0(r.carbs), fat_per_100g: numOr0(r.fat), fiber_per_100g: numOr0(r.fiber),
      source: "ai", created_by: ownerUserId,
    };
    try {
      const { data: inserted } = await supabase.from("food_items").insert(ins).select("id").single();
      if (inserted?.id) {
        table.push({
          id: inserted.id, name: ins.name, norm: norm(ins.name),
          kcal: ins.calories_per_100g, protein: ins.protein_per_100g, carbs: ins.carbs_per_100g, fat: ins.fat_per_100g, fiber: ins.fiber_per_100g,
        });
        added++;
      }
    } catch (_) { /* ignora falha de insert individual */ }
  }
  return { added };
}
