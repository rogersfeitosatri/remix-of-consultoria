import { describe, it, expect } from 'vitest';
import { canonicalQuestionType, isExtensionType, isVisibleByLogic } from './questionTypes';

describe('taxonomia canônica de tipos (Etapa 3C)', () => {
  it('mapeia tipos legados do Banco de Perguntas', () => {
    expect(canonicalQuestionType('text')).toBe('short_text');
    expect(canonicalQuestionType('textarea')).toBe('long_text');
    expect(canonicalQuestionType('multiple_choice')).toBe('single_select');
    expect(canonicalQuestionType('checkbox')).toBe('multi_select');
  });

  it('mapeia tipos legados de Check-in e Anamnese', () => {
    expect(canonicalQuestionType('short_text')).toBe('short_text');
    expect(canonicalQuestionType('long_text')).toBe('long_text');
    expect(canonicalQuestionType('select')).toBe('single_select');
    expect(canonicalQuestionType('multiselect')).toBe('multi_select');
    expect(canonicalQuestionType('boolean')).toBe('boolean');
    expect(canonicalQuestionType('scale')).toBe('scale');
  });

  it('preserva tipos ricos como extensões formais (não perde renderização)', () => {
    const t = canonicalQuestionType('training_week');
    expect(t).toBe('extension:training_week');
    expect(isExtensionType(t)).toBe(true);
    expect(isExtensionType(canonicalQuestionType('scale'))).toBe(false);
  });

  it('trata tipo ausente sem quebrar', () => {
    expect(canonicalQuestionType(null)).toBe('unknown');
  });
});

describe('lógica condicional por question_key', () => {
  it('usa a chave e não o texto da pergunta', () => {
    const logic = { depends_on: 'did_long_run', operator: 'is_true' as const };
    expect(isVisibleByLogic(logic, { did_long_run: true })).toBe(true);
    expect(isVisibleByLogic(logic, { did_long_run: false })).toBe(false);
  });

  it('renomear o texto da pergunta não quebra a condição', () => {
    const logic = { depends_on: 'energy', operator: 'equals' as const, value: 5 };
    expect(isVisibleByLogic(logic, { energy: 5 })).toBe(true);
  });

  it('sem lógica, a pergunta é sempre visível', () => {
    expect(isVisibleByLogic(null, {})).toBe(true);
  });
});
