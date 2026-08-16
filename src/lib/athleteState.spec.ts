import { describe, it, expect } from 'vitest';
import { getAthleteState, isOperationalAthlete, filterOperational } from './athleteState';

const today = new Date('2026-06-15T12:00:00Z');

describe('athleteState (regra canônica)', () => {
  it('atleta ativo dentro da vigência é operacional', () => {
    const s = getAthleteState({ is_active: true, end_date: '2026-12-31', has_checkin: true, service_type: 'nutrition' }, today);
    expect(s.isOperational).toBe(true);
    expect(s.canReceiveCheckins).toBe(true);
    expect(s.blockedReasons).toEqual([]);
  });

  it('congelado nunca é operacional', () => {
    const s = getAthleteState({ is_active: true, is_frozen: true, end_date: '2026-12-31', has_checkin: true }, today);
    expect(s.isOperational).toBe(false);
    expect(s.canReceiveCheckins).toBe(false);
    expect(s.blockedReasons).toContain('Plano congelado');
  });

  it('plano vencido encerra a operação', () => {
    const s = getAthleteState({ is_active: true, end_date: '2026-05-01' }, today);
    expect(s.isEnded).toBe(true);
    expect(s.isOperational).toBe(false);
  });

  it('arquivado sai das filas mas mantém histórico', () => {
    const s = getAthleteState({ is_active: true, archived_at: '2026-03-01T00:00:00Z', end_date: '2026-12-31' }, today);
    expect(s.isArchived).toBe(true);
    expect(s.canAppearInOperationalQueues).toBe(false);
  });

  it('aguardando anamnese é pendência, não status principal', () => {
    const s = getAthleteState({ is_active: true, athlete_status: 'pending_anamnese', end_date: '2026-12-31' }, today);
    expect(s.isInOnboarding).toBe(true);
    expect(s.isOperational).toBe(true);
  });

  it('filtra coleções', () => {
    const list = [
      { id: 'a', is_active: true, end_date: '2026-12-31' },
      { id: 'b', is_active: true, is_frozen: true, end_date: '2026-12-31' },
      { id: 'c', is_active: false, end_date: '2026-12-31' },
    ];
    expect(filterOperational(list, today).map((c) => c.id)).toEqual(['a']);
    expect(isOperationalAthlete(list[1], today)).toBe(false);
  });
});
