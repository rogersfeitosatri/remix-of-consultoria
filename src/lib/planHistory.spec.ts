import { describe, it, expect } from 'vitest';
import {
  parseRaw, readSavedPlans, countMeals, upsertActivePlan,
  duplicatePlan, markSentToZonaNutri, setActivePlan,
  removeSavedPlan, removeAttachedPlan,
} from './planHistory';

const mp = (n: number) => ({ meals: Array.from({ length: n }, (_, i) => ({ meal_name: `M${i}`, foods: [] })) });

describe('parseRaw', () => {
  it('aceita string JSON e objeto', () => {
    expect(parseRaw('{"a":1}')).toEqual({ a: 1 });
    expect(parseRaw({ a: 1 })).toEqual({ a: 1 });
    expect(parseRaw('nao-json')).toEqual({});
    expect(parseRaw(null)).toEqual({});
  });
});

describe('countMeals', () => {
  it('usa base; se vazia, o máximo das variações', () => {
    expect(countMeals({ meals: [], day_variations: { seg: { meals: [1, 2, 3] } } as any })).toBe(3);
    expect(countMeals(mp(5))).toBe(5);
  });
});

describe('upsertActivePlan', () => {
  it('cria entrada e define ativo; re-salva atualiza a mesma', () => {
    const r1 = upsertActivePlan({}, mp(4));
    expect(r1.raw.saved_plans).toHaveLength(1);
    expect(r1.raw.active_plan_id).toBe(r1.activeId);
    expect(r1.raw.meal_plan.meals).toHaveLength(4);

    const r2 = upsertActivePlan(r1.raw, mp(6));
    expect(r2.raw.saved_plans).toHaveLength(1); // mesma entrada
    expect(r2.raw.saved_plans[0].meal_plan.meals).toHaveLength(6);
  });
});

describe('duplicatePlan', () => {
  it('cria cópia editável não enviada e a torna ativa', () => {
    const base = upsertActivePlan({}, mp(3)).raw;
    base.saved_plans[0].sent_to_zona_nutri = true;
    const dup = duplicatePlan(base, base.saved_plans[0].id)!;
    expect(dup.raw.saved_plans).toHaveLength(2);
    const copy = dup.raw.saved_plans.find((p: any) => p.id === dup.newId);
    expect(copy.sent_to_zona_nutri).toBe(false);
    expect(dup.raw.active_plan_id).toBe(dup.newId);
    expect(copy.label).toMatch(/^Cópia de/);
  });
});

describe('markSentToZonaNutri', () => {
  it('destaca só o ativo e limpa os demais', () => {
    let raw = upsertActivePlan({}, mp(2)).raw;      // p1 ativo
    const dup = duplicatePlan(raw, raw.saved_plans[0].id)!; // p2 ativo
    raw = dup.raw;
    raw = markSentToZonaNutri(raw);                 // marca p2 (ativo)
    const sent = raw.saved_plans.filter((p: any) => p.sent_to_zona_nutri);
    expect(sent).toHaveLength(1);
    expect(sent[0].id).toBe(dup.newId);

    // Ativa e envia o outro → destaque migra, só 1 destacado.
    raw = setActivePlan(raw, raw.saved_plans[0].id)!;
    raw = markSentToZonaNutri(raw);
    const sent2 = raw.saved_plans.filter((p: any) => p.sent_to_zona_nutri);
    expect(sent2).toHaveLength(1);
    expect(sent2[0].id).toBe(raw.saved_plans[0].id);
  });
});

describe('removeSavedPlan', () => {
  it('remove a entrada e reaponta o ativo para a mais recente', () => {
    let raw = upsertActivePlan({}, mp(2)).raw;         // p1 ativo
    const dup = duplicatePlan(raw, raw.saved_plans[0].id)!; // p2 ativo
    raw = dup.raw;
    const p2 = dup.newId;
    raw = removeSavedPlan(raw, p2);                     // remove o ativo
    expect(raw.saved_plans).toHaveLength(1);
    expect(raw.active_plan_id).toBe(raw.saved_plans[0].id);
    expect(raw.meal_plan).toEqual(raw.saved_plans[0].meal_plan);
  });
});

describe('removeAttachedPlan', () => {
  it('remove pelo id', () => {
    const raw = { attached_plans: [{ id: 'a' }, { id: 'b' }] };
    expect(removeAttachedPlan(raw, 'a').attached_plans).toEqual([{ id: 'b' }]);
  });
});

describe('readSavedPlans', () => {
  it('ordena por savedAt desc', () => {
    const raw = { saved_plans: [
      { id: 'a', savedAt: '2026-01-01T00:00:00Z' },
      { id: 'b', savedAt: '2026-02-01T00:00:00Z' },
    ] };
    expect(readSavedPlans(raw).map((p) => p.id)).toEqual(['b', 'a']);
  });
});
