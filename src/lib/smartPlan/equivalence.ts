// Recalcula quantidades das substituições para ficarem nutricionalmente
// equivalentes ao alimento principal do grupo. Prioriza o macro dominante.

import type { FoodToken } from './ast';

function dominant(f: FoodToken): 'carb' | 'protein' | 'fat' | 'mixed' {
  const c = (f.carbs_g || 0) * 4;
  const p = (f.protein_g || 0) * 4;
  const g = (f.fat_g || 0) * 9;
  if (c === 0 && p === 0 && g === 0) return 'mixed';
  const max = Math.max(c, p, g);
  if (max === c && c >= (p + g) * 0.6) return 'carb';
  if (max === p && p >= (c + g) * 0.6) return 'protein';
  if (max === g && g >= (c + p) * 0.6) return 'fat';
  return 'mixed';
}

function target(f: FoodToken): number {
  switch (dominant(f)) {
    case 'carb': return f.carbs_g || f.calories || 0;
    case 'protein': return f.protein_g || f.calories || 0;
    case 'fat': return f.fat_g || f.calories || 0;
    default: return f.calories || 0;
  }
}

/** Retorna cópia da substituição com gramas/quantidade/macros escalados para
 *  bater a referência do principal (por macro dominante). Preserva o texto
 *  da medida. Se a substituição não tem macros por porção suficientes, devolve
 *  a original. */
export function recalcSubstitution(main: FoodToken, sub: FoodToken): FoodToken {
  const ref = target(main);
  const cur = target(sub);
  if (!ref || !cur) return sub;
  const factor = ref / cur;
  if (!isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.05) return sub;

  const round = (v: number | undefined, digits = 1) => (v == null ? v : Math.round(v * factor * (10 ** digits)) / (10 ** digits));
  const q = sub.quantity != null ? Math.max(0.1, Math.round((sub.quantity || 0) * factor * 10) / 10) : sub.quantity;
  const g = sub.grams != null ? Math.max(1, Math.round((sub.grams || 0) * factor)) : sub.grams;

  return {
    ...sub,
    quantity: q,
    grams: g,
    measure: typeof sub.measure === 'string' && /^\s*\d+\s*g\s*$/i.test(sub.measure) && g ? `${g} g` : sub.measure,
    calories: round(sub.calories, 0) as number | undefined,
    protein_g: round(sub.protein_g),
    carbs_g: round(sub.carbs_g),
    fat_g: round(sub.fat_g),
  };
}

export function recalcGroupSubstitutions(tokens: FoodToken[]): FoodToken[] {
  if (tokens.length < 2) return tokens;
  const [main, ...subs] = tokens;
  return [main, ...subs.map((s) => recalcSubstitution(main, s))];
}
