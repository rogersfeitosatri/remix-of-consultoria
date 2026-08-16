import { describe, it, expect } from 'vitest';
import { isQuestionVisibleSemantic } from './conditionalVisibility';

const trigger = {
  id: 'q-trigger',
  question_text: 'Você realizou um treino longo essa semana (corrida/endurance)?',
  question_key: 'did_long_run',
  conditional_logic: null,
};
const dependent = {
  id: 'q-dep',
  question_text: 'Como se sentiu durante o treino longo?',
  question_key: null,
  conditional_logic: { depends_on: 'did_long_run', operator: 'equals' as const, value: 'Sim' },
};
const legacyDependent = {
  id: 'q-legacy',
  question_text: 'Como avaliaria o uso da suplementação (pré, intra ou pós) nesse treino?',
  question_key: null,
  conditional_logic: null,
};
const neutral = {
  id: 'q-neutral',
  question_text: 'Qual foi o seu peso em jejum mais recente?',
  question_key: null,
  conditional_logic: null,
};

const all = [trigger, dependent, legacyDependent, neutral];

describe('isQuestionVisibleSemantic', () => {
  it('sempre mostra o gatilho e perguntas neutras', () => {
    expect(isQuestionVisibleSemantic(trigger, all, {})).toBe(true);
    expect(isQuestionVisibleSemantic(neutral, all, {})).toBe(true);
  });

  it('esconde dependente com conditional_logic quando resposta é Não', () => {
    expect(isQuestionVisibleSemantic(dependent, all, { 'q-trigger': 'Não' })).toBe(false);
    expect(isQuestionVisibleSemantic(dependent, all, { 'q-trigger': 'Sim' })).toBe(true);
  });

  it('aceita value booleano', () => {
    const q = { ...dependent, conditional_logic: { depends_on: 'did_long_run', value: true } };
    expect(isQuestionVisibleSemantic(q, all, { 'q-trigger': 'Sim' })).toBe(true);
    expect(isQuestionVisibleSemantic(q, all, { 'q-trigger': 'Não' })).toBe(false);
  });

  it('usa fallback legado apenas quando não há metadado', () => {
    expect(isQuestionVisibleSemantic(legacyDependent, all, { 'q-trigger': 'Não' })).toBe(false);
    expect(isQuestionVisibleSemantic(legacyDependent, all, { 'q-trigger': 'Sim' })).toBe(true);
  });

  it('não esconde quando a pergunta de origem não existe na versão', () => {
    expect(isQuestionVisibleSemantic(dependent, [dependent], {})).toBe(true);
  });
});
