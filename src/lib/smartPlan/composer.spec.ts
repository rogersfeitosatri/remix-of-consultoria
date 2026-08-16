import { describe, it, expect } from 'vitest';
import {
  buildFoodLine,
  parseFoodLine,
  cleanMeasureLabel,
  composerStep,
  totalGrams,
  type MeasureChoice,
} from './composer';

const gram = (g = 1): MeasureChoice => ({ key: 'g', label: 'g', gramsPerUnit: g, gramUnit: true });
const spoon: MeasureChoice = { key: 's', label: '1 colher de sopa (15 g)', gramsPerUnit: 15, gramUnit: false };
const unit: MeasureChoice = { key: 'u', label: 'unidade', gramsPerUnit: 120, gramUnit: false };

describe('composer', () => {
  it('mantém gramas escolhidas ("200 g" continua 200 g)', () => {
    const line = buildFoodLine({ name: 'Arroz', quantity: 200, measure: gram(1) });
    expect(line).toBe('Arroz - 200 g');
    const back = parseFoodLine(line);
    expect(back.name).toBe('Arroz');
    expect(back.grams).toBe(200);
  });

  it('mantém a medida caseira escolhida e grava as gramas equivalentes', () => {
    const line = buildFoodLine({ name: 'Banana', quantity: 1, measure: unit });
    expect(line).toBe('Banana - 1 unidade (120g)');
    const back = parseFoodLine(line);
    expect(back.measureLabel).toBe('unidade');
    expect(back.quantity).toBe(1);
    expect(back.grams).toBe(120);
  });

  it('não duplica o número embutido na medida do banco', () => {
    expect(cleanMeasureLabel('1 colher de sopa (15 g)')).toBe('colher de sopa');
    expect(buildFoodLine({ name: 'Aveia', quantity: 2, measure: spoon })).toBe('Aveia - 2 colher de sopa (30g)');
  });

  it('recalcula as gramas ao mudar a quantidade', () => {
    expect(totalGrams(3, spoon)).toBe(45);
    expect(buildFoodLine({ name: 'Aveia', quantity: 3, measure: spoon })).toBe('Aveia - 3 colher de sopa (45g)');
  });

  it('aceita quantidade decimal com vírgula na volta', () => {
    const line = buildFoodLine({ name: 'Pão', quantity: 1.5, measure: unit });
    expect(line).toBe('Pão - 1,5 unidade (180g)');
    expect(parseFoodLine(line).quantity).toBe(1.5);
  });

  it('define a etapa correta do fluxo (Enter)', () => {
    expect(composerStep({ foodSelected: false, measureSelected: false, quantity: null })).toBe('food');
    expect(composerStep({ foodSelected: true, measureSelected: false, quantity: 1 })).toBe('measure');
    expect(composerStep({ foodSelected: true, measureSelected: true, quantity: 0 })).toBe('quantity');
    expect(composerStep({ foodSelected: true, measureSelected: true, quantity: 2 })).toBe('ready');
  });

  it('lê linha sem medida sem quebrar', () => {
    const d = parseFoodLine('Salada à vontade');
    expect(d.name).toBe('Salada à vontade');
    expect(d.quantity).toBe(1);
  });
});
