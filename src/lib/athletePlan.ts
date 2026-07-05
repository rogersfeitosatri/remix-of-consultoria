// Normaliza o plano alimentar (estruturado do editor OU texto gerado pela IA)
// para uma forma pronta para a UI do atleta, com substituições em "Outras opções".

import type { AthleteAnalysis, MealPlanMeal } from '@/hooks/useAthleteAnalysis';

export interface PlanFood {
  name: string;
  amount?: string; // "2", "100 g", "1 fatia"...
  measure?: string; // medida caseira
  weight?: string; // "100g"
  raw: string;
}

export interface PlanFoodGroup {
  primary: PlanFood;
  alternatives: PlanFood[];
}

export interface PlanMeal {
  key: string;
  name: string;
  time?: string;
  observation?: string;
  macros?: string;
  foods: PlanFoodGroup[];
}

const EMOJI: [RegExp, string][] = [
  [/café|cafe|manhã|manha/i, '☕'],
  [/almo/i, '🍽️'],
  [/jantar|noite/i, '🌙'],
  [/ceia/i, '🥛'],
  [/pré|pre|pós|pos|treino/i, '💪'],
  [/lanche|tarde/i, '🍎'],
];

export function mealEmoji(name: string): string {
  for (const [re, e] of EMOJI) if (re.test(name || '')) return e;
  return '🍴';
}

// Extrai horário do nome ("07:00 - Café") ou do timing_note.
function extractTime(name: string, timingNote?: string): { time?: string; cleanName: string } {
  const m = (name || '').match(/^\s*(\d{1,2}[:h.]\d{0,2})\s*[-–—]?\s*(.*)$/);
  if (m && m[2]) {
    return { time: m[1].replace(/[h.]/, ':').replace(/:$/, ':00'), cleanName: m[2].trim() };
  }
  const tn = (timingNote || '').match(/(\d{1,2}[:h.]\d{2})/);
  return { time: tn ? tn[1].replace(/[h.]/, ':') : undefined, cleanName: (name || '').trim() };
}

// Divide um item em [principal, ...alternativas] usando OU / ou / "/".
function splitAlternatives(text: string): string[] {
  // IMPORTANT: only split on " / " with whitespace on BOTH sides. A bare "/"
  // inside "1/2 xícara" is a fraction, not a separator, and splitting it would
  // corrupt the food name (e.g. "quinoa cozida (70g, 1/2 xícara)" → two items).
  // We also protect parenthesised groups: never split inside "(...)".
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  const src = text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0) {
      // " ou " / " OU " separator
      const rest = src.slice(i);
      const ouMatch = rest.match(/^\s+(?:ou|OU)\s+/);
      if (ouMatch) {
        parts.push(buf);
        buf = '';
        i += ouMatch[0].length - 1;
        continue;
      }
      // " / " separator (spaces required to avoid matching fractions like 1/2)
      if (ch === '/' && /\s/.test(src[i - 1] || '') && /\s/.test(src[i + 1] || '')) {
        parts.push(buf);
        buf = '';
        continue;
      }
    }
    buf += ch;
  }
  if (buf) parts.push(buf);
  return parts.map((s) => s.trim()).filter(Boolean);
}

// Separa nome e quantidade. Aceita:
//  "pão francês (80g, 2 fatias)"  → nome "pão francês", qtd "80g, 2 fatias"
//  "100 g arroz" / "2 ovos"       → qtd "100 g", nome "arroz"
function parseFoodText(text: string): PlanFood {
  const raw = text.replace(/\s*\(ex:.*?\)/i, '').trim();
  // parênteses no fim → quantidade
  let m = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    return { name: m[1].trim(), amount: m[2].trim(), raw };
  }
  // quantidade + unidade opcional no início
  m = raw.match(/^(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|un)?)\s+(?:de\s+)?(.+)$/i);
  if (m) {
    return { name: m[2].trim(), amount: m[1].trim(), raw };
  }
  return { name: raw, raw };
}

// Linha de quantidade única para exibição (fonte menor).
// Remove reference weight in parenthesis from measure_name (e.g. "Fatia média (80g)" → "Fatia média").
// We show only the TOTAL weight (weight_g) to the user, so the per-unit reference
// inside the measure name is redundant and confusing.
export function stripMeasureRef(measure?: string): string {
  return (measure || '').replace(/\s*\([^)]*\bg\b[^)]*\)\s*$/i, '').trim();
}

export function foodQuantityLine(food: PlanFood): string {
  const parts = [food.amount];
  if (food.weight && !(food.amount || '').toLowerCase().includes(food.weight.toLowerCase())) {
    parts.push(food.weight);
  }
  return parts.filter(Boolean).join(' · ');
}

function structuredToFood(f: any): PlanFood {
  const measure = stripMeasureRef(f.measure_name);
  return {
    name: f.name,
    amount: f.quantity != null ? `${f.quantity} ${measure}`.trim() : undefined,
    measure,
    weight: f.weight_g != null ? `${Math.round(f.weight_g)}g` : undefined,
    raw: f.name,
  };
}

function buildFoodsFromMeal(meal: MealPlanMeal): PlanFoodGroup[] {
  // 1) Estruturado (editor): já tem substitutions.
  const structured = (meal as any).foods as any[] | undefined;
  if (structured && structured.length > 0) {
    return structured.map((f) => ({
      primary: structuredToFood(f),
      alternatives: Array.isArray(f.substitutions) ? f.substitutions.map(structuredToFood) : [],
    }));
  }
  // 2) Opções de refeição inteira → usa a Opção 1 como base.
  const options = (meal as any).options as any[] | undefined;
  if (options && options.length > 0) {
    return buildFoodsFromMeal({ ...meal, foods: options[0]?.foods, food_groups: options[0]?.food_groups } as MealPlanMeal);
  }
  // 3) Texto legado (food_groups): separa "OU" em alternativas.
  const groups = meal.food_groups || [];
  const out: PlanFoodGroup[] = [];
  for (const g of groups) {
    const items = (g.options || '').split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      const parts = splitAlternatives(item);
      if (parts.length === 0) continue;
      out.push({
        primary: parseFoodText(parts[0]),
        alternatives: parts.slice(1).map(parseFoodText),
      });
    }
  }
  return out;
}

export function normalizeMeals(analysis: AthleteAnalysis | null | undefined): PlanMeal[] {
  const meals = analysis?.meal_plan?.meals || [];
  return meals.map((meal, i) => {
    const { time, cleanName } = extractTime(meal.meal_name || `Refeição ${i + 1}`, meal.timing_note);
    // Remove um parêntese no fim do nome ("Café da Manhã (pré-treino…)") para
    // deixar o título curto; vira observação se ainda não houver uma.
    let name = cleanName;
    let noteFromName: string | undefined;
    const pm = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (pm) { name = pm[1].trim(); noteFromName = pm[2].trim(); }
    // timing_note vira observação quando não é só o horário
    const obs = meal.timing_note && !/^\s*\d{1,2}[:h.]\d{0,2}\s*$/.test(meal.timing_note.trim())
      ? meal.timing_note
      : undefined;
    return {
      key: `meal_${i}`,
      name,
      time,
      observation: obs || noteFromName,
      macros: meal.meal_macros,
      foods: buildFoodsFromMeal(meal),
    };
  });
}
