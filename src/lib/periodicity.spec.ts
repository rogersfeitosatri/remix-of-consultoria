import { describe, it, expect } from 'vitest';
import {
  normalizeCheckinPeriodicity,
  checkinIntervalDays,
  checkinGraceDays,
  consultationCadenceWeeks,
  nextCheckinDate,
  nextConsultationDate,
  isCheckinOverdue,
} from './periodicity';

describe('periodicidade canônica', () => {
  it('normaliza valores desconhecidos para mensal', () => {
    expect(normalizeCheckinPeriodicity('xyz')).toBe('monthly');
    expect(normalizeCheckinPeriodicity(null)).toBe('monthly');
    expect(normalizeCheckinPeriodicity('WEEKLY')).toBe('weekly');
  });

  it('intervalos e tolerâncias', () => {
    expect(checkinIntervalDays('weekly')).toBe(7);
    expect(checkinIntervalDays('biweekly')).toBe(14);
    expect(checkinGraceDays('weekly')).toBe(9);
    expect(checkinGraceDays('quarterly')).toBe(95);
  });

  it('cadência de consultas em semanas', () => {
    expect(consultationCadenceWeeks('monthly')).toBe(4);
    expect(consultationCadenceWeeks('biweekly')).toBe(2);
    expect(consultationCadenceWeeks(6)).toBe(6);
  });

  it('próximas datas', () => {
    expect(nextCheckinDate(new Date('2026-06-01T12:00:00'), 'weekly').toISOString().slice(0, 10)).toBe('2026-06-08');
    expect(nextConsultationDate(new Date('2026-06-01T12:00:00'), 'monthly').toISOString().slice(0, 10)).toBe('2026-06-29');
  });

  it('atraso respeita tolerância', () => {
    const last = new Date('2026-06-01T12:00:00');
    expect(isCheckinOverdue(last, 'weekly', new Date('2026-06-08T12:00:00'))).toBe(false);
    expect(isCheckinOverdue(last, 'weekly', new Date('2026-06-12T12:00:00'))).toBe(true);
  });
});
