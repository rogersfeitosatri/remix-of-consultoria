/**
 * ETAPA 5B — Central de IA canônica.
 *
 * Registro único das SKILLS oficiais da Central (Plano Alimentar e Análise de
 * Check-in), com os consumidores reais no código, as variáveis realmente
 * injetadas pelas edge functions, a configuração de provider/modelo e as regras
 * de validação/ativação de versões.
 *
 * Funções puras — sem rede, testáveis.
 */

export type AiSkillKey = 'meal_plan_generation' | 'checkin_analysis';

/** Contextos que já existiram na Central e saíram do fluxo ativo. */
export const LEGACY_CONTEXT_KEYS = ['whatsapp_support'] as const;

export interface AiSkillDef {
  key: AiSkillKey;
  label: string;
  description: string;
  /** Edge functions reais que consomem o prompt ativo desta skill. */
  consumers: string[];
  /** Variáveis efetivamente substituídas/injetadas pelas funções. */
  variables: string[];
  provider: 'openai';
  model: string;
  /** Fallbacks reais aplicados pelo aiClient quando o primário falha. */
  fallbackModels: string[];
  maxTokens: number;
  responseFormat: 'json_schema' | 'json_object' | 'text';
  /** Regras fixas do sistema (não editáveis pelo admin) aplicadas na montagem. */
  systemRules: string[];
  /** Contrato de saída esperado. */
  outputContract: string[];
  /** Módulos complementares (apenas Plano Alimentar hoje). */
  hasModules: boolean;
}

export const AI_SKILLS: AiSkillDef[] = [
  {
    key: 'meal_plan_generation',
    label: 'Plano Alimentar',
    description:
      'Prompt-base da geração de planos alimentares. Toda geração produz DRAFT — publicação é sempre humana.',
    consumers: [
      'generate-base-plan',
      'generate-weekly-blueprint',
      'generate-plan-day',
      'audit-meal-plan',
      'update-meal-plan',
      'analyze-athlete',
    ],
    variables: [
      '{{athlete_profile}}',
      '{{anamnese_answers}}',
      '{{target_race}}',
      '{{weight_kg}}',
      '{{training_week}}',
      '{{nutritionist_instructions}}',
    ],
    provider: 'openai',
    model: 'gpt-5.6-luna',
    fallbackModels: ['gemini-2.5-flash', 'gpt-4o'],
    maxTokens: 4000,
    responseFormat: 'json_object',
    systemRules: [
      'A geração nunca publica: o resultado entra como versão draft em meal_plan_versions.',
      'A versão publicada é imutável — alterações criam nova versão.',
      'Módulos obrigatórios ativos são anexados ao prompt-base na ordem canônica.',
    ],
    outputContract: [
      'Estrutura de refeições/opções em JSON conforme o módulo de formato.',
      'Totais e equivalências auditáveis por opção.',
    ],
    hasModules: true,
  },
  {
    key: 'checkin_analysis',
    label: 'Análise de Check-in',
    description:
      'Prompt da análise de check-ins. A IA resume, alerta e sugere — nunca fecha o check-in nem publica feedback.',
    consumers: ['analyze-checkin'],
    variables: [
      '{{athlete_profile}}',
      '{{checkin_answers}}',
      '{{checkin_history}}',
      '{{previous_analyses}}',
      '{{structural_review_context}}',
    ],
    provider: 'openai',
    model: 'gpt-5.6-luna',
    fallbackModels: ['gemini-2.5-flash', 'gpt-4o'],
    maxTokens: 2000,
    responseFormat: 'json_schema',
    systemRules: [
      'A IA não altera o estado da resposta do check-in (nunca marca como revisada/fechada).',
      'Feedback sugerido exige aprovação humana antes do envio.',
      'A IA não conclui revisão estrutural (nutrition_review) nem publica plano.',
      'Respostas devem ser lidas por question_key/metric_key (semântica da Etapa 3C); regex é fallback legado.',
    ],
    outputContract: [
      'summary', 'alerts', 'metrics', 'feedback_suggestion',
      'plan_change_recommended', 'proposed_changes', 'rationale',
    ],
    hasModules: false,
  },
];

export function getSkill(key: string): AiSkillDef | undefined {
  return AI_SKILLS.find((s) => s.key === key);
}

export type PromptVersionStatus = 'draft' | 'active' | 'archived';

export interface PromptVersion {
  id: string;
  user_id: string;
  context_key: string;
  version_number: number;
  prompt_text: string;
  status: PromptVersionStatus;
  change_notes: string | null;
  note: string | null;
  author_name: string | null;
  is_active: boolean;
  activated_at: string | null;
  provider: string | null;
  model: string | null;
  created_at: string;
}

export function activeVersion(versions: PromptVersion[]): PromptVersion | undefined {
  return versions.find((v) => v.status === 'active');
}

export function draftVersions(versions: PromptVersion[]): PromptVersion[] {
  return versions.filter((v) => v.status === 'draft');
}

/** Invariante: nunca pode haver duas versões ativas na mesma skill. */
export function hasSingleActive(versions: PromptVersion[]): boolean {
  return versions.filter((v) => v.status === 'active').length <= 1;
}

const VAR_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function extractVariables(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) out.add(`{{${m[1]}}}`);
  return [...out];
}

/** Variáveis escritas no prompt que a função NUNCA substitui. */
export function unsupportedVariables(skill: AiSkillDef, text: string): string[] {
  const supported = new Set(skill.variables);
  return extractVariables(text).filter((v) => !supported.has(v));
}

export interface ActivationCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Validação obrigatória antes de ativar uma versão. */
export function validateForActivation(
  skill: AiSkillDef,
  promptText: string,
  opts: { missingRequiredModules?: string[] } = {},
): ActivationCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const text = (promptText || '').trim();

  if (!text) errors.push('O prompt está vazio.');
  else if (text.length < 40) errors.push('O prompt é curto demais para ser ativado (mínimo 40 caracteres).');

  const bad = unsupportedVariables(skill, text);
  if (bad.length) errors.push(`Variáveis não suportadas por esta skill: ${bad.join(', ')}.`);

  if (!skill.provider || !skill.model) errors.push('Provider/modelo não configurados para esta skill.');

  const missing = opts.missingRequiredModules ?? [];
  if (skill.hasModules && missing.length) {
    errors.push(`Módulos obrigatórios ausentes/inativos: ${missing.join(', ')}.`);
  }

  if (skill.responseFormat !== 'text' && !/json/i.test(text)) {
    warnings.push('A skill espera saída estruturada e o prompt não menciona JSON.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

export interface DiffLine {
  type: 'same' | 'added' | 'removed';
  text: string;
}

/** Diff de linhas simples (LCS) para revisar mudanças antes de ativar. */
export function diffLines(a: string, b: string): DiffLine[] {
  const A = (a || '').split('\n');
  const B = (b || '').split('\n');
  const n = A.length, m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ type: 'same', text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'removed', text: A[i] }); i++; }
    else { out.push({ type: 'added', text: B[j] }); j++; }
  }
  while (i < n) out.push({ type: 'removed', text: A[i++] });
  while (j < m) out.push({ type: 'added', text: B[j++] });
  return out;
}

export function diffSummary(d: DiffLine[]): { added: number; removed: number } {
  return {
    added: d.filter((l) => l.type === 'added').length,
    removed: d.filter((l) => l.type === 'removed').length,
  };
}

export interface EffectivePromptSection {
  title: string;
  body: string;
  kind: 'base' | 'modules' | 'system_rules' | 'dynamic_context' | 'output';
}

/**
 * Montagem do PROMPT EFETIVO exibido na Central — mesma ordem usada pelas edge
 * functions (base → módulos → regras do sistema → contexto dinâmico → saída).
 */
export function buildEffectivePromptSections(
  skill: AiSkillDef,
  promptText: string,
  moduleBlocks: { title: string; content: string }[] = [],
): EffectivePromptSection[] {
  const sections: EffectivePromptSection[] = [
    { title: 'Prompt base (versão ativa)', body: (promptText || '').trim(), kind: 'base' },
  ];
  if (skill.hasModules) {
    sections.push({
      title: `Módulos aplicados (${moduleBlocks.length})`,
      kind: 'modules',
      body: moduleBlocks.length
        ? moduleBlocks.map((m) => `===== MÓDULO: ${m.title} =====\n${m.content.trim()}`).join('\n\n')
        : '(nenhum módulo ativo)',
    });
  }
  sections.push({ title: 'Regras do sistema (fixas)', kind: 'system_rules', body: skill.systemRules.map((r) => `- ${r}`).join('\n') });
  sections.push({ title: 'Contexto dinâmico injetado', kind: 'dynamic_context', body: skill.variables.map((v) => `- ${v}`).join('\n') });
  sections.push({ title: 'Saída esperada', kind: 'output', body: skill.outputContract.map((o) => `- ${o}`).join('\n') });
  return sections;
}

export function effectivePromptText(sections: EffectivePromptSection[]): string {
  return sections.map((s) => `===== ${s.title.toUpperCase()} =====\n${s.body}`).join('\n\n');
}

/** Hash determinístico (FNV-1a) — mesmo algoritmo do backend. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
