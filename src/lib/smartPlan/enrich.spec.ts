import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do cliente supabase: se a IA (functions.invoke) OU o banco (from) forem
// chamados ao reabrir um plano semeado, o teste falha — garantindo que um plano
// salvo é reaberto VERBATIM, sem re-resolver nada.
const { invoke, from } = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({ data: { items: [] }, error: null })),
  from: vi.fn(() => { throw new Error('DB não deve ser consultado em plano semeado'); }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke }, from },
}));

import { seedCacheFromMeals, enrichAst, makeEnrichCache } from './enrich';
import { mealsToText } from './fromMeals';
import { parseText } from './parse';
import { planTotals } from './serialize';

const MEALS = [
  {
    meal_name: 'Café da manhã', horario: '07:00',
    options: [
      { label: 'Opção 1', primary: true, foods: [
        { name: 'Mamão', grams: 400, measure: 'porção (400 g)', calories: 172, protein_g: 2, carbs_g: 43, fat_g: 0 },
        { name: 'Café sem açúcar', grams: 200, measure: '1 xícara (200 ml)', calories: 2, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ] },
      { label: 'Opção 2', primary: false, foods: [
        { name: 'Pão de forma', grams: 75, measure: '3 fatias (75 g)', calories: 200, protein_g: 6, carbs_g: 38, fat_g: 3 },
      ] },
    ],
  },
];

describe('seedCacheFromMeals + enrichAst', () => {
  beforeEach(() => { invoke.mockClear(); from.mockClear(); });

  it('reabre um plano salvo com valores idênticos e sem chamar a IA', async () => {
    const cache = makeEnrichCache();
    seedCacheFromMeals(cache, MEALS);

    // Reabertura: meals → texto (perde macros) → parse → enrich (deve usar o seed).
    const text = mealsToText(MEALS);
    const ast = parseText(text);
    await enrichAst(ast, cache);

    // Opção principal (Opção 1): 172 + 2 = 174 kcal, 43 CHO, 2 PTN, 0 LIP.
    const totals = planTotals(ast);
    expect(totals.kcal).toBe(174);
    expect(totals.cho).toBe(43);
    expect(totals.ptn).toBe(2);

    // Nenhuma chamada de IA nem de banco — plano fixo reutilizado.
    expect(invoke).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('um alimento NOVO (não semeado) dispara a IA', async () => {
    const cache = makeEnrichCache();
    seedCacheFromMeals(cache, MEALS);
    const ast = parseText('@ 10:00 Lanche\nBanana - 100 g');
    await enrichAst(ast, cache);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
