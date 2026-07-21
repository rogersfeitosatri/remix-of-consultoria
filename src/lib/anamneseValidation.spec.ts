import { describe, it, expect } from 'vitest';
import { firstMissing, isPhoneComplete, isPhoneLike, isBlankValue } from './anamneseValidation';

describe('isBlankValue', () => {
  it('trata vazios, arrays e objetos', () => {
    expect(isBlankValue('')).toBe(true);
    expect(isBlankValue(null)).toBe(true);
    expect(isBlankValue([])).toBe(true);
    expect(isBlankValue([''])).toBe(true);
    expect(isBlankValue({})).toBe(true);
    expect(isBlankValue({ a: '', b: [] })).toBe(true);
    expect(isBlankValue('x')).toBe(false);
    expect(isBlankValue(0)).toBe(false);
    expect(isBlankValue(['a'])).toBe(false);
  });
});

describe('isPhoneComplete', () => {
  it('exige DDI + DDD + número', () => {
    expect(isPhoneComplete('+55 (11) 99999-9999')).toBe(true);
    expect(isPhoneComplete('+55 11 999999999')).toBe(true);
    expect(isPhoneComplete('+55 (11) 9999')).toBe(false); // número curto
    expect(isPhoneComplete('99999-9999')).toBe(false);     // sem DDI
    expect(isPhoneComplete('+55')).toBe(false);            // só DDI
    expect(isPhoneComplete('')).toBe(false);
  });
});

describe('isPhoneLike', () => {
  it('detecta por tipo ou texto', () => {
    expect(isPhoneLike('Qual seu WhatsApp?', 'text')).toBe(true);
    expect(isPhoneLike('Telefone de contato', 'text')).toBe(true);
    expect(isPhoneLike(undefined, 'phone')).toBe(true);
    expect(isPhoneLike('Nome completo', 'text')).toBe(false);
  });
});

describe('firstMissing', () => {
  it('bloqueia pergunta obrigatória vazia', () => {
    const q = { question_type: 'text', question_text: 'Nome', is_required: true };
    expect(firstMissing(q, '')).toBe('Nome');
    expect(firstMissing(q, 'João')).toBeNull();
  });

  it('não bloqueia pergunta opcional', () => {
    const q = { question_type: 'text', question_text: 'Obs', is_required: false };
    expect(firstMissing(q, '')).toBeNull();
  });

  it('telefone obrigatório exige DDI+DDD+número', () => {
    const q = { question_type: 'text', question_text: 'Seu WhatsApp', is_required: true };
    expect(firstMissing(q, '')).toBe('Seu WhatsApp');
    expect(firstMissing(q, '99999-9999')).toBe('Seu WhatsApp');
    expect(firstMissing(q, '+55 (11) 99999-9999')).toBeNull();
  });

  it('field_group: enforce sub-campo obrigatório mesmo com irmão preenchido', () => {
    const q = {
      question_type: 'field_group',
      question_text: 'Objetivos',
      is_required: true,
      config: { fields: [
        { key: 'selecionados', label: 'Objetivos', required: true },
        { key: 'prioritario', label: 'Prioritário', required: true },
      ] },
    };
    // Só um sub-campo preenchido → ainda falta o outro.
    expect(firstMissing(q, { selecionados: ['Emagrecer'] })).toBe('Prioritário');
    expect(firstMissing(q, { selecionados: ['Emagrecer'], prioritario: 'Emagrecer' })).toBeNull();
  });

  it('field_group opcional intacto não bloqueia, mas engajado exige required', () => {
    const q = {
      question_type: 'field_group',
      question_text: 'Mudança de peso',
      is_required: false,
      config: { fields: [
        { key: 'mudanca', label: 'O que ocorreu?', required: true },
        { key: 'obs', label: 'Obs', required: false },
      ] },
    };
    expect(firstMissing(q, {})).toBeNull();                 // intacto
    expect(firstMissing(q, { obs: 'algo' })).toBe('O que ocorreu?'); // engajado
  });
});
