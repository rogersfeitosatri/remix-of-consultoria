import { describe, it, expect } from 'vitest';
import {
  computeCarbloadDays, decideCarbloadDays, computePhase, daysToRace, buildPlanV2View,
  DEFAULT_CARBLOAD_RULES, type PlanV2Stored,
} from './planV2';

// Cobre os cenários de aceite (parte determinística — sem IA).

describe('carbload: dias calculados por regra', () => {
  it('1) longão no domingo, 1 dia → sábado', () => {
    expect(computeCarbloadDays('sunday', 1)).toEqual(['saturday']);
  });
  it('2) longão no domingo, 2 dias → sexta e sábado', () => {
    expect(computeCarbloadDays('sunday', 2)).toEqual(['friday', 'saturday']);
  });
  it('3) longão no sábado, 1 dia → sexta', () => {
    expect(computeCarbloadDays('saturday', 1)).toEqual(['friday']);
  });
  it('longão no sábado, 2 dias → quinta e sexta', () => {
    expect(computeCarbloadDays('saturday', 2)).toEqual(['thursday', 'friday']);
  });
  it('sem longão → vazio', () => {
    expect(computeCarbloadDays(null, 1)).toEqual([]);
  });
});

describe('decisão de 1 ou 2 dias', () => {
  it('5) baixa energia + boa tolerância (escalate) → 2 dias', () => {
    const r = decideCarbloadDays(DEFAULT_CARBLOAD_RULES, { escalate: true });
    expect(r.days).toBe(2);
    expect(r.reasonCodes).toContain('CHECKIN_ESCALATION');
  });
  it('6) estufamento/GI (block) → mantém 1 dia', () => {
    const r = decideCarbloadDays(DEFAULT_CARBLOAD_RULES, { block: true, escalate: true });
    expect(r.days).toBe(1);
  });
  it('fase específica → 2 dias', () => {
    const r = decideCarbloadDays(DEFAULT_CARBLOAD_RULES, { phase: 'specific' });
    expect(r.days).toBe(2);
  });
});

describe('fase da prova', () => {
  it('11) recalcula fase a partir de daysToRace', () => {
    expect(computePhase(3)).toBe('race_week');
    expect(computePhase(14)).toBe('taper');
    expect(computePhase(40)).toBe('specific');
    expect(computePhase(90)).toBe('build');
    expect(computePhase(200)).toBe('base');
    expect(computePhase(null)).toBe('unknown');
  });
  it('daysToRace calcula corretamente', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(daysToRace('2026-01-11', now)).toBe(10);
    expect(daysToRace(null, now)).toBe(null);
  });
});

const stored: PlanV2Stored = {
  planModelVersion: 2,
  basePlan: { planVersion: 2, meals: [{ id: 'breakfast', name: 'Café', defaultTime: '07:00', mainOption: { foods: [] }, substitutions: [], generalInstructions: [] }], carbBlocks: [] },
  inputs: {
    longRunWeekday: 'sunday',
    trainingWeek: { 'Domingo': [{ modalidade: 'corrida', turno: 'manha', intensidade: 'intenso', longao: true }] },
    raceDate: null,
  },
};

describe('composer buildPlanV2View', () => {
  it('4) muda o dia do longão → recalcula carbload sem IA', () => {
    const dom = buildPlanV2View(stored);
    expect(dom.carbload.appliesOn).toEqual(['saturday']);
    const sab = buildPlanV2View({ ...stored, inputs: { ...stored.inputs, longRunWeekday: 'saturday' } });
    expect(sab.carbload.appliesOn).toEqual(['friday']);
  });
  it('override do check-in (2 dias) recalcula os dias', () => {
    const v = buildPlanV2View({ ...stored, carbloadOverride: { numberOfDays: 2 } });
    expect(v.carbload.numberOfDays).toBe(2);
    expect(v.carbload.appliesOn).toEqual(['friday', 'saturday']);
  });
  it('7) sem sinais → mantém protocolo (sem override)', () => {
    const v = buildPlanV2View(stored);
    expect(v.carbload.numberOfDays).toBe(1);
  });
  it('12) semana sem longão → sem carbload, sem erro', () => {
    const v = buildPlanV2View({ ...stored, inputs: { ...stored.inputs, longRunWeekday: null } });
    expect(v.carbload.appliesOn).toEqual([]);
    expect(v.weekMap.length).toBe(7);
  });
});
