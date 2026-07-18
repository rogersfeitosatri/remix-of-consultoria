// Converte o formato canônico `meals[]` (usado hoje) para AST/texto do editor.
// Assim, planos existentes e planos importados podem abrir direto no editor.

import type { PlanAst, MealBlock, GroupLine, FoodToken } from './ast';
import { astToText } from './serialize';

function foodToToken(f: any): FoodToken {
  return {
    name: String(f?.name || '').trim(),
    quantity: f?.quantity ?? null,
    measure: f?.measure ?? (f?.grams ? `${f.grams} g` : null),
    grams: f?.grams ?? null,
    foodItemId: f?.food_item_id ?? null,
    measureId: f?.measure_id ?? null,
    calories: Number(f?.calories) || 0,
    protein_g: Number(f?.protein_g) || 0,
    carbs_g: Number(f?.carbs_g) || 0,
    fat_g: Number(f?.fat_g) || 0,
  };
}

export function mealsToAst(meals: any[]): PlanAst {
  const out: MealBlock[] = [];
  for (const m of meals || []) {
    const groups: GroupLine[] = [];
    // Prioriza `foods[]` (formato mais recente com substitutions).
    const foods = Array.isArray(m?.foods) ? m.foods : (m?.options?.[0]?.foods || []);
    for (const f of foods) {
      const main = foodToToken(f);
      const subs = Array.isArray(f?.substitutions) ? f.substitutions.map(foodToToken) : [];
      groups.push({ tokens: [main, ...subs] });
    }
    out.push({
      name: String(m?.meal_name || 'Refeição').trim(),
      time: (m?.horario || '').trim() || null,
      notes: (m?.timing_note || '').trim() || undefined,
      groups,
    });
  }
  return { meals: out };
}

export function mealsToText(meals: any[]): string {
  return astToText(mealsToAst(meals));
}
