import { describe, it, expect } from 'vitest';
import {
  decideRow,
  consultationNumber,
  WORK_STATES,
  type ConsultationState,
} from './consultationRow';

describe('decideRow', () => {
  it('dá um rótulo e uma ação para cada estado', () => {
    const estados: ConsultationState[] = ['link_pending', 'link_sent', 'no_show', 'booked',
      'awaiting_confirmation', 'completed', 'cancelled', 'first_consult'];
    for (const e of estados) {
      const linha = decideRow(e);
      expect(linha.state).toBe(e);
      expect(linha.label.length).toBeGreaterThan(0);
      expect(linha.action).toBeTruthy();
    }
  });

  it('só pede trabalho quando há trabalho', () => {
    expect(decideRow('link_pending').needsWork).toBe(true);
    expect(decideRow('no_show').needsWork).toBe(true);
    expect(decideRow('awaiting_confirmation').needsWork).toBe(true);
    expect(decideRow('link_sent').needsWork).toBe(false);
    expect(decideRow('booked').needsWork).toBe(false);
    expect(decideRow('completed').needsWork).toBe(false);
    expect(decideRow('cancelled').needsWork).toBe(false);
  });

  it('link enviado não é o mesmo que link pendente', () => {
    expect(decideRow('link_sent').label).not.toBe(decideRow('link_pending').label);
    expect(decideRow('link_sent').action.kind).not.toBe('send');
  });

  it('cancelada não oferece ação', () => {
    expect(decideRow('cancelled').action.kind).toBe('none');
  });

  it('WORK_STATES bate com needsWork, sem repetição', () => {
    expect([...WORK_STATES].sort()).toEqual(['awaiting_confirmation', 'link_pending', 'no_show']);
    expect(new Set(WORK_STATES).size).toBe(WORK_STATES.length);
    for (const e of WORK_STATES) expect(decideRow(e).needsWork).toBe(true);
  });

  it('estado desconhecido não quebra a linha', () => {
    const linha = decideRow('inventado' as ConsultationState);
    expect(linha.label.length).toBeGreaterThan(0);
  });
});

describe('consultationNumber', () => {
  const agendas = [
    { id: 'a', scheduled_date: '2026-01-24' },
    { id: 'b', scheduled_date: '2026-02-28' },
    { id: 'c', scheduled_date: '2026-04-02' },
    { id: 'd', scheduled_date: '2026-06-08' },
    { id: 'e', scheduled_date: '2026-07-18' },
    { id: 'f', scheduled_date: '2026-09-08' },
  ];

  it('conta só a partir do início do ciclo', () => {
    // Ciclo começa em 08/05: contam d, e, f.
    expect(consultationNumber(agendas, 'd', '2026-05-08', 6)).toBe('#1/6');
    expect(consultationNumber(agendas, 'e', '2026-05-08', 6)).toBe('#2/6');
    expect(consultationNumber(agendas, 'f', '2026-05-08', 6)).toBe('#3/6');
  });

  it('sem início de ciclo, conta tudo', () => {
    expect(consultationNumber(agendas, 'a', null, 6)).toBe('#1/6');
    expect(consultationNumber(agendas, 'f', null, 6)).toBe('#6/6');
  });

  it('não produz fração que estoura', () => {
    // Seis agendas no ciclo contra um plano de 4: a sétima não vira "#7/4".
    expect(consultationNumber(agendas, 'e', null, 4)).toBe('#5');
    expect(consultationNumber(agendas, 'f', null, 4)).toBe('#6');
  });

  it('nenhuma fração passa do próprio total, em ciclo nenhum', () => {
    // O caso real: 11 agendas na vida do atleta, plano de 6, e a tela dizia "#9/6".
    const vida = Array.from({ length: 11 }, (_, i) => ({
      id: `s${i}`, scheduled_date: `2026-${String(i + 1).padStart(2, '0')}-08`,
    }));
    for (const agenda of vida) {
      const numero = consultationNumber(vida, agenda.id, '2026-05-08', 6);
      if (numero === null) continue;
      const [posicao, total] = numero.slice(1).split('/');
      if (total !== undefined) expect(Number(posicao)).toBeLessThanOrEqual(Number(total));
    }
  });

  it('sem total do plano, mostra só a posição', () => {
    expect(consultationNumber(agendas, 'b', null, null)).toBe('#2');
    expect(consultationNumber(agendas, 'b', null, 0)).toBe('#2');
  });

  it('agenda que não é do atleta devolve nulo', () => {
    expect(consultationNumber(agendas, 'zzz', null, 6)).toBeNull();
    // Fora do ciclo também sai da contagem.
    expect(consultationNumber(agendas, 'a', '2026-05-08', 6)).toBeNull();
  });

  it('empate de data é resolvido de forma estável', () => {
    const empate = [
      { id: 'y', scheduled_date: '2026-08-13' },
      { id: 'x', scheduled_date: '2026-08-13' },
    ];
    expect(consultationNumber(empate, 'x', null, 4)).toBe('#1/4');
    expect(consultationNumber(empate, 'y', null, 4)).toBe('#2/4');
  });

  it('não altera a lista recebida', () => {
    const copia = agendas.map((a) => ({ ...a }));
    consultationNumber(copia, 'c', null, 6);
    expect(copia.map((a) => a.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});
