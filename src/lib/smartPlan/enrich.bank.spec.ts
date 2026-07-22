import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase: banco tem "Pão francês" (300 kcal/100g). A IA (invoke) NÃO deve
// ser chamada para um alimento com casamento EXATO no banco — o valor do banco
// (igual à prévia da sugestão) prevalece.
const { invoke, from } = vi.hoisted(() => {
  const invoke = vi.fn(async () => ({ data: { items: [] }, error: null }));
  const BANK = { id: 'pf', name: 'Pão francês', calories_per_100g: 300, protein_per_100g: 8, carbs_per_100g: 58, fat_per_100g: 4, fiber_per_100g: 2 };
  const makeQ = (result: any) => {
    const q: any = {
      select: () => q, ilike: () => q, eq: () => q, order: () => q, limit: () => q,
      then: (res: any) => Promise.resolve(result).then(res),
    };
    return q;
  };
  const from = vi.fn((table: string) => {
    if (table === 'food_items') return makeQ({ data: [BANK] });
    return makeQ({ data: [] }); // food_measures
  });
  return { invoke, from };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke }, from } }));

import { enrichAst, makeEnrichCache } from './enrich';
import { parseText } from './parse';
import { planTotals } from './serialize';

describe('enrichAst — casamento exato no banco', () => {
  beforeEach(() => { invoke.mockClear(); from.mockClear(); });

  it('usa o valor do banco (150 kcal p/ 50 g) e NÃO chama a IA', async () => {
    const ast = parseText('@ 07:00 Café da manhã\nPão francês - 1 Unidade (50g)');
    await enrichAst(ast, makeEnrichCache());
    const totals = planTotals(ast);
    expect(totals.kcal).toBe(150);   // 300/100 * 50
    expect(totals.cho).toBe(29);     // 58/100 * 50
    expect(invoke).not.toHaveBeenCalled();
  });
});
