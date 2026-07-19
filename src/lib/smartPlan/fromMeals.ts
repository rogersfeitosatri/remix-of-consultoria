// Converte o formato canônico `meals[]` (usado hoje) para AST/texto do editor.
// Assim, planos existentes e planos importados podem abrir direto no editor.

import type { PlanAst, MealBlock, GroupLine, FoodToken, MealOption } from './ast';
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

function foodsToGroups(foods: any[]): GroupLine[] {
  const groups: GroupLine[] = [];
  for (const f of foods || []) {
    const main = foodToToken(f);
    const subs = Array.isArray(f?.substitutions) ? f.substitutions.map(foodToToken) : [];
    groups.push({ tokens: [main, ...subs] });
  }
  return groups;
}

export function mealsToAst(meals: any[]): PlanAst {
  const out: MealBlock[] = [];
  for (const m of meals || []) {
    const rawOptions: any[] = Array.isArray(m?.options) ? m.options : [];
    let options: MealOption[] | undefined;
    let groups: GroupLine[];
    if (rawOptions.length > 1) {
      const anyPrimary = rawOptions.some((o) => o?.primary);
      options = rawOptions.map((o, i) => ({
        name: o?.label || `Opção ${i + 1}`,
        primary: !!o?.primary || (!anyPrimary && i === 0),
        groups: foodsToGroups(o?.foods || []),
      }));
      const primary = options.find((o) => o.primary) || options[0];
      groups = primary.groups;
    } else {
      const foods = Array.isArray(m?.foods) ? m.foods : (rawOptions[0]?.foods || []);
      groups = foodsToGroups(foods);
    }
    out.push({
      name: String(m?.meal_name || 'Refeição').trim(),
      time: (m?.horario || '').trim() || null,
      notes: (m?.timing_note || '').trim() || undefined,
      groups,
      options,
    });
  }
  return { meals: out };
}

export function mealsToText(meals: any[]): string {
  return astToText(mealsToAst(meals));
}
