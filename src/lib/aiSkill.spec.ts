import { describe, it, expect } from 'vitest';
import {
  assembleEffectivePrompt, computeReadiness, moduleStatus, hashString,
  SKILL_MODULES, REQUIRED_MODULE_KEYS, type StoredModule,
} from './aiSkill';

const active = (module_key: string, content = 'conteúdo do módulo'): StoredModule => ({
  module_key, content, is_active: true, version_number: 1,
});

function allRequiredActive(): StoredModule[] {
  return REQUIRED_MODULE_KEYS.map((k) => active(k));
}

describe('moduleStatus', () => {
  it('obrigatório ausente → pending', () => {
    const def = SKILL_MODULES.find((m) => m.module_key === 'formato-markdown-plano')!;
    expect(moduleStatus(def, undefined)).toBe('pending');
  });
  it('com conteúdo mas inativo → inactive', () => {
    const def = SKILL_MODULES.find((m) => m.module_key === 'formato-markdown-plano')!;
    expect(moduleStatus(def, { module_key: def.module_key, content: 'x', is_active: false })).toBe('inactive');
  });
  it('ativo com conteúdo → configured', () => {
    const def = SKILL_MODULES.find((m) => m.module_key === 'formato-markdown-plano')!;
    expect(moduleStatus(def, active(def.module_key))).toBe('configured');
  });
});

describe('assembleEffectivePrompt', () => {
  it('inclui módulos obrigatórios ativos e nunca o de PDF', () => {
    const modules = [...allRequiredActive(), active('formato-pdf-importador')];
    const r = assembleEffectivePrompt({ promptText: 'PROMPT', modules });
    expect(r.includedModuleKeys).toEqual(REQUIRED_MODULE_KEYS);
    expect(r.includedModuleKeys).not.toContain('formato-pdf-importador');
    expect(r.text).not.toMatch(/formato-pdf-importador/);
  });
  it('não inclui módulo inativo ou vazio', () => {
    const modules = [active('nutricao-esportiva-funcional'), { module_key: 'periodizacao-ciclo-prova', content: '', is_active: true }];
    const r = assembleEffectivePrompt({ promptText: 'P', modules });
    expect(r.includedModuleKeys).toEqual(['nutricao-esportiva-funcional']);
  });
  it('anexa dados do atleta e instruções', () => {
    const r = assembleEffectivePrompt({ promptText: 'P', modules: allRequiredActive(), athleteBlock: 'ATLETA', nutritionistInstructions: 'FOCO' });
    expect(r.text).toMatch(/DADOS DO ATLETA/);
    expect(r.text).toMatch(/INSTRUÇÕES ADICIONAIS/);
    expect(r.text).toMatch(/ATLETA/);
    expect(r.text).toMatch(/FOCO/);
  });
});

describe('computeReadiness', () => {
  it('não pronta quando falta um módulo obrigatório', () => {
    const modules = allRequiredActive().slice(1); // remove um obrigatório
    const r = computeReadiness('PROMPT', modules);
    expect(r.ready).toBe(false);
    expect(r.missing).toContain(REQUIRED_MODULE_KEYS[0]);
  });
  it('não pronta quando o prompt principal está vazio', () => {
    const r = computeReadiness('   ', allRequiredActive());
    expect(r.ready).toBe(false);
    expect(r.mainLoaded).toBe(false);
  });
  it('pronta quando prompt + todos os módulos obrigatórios ativos', () => {
    const r = computeReadiness('PROMPT', allRequiredActive());
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.effectiveChars).toBeGreaterThan(0);
    expect(r.modules.filter((m) => m.included).map((m) => m.module_key)).toEqual(REQUIRED_MODULE_KEYS);
  });
  it('módulo de PDF nunca conta como incluído nem bloqueia', () => {
    const r = computeReadiness('PROMPT', [...allRequiredActive(), active('formato-pdf-importador')]);
    const pdf = r.modules.find((m) => m.module_key === 'formato-pdf-importador')!;
    expect(pdf.included).toBe(false);
    expect(pdf.required).toBe(false);
    expect(r.ready).toBe(true);
  });
});

describe('hashString', () => {
  it('determinístico e sensível a mudanças', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});
