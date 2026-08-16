import { describe, it, expect } from 'vitest';
import {
  AI_SKILLS, getSkill, activeVersion, draftVersions, hasSingleActive,
  extractVariables, unsupportedVariables, validateForActivation,
  diffLines, diffSummary, buildEffectivePromptSections, effectivePromptText,
  LEGACY_CONTEXT_KEYS, type PromptVersion,
} from './aiSkills';

const v = (n: number, status: PromptVersion['status'], text = 'x'.repeat(60)): PromptVersion => ({
  id: `v${n}`, user_id: 'u', context_key: 'checkin_analysis', version_number: n,
  prompt_text: text, status, change_notes: null, note: null, author_name: null,
  is_active: status === 'active', activated_at: null, provider: null, model: null,
  created_at: `2026-01-0${n}`,
});

describe('registro de skills', () => {
  it('expõe apenas Plano Alimentar e Análise de Check-in', () => {
    expect(AI_SKILLS.map((s) => s.key)).toEqual(['meal_plan_generation', 'checkin_analysis']);
  });

  it('não expõe o Suporte WhatsApp como skill ativa', () => {
    expect(getSkill('whatsapp_support')).toBeUndefined();
    expect(LEGACY_CONTEXT_KEYS).toContain('whatsapp_support');
  });

  it('lista consumidores reais existentes no código', () => {
    expect(getSkill('checkin_analysis')!.consumers).toEqual(['analyze-checkin']);
    expect(getSkill('meal_plan_generation')!.consumers).toContain('generate-base-plan');
  });
});

describe('versões', () => {
  const versions = [v(3, 'draft'), v(2, 'active'), v(1, 'archived')];

  it('identifica a versão ativa e os drafts', () => {
    expect(activeVersion(versions)!.version_number).toBe(2);
    expect(draftVersions(versions).map((x) => x.version_number)).toEqual([3]);
  });

  it('garante uma única versão ativa', () => {
    expect(hasSingleActive(versions)).toBe(true);
    expect(hasSingleActive([v(1, 'active'), v(2, 'active')])).toBe(false);
  });

  it('draft não é a versão de produção', () => {
    expect(activeVersion(versions)!.status).toBe('active');
    expect(draftVersions(versions)[0].is_active).toBe(false);
  });
});

describe('variáveis', () => {
  it('extrai variáveis do texto', () => {
    expect(extractVariables('oi {{athlete_profile}} e {{ checkin_answers }}'))
      .toEqual(['{{athlete_profile}}', '{{checkin_answers}}']);
  });

  it('detecta variáveis não suportadas', () => {
    const skill = getSkill('checkin_analysis')!;
    expect(unsupportedVariables(skill, 'x {{nao_existe}} {{checkin_answers}}')).toEqual(['{{nao_existe}}']);
  });
});

describe('validação antes de ativar', () => {
  const skill = getSkill('checkin_analysis')!;

  it('bloqueia prompt vazio', () => {
    expect(validateForActivation(skill, '   ').ok).toBe(false);
  });

  it('bloqueia variável inválida', () => {
    const r = validateForActivation(skill, `Analise em json {{invalida}} ${'y'.repeat(60)}`);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch('{{invalida}}');
  });

  it('aprova prompt válido', () => {
    const r = validateForActivation(skill, `Analise o check-in {{checkin_answers}} e devolva json. ${'z'.repeat(60)}`);
    expect(r.ok).toBe(true);
  });

  it('bloqueia módulos obrigatórios faltando no Plano Alimentar', () => {
    const meal = getSkill('meal_plan_generation')!;
    const r = validateForActivation(meal, 'p'.repeat(80), { missingRequiredModules: ['formato-markdown-plano'] });
    expect(r.ok).toBe(false);
  });
});

describe('diff de versões', () => {
  it('mostra linhas adicionadas e removidas', () => {
    const d = diffLines('a\nb\nc', 'a\nx\nc');
    expect(diffSummary(d)).toEqual({ added: 1, removed: 1 });
  });

  it('sem mudanças => sem diff', () => {
    expect(diffSummary(diffLines('a\nb', 'a\nb'))).toEqual({ added: 0, removed: 0 });
  });
});

describe('prompt efetivo', () => {
  it('monta base + módulos + regras + contexto + saída', () => {
    const skill = getSkill('meal_plan_generation')!;
    const s = buildEffectivePromptSections(skill, 'BASE', [{ title: 'Formato', content: 'MD' }]);
    expect(s.map((x) => x.kind)).toEqual(['base', 'modules', 'system_rules', 'dynamic_context', 'output']);
    const text = effectivePromptText(s);
    expect(text).toContain('BASE');
    expect(text).toContain('MÓDULO: Formato');
  });

  it('check-in não tem seção de módulos', () => {
    const s = buildEffectivePromptSections(getSkill('checkin_analysis')!, 'BASE');
    expect(s.some((x) => x.kind === 'modules')).toBe(false);
  });
});
