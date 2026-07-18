// Habilidade "Plano alimentar" da Central de IA: definição dos módulos,
// verificação de prontidão, montagem do prompt efetivo e hash do pacote.
// Funções puras (testáveis) — sem dependência de rede.

export const MEAL_PLAN_SKILL_KEY = 'meal_plan_generation';

export interface SkillModuleDef {
  module_key: string;
  title: string;
  required: boolean;
  // Descrição curta do papel do módulo (para a UI).
  role: string;
}

// Módulos referenciados pelo prompt. O de PDF entra como NÃO obrigatório e não
// é carregado na geração (esta etapa é Markdown-only).
export const SKILL_MODULES: SkillModuleDef[] = [
  { module_key: 'nutricao-esportiva-funcional', title: 'Nutrição esportiva funcional', required: true, role: 'Sinais, sintomas, saúde GI, micronutrientes e oportunidades funcionais.' },
  { module_key: 'periodizacao-ciclo-prova', title: 'Periodização e ciclo até a prova', required: true, role: 'Fases do ciclo, semanas restantes e ajustes por fase.' },
  { module_key: 'formato-markdown-plano', title: 'Formato Markdown do plano', required: true, role: 'Cabeçalho, títulos sem #, bullets e substituições — saída final.' },
  { module_key: 'auditoria-equivalencia-opcoes', title: 'Auditoria e equivalência de opções', required: true, role: 'Tolerâncias entre opções e fechamento do dia.' },
  { module_key: 'formato-pdf-importador', title: 'Formato PDF (desativado nesta etapa)', required: false, role: 'Saída em PDF — NÃO usada; mantida apenas como referência futura.' },
];

export const REQUIRED_MODULE_KEYS = SKILL_MODULES.filter((m) => m.required).map((m) => m.module_key);

export type ModuleStatus = 'configured' | 'pending' | 'inactive' | 'update_available' | 'error';

export interface StoredModule {
  module_key: string;
  title?: string | null;
  content?: string | null;
  is_active?: boolean | null;
  required?: boolean | null;
  version_number?: number | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

// Status de um módulo a partir da linha armazenada (ou ausência dela).
export function moduleStatus(def: SkillModuleDef, stored: StoredModule | undefined): ModuleStatus {
  if (!stored) return def.required ? 'pending' : 'inactive';
  const hasContent = !!(stored.content && stored.content.trim().length > 0);
  if (!hasContent) return def.required ? 'pending' : 'inactive';
  if (!stored.is_active) return 'inactive';
  return 'configured';
}

export interface ModuleReport {
  module_key: string;
  title: string;
  required: boolean;
  status: ModuleStatus;
  version_number: number | null;
  chars: number;
  included: boolean; // realmente incluído no prompt efetivo
}

export interface Readiness {
  ready: boolean;
  mainLoaded: boolean;
  promptChars: number;
  missing: string[];          // module_keys obrigatórios faltando/inativos
  modules: ModuleReport[];
  effectiveChars: number;
  effectiveHash: string;
}

// Hash determinístico (FNV-1a 32-bit em hex) — sem dependência de crypto.
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface AssembleInput {
  promptText: string;
  modules: StoredModule[];               // linhas armazenadas (qualquer status)
  athleteBlock?: string;                 // dados estruturados da anamnese/atleta
  nutritionistInstructions?: string;     // instruções adicionais desta geração
}

// Monta o prompt efetivo: prompt principal + módulos obrigatórios ATIVOS (na
// ordem canônica) + dados do atleta + instruções. Só entram módulos com
// conteúdo e ativos; o módulo de PDF nunca entra.
export function assembleEffectivePrompt(input: AssembleInput): { text: string; includedModuleKeys: string[] } {
  const byKey = new Map(input.modules.map((m) => [m.module_key, m]));
  const parts: string[] = [input.promptText.trim()];
  const included: string[] = [];

  for (const def of SKILL_MODULES) {
    if (!def.required) continue; // pdf-importador nunca é incluído
    const stored = byKey.get(def.module_key);
    if (!stored) continue;
    const content = (stored.content || '').trim();
    if (!content || !stored.is_active) continue;
    parts.push(`\n\n===== MÓDULO: ${def.title} (references/${def.module_key}.md) =====\n${content}`);
    included.push(def.module_key);
  }

  if (input.athleteBlock && input.athleteBlock.trim()) {
    parts.push(`\n\n===== DADOS DO ATLETA (estruturado) =====\n${input.athleteBlock.trim()}`);
  }
  if (input.nutritionistInstructions && input.nutritionistInstructions.trim()) {
    parts.push(`\n\n===== INSTRUÇÕES ADICIONAIS DO NUTRICIONISTA =====\n${input.nutritionistInstructions.trim()}`);
  }
  return { text: parts.join(''), includedModuleKeys: included };
}

// Avalia a prontidão da habilidade e produz o relatório de validação.
export function computeReadiness(promptText: string, modules: StoredModule[]): Readiness {
  const byKey = new Map(modules.map((m) => [m.module_key, m]));
  const mainLoaded = !!(promptText && promptText.trim().length > 0);
  const assembled = assembleEffectivePrompt({ promptText: promptText || '', modules });
  const includedSet = new Set(assembled.includedModuleKeys);

  const reports: ModuleReport[] = SKILL_MODULES.map((def) => {
    const stored = byKey.get(def.module_key);
    const status = moduleStatus(def, stored);
    return {
      module_key: def.module_key,
      title: def.title,
      required: def.required,
      status,
      version_number: stored?.version_number ?? null,
      chars: (stored?.content || '').trim().length,
      included: includedSet.has(def.module_key),
    };
  });

  const missing = SKILL_MODULES
    .filter((d) => d.required && !includedSet.has(d.module_key))
    .map((d) => d.module_key);

  const ready = mainLoaded && missing.length === 0;
  return {
    ready,
    mainLoaded,
    promptChars: (promptText || '').trim().length,
    missing,
    modules: reports,
    effectiveChars: assembled.text.length,
    effectiveHash: hashString(assembled.text),
  };
}
