import { describe, it, expect } from 'vitest';
import {
  foodFromPer100g, sumFoods, perKg, dayPathBounds, summarizePlanBase,
  auditMealOptionsWeekly, auditMealOptionsCarbload, caloriesFromMacros, type Nutrients,
} from './nutritionCalc';

const arroz100 = { calories: 128, protein_g: 2.5, carbs_g: 28, fat_g: 0.2 };

describe('cálculo por alimento e porção', () => {
  it('escala por 100 g', () => {
    const f = foodFromPer100g(arroz100, 150);
    expect(f.carbs_g).toBeCloseTo(42);
    expect(f.calories).toBeCloseTo(192);
  });
  it('soma alimentos', () => {
    const t = sumFoods([foodFromPer100g(arroz100, 100), { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 }]);
    expect(t.calories).toBeCloseTo(293);
    expect(t.protein_g).toBeCloseTo(33.5);
  });
  it('kcal a partir de macros 4/4/9', () => {
    expect(caloriesFromMacros({ calories: 0, protein_g: 10, carbs_g: 20, fat_g: 5 })).toBe(165);
  });
});

describe('g/kg e kcal/kg', () => {
  it('calcula por peso', () => {
    const pk = perKg({ calories: 2100, protein_g: 140, carbs_g: 280, fat_g: 60 }, 70)!;
    expect(pk.cho_gkg).toBeCloseTo(4);
    expect(pk.protein_gkg).toBeCloseTo(2);
    expect(pk.kcal_kg).toBeCloseTo(30);
  });
  it('sem peso → null', () => {
    expect(perKg({ calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1 }, 0)).toBeNull();
  });
});

describe('caminhos de opções (não somar opções juntas)', () => {
  const meals = [
    { name: 'Café', optionTotals: [{ calories: 400, protein_g: 20, carbs_g: 50, fat_g: 10 }, { calories: 440, protein_g: 22, carbs_g: 55, fat_g: 11 }] as Nutrients[] },
    { name: 'Almoço', optionTotals: [{ calories: 600, protein_g: 40, carbs_g: 70, fat_g: 15 }] as Nutrients[] },
  ];
  it('limites mín/máx do dia usam uma opção por refeição', () => {
    const b = dayPathBounds(meals);
    expect(b.min.calories).toBeCloseTo(1000); // 400 + 600
    expect(b.max.calories).toBeCloseTo(1040); // 440 + 600
  });
});

describe('auditoria de equivalência', () => {
  it('bloqueia opções semanais com >10% de diferença calórica', () => {
    const f = auditMealOptionsWeekly('Almoço', [{ calories: 500, protein_g: 0, carbs_g: 0, fat_g: 0 }, { calories: 650, protein_g: 0, carbs_g: 0, fat_g: 0 }]);
    expect(f.some((x) => x.level === 'block')).toBe(true);
  });
  it('opções próximas (<5%) não geram achado', () => {
    const f = auditMealOptionsWeekly('Café', [{ calories: 400, protein_g: 0, carbs_g: 0, fat_g: 0 }, { calories: 412, protein_g: 0, carbs_g: 0, fat_g: 0 }]);
    expect(f.length).toBe(0);
  });
  it('carbload audita CHO (>15% bloqueia)', () => {
    const f = auditMealOptionsCarbload('Jantar', [{ calories: 0, protein_g: 0, carbs_g: 100, fat_g: 0 }, { calories: 0, protein_g: 0, carbs_g: 130, fat_g: 0 }]);
    expect(f.some((x) => x.level === 'block')).toBe(true);
  });
});

describe('summarizePlanBase', () => {
  it('produz totais, g/kg e bloqueio quando dia foge da meta', () => {
    const s = summarizePlanBase({
      meals: [{ name: 'Café', optionTotals: [{ calories: 500, protein_g: 30, carbs_g: 60, fat_g: 12 }] }],
      weightKg: 70, mode: 'weekly', targetKcal: 2000,
    });
    expect(s.totals.calories).toBe(500);
    expect(s.perKg).not.toBeNull();
    expect(s.hasBlock).toBe(true); // 500 muito longe de 2000
  });
});
