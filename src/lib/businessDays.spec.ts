import { describe, it, expect } from 'vitest';
import { isBusinessDay, addBusinessDays, businessDaysBetween, nextBusinessDay, toHolidaySet } from './businessDays';

const holidays = toHolidaySet(['2026-09-07']);

describe('businessDays', () => {
  it('ignora sábado e domingo', () => {
    expect(isBusinessDay(new Date('2026-09-05T12:00:00'))).toBe(false); // sábado
    expect(isBusinessDay(new Date('2026-09-06T12:00:00'))).toBe(false); // domingo
    expect(isBusinessDay(new Date('2026-09-08T12:00:00'))).toBe(true);
  });

  it('ignora feriado cadastrado', () => {
    expect(isBusinessDay(new Date('2026-09-07T12:00:00'), holidays)).toBe(false);
  });

  it('soma dias úteis pulando fim de semana e feriado', () => {
    const r = addBusinessDays(new Date('2026-09-04T12:00:00'), 2, holidays); // sexta + 2
    expect(r.toISOString().slice(0, 10)).toBe('2026-09-09');
  });

  it('conta dias úteis no intervalo', () => {
    expect(businessDaysBetween(new Date('2026-09-04T12:00:00'), new Date('2026-09-11T12:00:00'), holidays)).toBe(4);
  });

  it('próximo dia útil considera o próprio dia', () => {
    expect(nextBusinessDay(new Date('2026-09-08T12:00:00'), holidays).toISOString().slice(0, 10)).toBe('2026-09-08');
    expect(nextBusinessDay(new Date('2026-09-05T12:00:00'), holidays).toISOString().slice(0, 10)).toBe('2026-09-08');
  });
});
