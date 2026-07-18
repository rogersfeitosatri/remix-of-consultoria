// AST → texto formatado (para carregar planos existentes no editor) e
// AST → meals[] canônico do sistema (mesmo formato usado pelo envio ao Zona
// Nutri, PDF e visualização estruturada).

import type { PlanAst, FoodToken, MealBlock } from './ast';

function fmtQty(q?: number | null): string {
  if (q == null || !isFinite(q)) return '';
  return Number.isInteger(q) ? String(q) : String(q).replace('.', ',');
}
export function tokenToText(t: FoodToken): string {
  const q = fmtQty(t.quantity ?? undefined);
  const m = (t.measure || '').trim();
  const qty = [q, m].filter(Boolean).join(' ');
  return qty ? `${t.name} - ${qty}` : t.name;
}
export function astToText(ast: PlanAst): string {
  const out: string[] = [];
  for (const meal of ast.meals) {
    const title = meal.time ? `${meal.time} — ${meal.name}` : meal.name;
    if (out.length) out.push('');
    out.push(title);
    for (const g of meal.groups) {
      out.push(g.tokens.map(tokenToText).join(' ou '));
    }
    if (meal.notes) out.push(`> ${meal.notes}`);
  }
  return out.join('\n');
}

// ─────────── AST → formato canônico `meals[]` ───────────
// Estrutura consumida por PlanReadOnlyView, envio ao Zona Nutri e PDF.
// Cada linha (grupo) vira: `foods[]` com o principal + `substitutions` no
// próprio food. Também popula `options` (uma única opção com o principal) e
// `food_groups` textual para retrocompatibilidade.

function tokenToFood(t: FoodToken) {
  return {
    name: t.name,
    grams: t.grams ?? null,
    measure: t.measure ?? null,
    quantity: t.quantity ?? null,
    food_item_id: t.foodItemId ?? null,
    measure_id: t.measureId ?? null,
    calories: t.calories ?? 0,
    protein_g: t.protein_g ?? 0,
    carbs_g: t.carbs_g ?? 0,
    fat_g: t.fat_g ?? 0,
  };
}

export function astToMeals(ast: PlanAst) {
  return ast.meals.map((meal) => {
    const foods = meal.groups.map((g) => {
      const [main, ...subs] = g.tokens;
      if (!main) return null;
      const f: any = tokenToFood(main);
      f.substitutions = subs.map((s) => tokenToFood(s));
      return f;
    }).filter(Boolean) as any[];

    const totals = foods.reduce(
      (a, f) => ({
        kcal: a.kcal + (Number(f.calories) || 0),
        cho: a.cho + (Number(f.carbs_g) || 0),
        ptn: a.ptn + (Number(f.protein_g) || 0),
        lip: a.lip + (Number(f.fat_g) || 0),
      }),
      { kcal: 0, cho: 0, ptn: 0, lip: 0 },
    );

    return {
      meal_name: meal.name,
      horario: meal.time || '',
      timing_note: meal.notes || '',
      foods,
      options: [{ foods }],
      food_groups: foods.map((f) => ({
        group: f.name,
        options: `${f.name}${f.grams ? ` ${f.grams}g` : (f.measure ? ` ${f.quantity ?? ''} ${f.measure}`.trim() : '')}${(f.substitutions || []).length ? ` ou ${(f.substitutions || []).map((s: any) => `${s.name}${s.grams ? ` ${s.grams}g` : ''}`).join('; ')}` : ''}`.trim(),
      })),
      meal_macros: totals.kcal
        ? `~${Math.round(totals.kcal)} kcal, CHO ${Math.round(totals.cho)}g, PTN ${Math.round(totals.ptn)}g, LIP ${Math.round(totals.lip)}g`
        : '',
    };
  });
}

export function planTotals(ast: PlanAst) {
  const meals = astToMeals(ast);
  return meals.reduce(
    (a, m) => {
      const t = (m.foods || []).reduce(
        (x: any, f: any) => ({
          kcal: x.kcal + (Number(f.calories) || 0),
          cho: x.cho + (Number(f.carbs_g) || 0),
          ptn: x.ptn + (Number(f.protein_g) || 0),
          lip: x.lip + (Number(f.fat_g) || 0),
        }),
        { kcal: 0, cho: 0, ptn: 0, lip: 0 },
      );
      return { kcal: a.kcal + t.kcal, cho: a.cho + t.cho, ptn: a.ptn + t.ptn, lip: a.lip + t.lip };
    },
    { kcal: 0, cho: 0, ptn: 0, lip: 0 },
  );
}
