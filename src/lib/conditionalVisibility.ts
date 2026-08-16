/**
 * ETAPA 3C — Resolução semântica de visibilidade condicional.
 *
 * Ordem de resolução (key-first):
 *  1. `conditional_logic` explícita (novo modelo canônico)
 *  2. `question_key` / metadados semânticos
 *  3. fallback textual legado (regex) — apenas para perguntas ainda não migradas
 *
 * O fallback legado é registrado de forma diagnóstica para sabermos
 * quantos formulários/versões ainda dependem dele.
 */

export interface ConditionalLogic {
  depends_on: string; // question_key da pergunta de origem
  operator?: 'equals' | 'not_equals' | 'in' | 'answered';
  value?: any;
}

export interface SemanticQuestion {
  id: string;
  question_text: string;
  question_key?: string | null;
  conditional_logic?: ConditionalLogic | null;
}

/** Fallback legado (somente perguntas sem metadado semântico). */
export const LEGACY_LONG_TRAINING_TRIGGER_PATTERN =
  /realizou.*treino.*longo|treino.*longo.*semana/i;
export const LEGACY_LONG_TRAINING_DEPENDENT_PATTERNS = [
  /como.*sentiu.*treino.*longo/i,
  /suplementação.*treino/i,
];

export const LONG_RUN_KEY = 'did_long_run';

export interface LegacyFallbackEvent {
  event: 'legacy_conditional_fallback_used';
  form_id: string | null;
  form_version_id: string | null;
  question_id: string;
  question_text: string;
}

export function logLegacyConditionalFallback(evt: Omit<LegacyFallbackEvent, 'event'>) {
  // Diagnóstico apenas — nenhum alerta ao usuário.
  // eslint-disable-next-line no-console
  console.info('[diagnostic] legacy_conditional_fallback_used', {
    event: 'legacy_conditional_fallback_used',
    ...evt,
  });
}

function isTruthyAnswer(v: any): boolean {
  if (v === true) return true;
  if (typeof v === 'string') return ['sim', 'true', 'yes'].includes(v.trim().toLowerCase());
  return false;
}

function matchesValue(answer: any, logic: ConditionalLogic): boolean {
  const op = logic.operator ?? 'equals';
  switch (op) {
    case 'answered':
      return answer !== undefined && answer !== null && answer !== '';
    case 'not_equals':
      return String(answer) !== String(logic.value);
    case 'in':
      return Array.isArray(logic.value) && logic.value.some((v) => String(v) === String(answer));
    case 'equals':
    default:
      if (typeof logic.value === 'boolean') {
        return logic.value ? isTruthyAnswer(answer) : !isTruthyAnswer(answer);
      }
      return String(answer) === String(logic.value);
  }
}

export interface VisibilityContext {
  formId?: string | null;
  formVersionId?: string | null;
}

/**
 * Decide se uma pergunta deve ser exibida.
 */
export function isQuestionVisibleSemantic<T extends SemanticQuestion>(
  question: T,
  allQuestions: T[],
  answers: Record<string, any>,
  ctx: VisibilityContext = {},
): boolean {
  // 1. conditional_logic explícita
  const logic = question.conditional_logic;
  if (logic && logic.depends_on) {
    const source = allQuestions.find((q) => q.question_key === logic.depends_on);
    if (!source) return true; // pergunta de origem ausente nesta versão → não esconder
    return matchesValue(answers[source.id], logic);
  }

  // 2. metadado semântico próprio (gatilhos nunca são ocultados)
  if (question.question_key) return true;

  // 3. fallback textual legado
  const isLegacyDependent = LEGACY_LONG_TRAINING_DEPENDENT_PATTERNS.some((p) =>
    p.test(question.question_text),
  );
  if (!isLegacyDependent) return true;

  logLegacyConditionalFallback({
    form_id: ctx.formId ?? null,
    form_version_id: ctx.formVersionId ?? null,
    question_id: question.id,
    question_text: question.question_text,
  });

  const trigger =
    allQuestions.find((q) => q.question_key === LONG_RUN_KEY) ??
    allQuestions.find((q) => LEGACY_LONG_TRAINING_TRIGGER_PATTERN.test(q.question_text));

  if (!trigger) return true;
  return isTruthyAnswer(answers[trigger.id]);
}
