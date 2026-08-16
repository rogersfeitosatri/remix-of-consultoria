/**
 * ETAPA 3C — Taxonomia canônica de tipos de pergunta.
 *
 * Antes existiam três enumerações incompatíveis (Banco de Perguntas, Check-in,
 * Anamnese). Aqui elas convergem para UM vocabulário. Os tipos legados continuam
 * sendo aceitos e renderizados: nada é convertido destrutivamente — o tipo legado
 * permanece armazenado e o canônico é derivado.
 */

export const CANONICAL_QUESTION_TYPES = [
  'short_text',
  'long_text',
  'number',
  'single_select',
  'multi_select',
  'scale',
  'boolean',
  'date',
  'time',
  'info',
] as const;

export type CanonicalQuestionType = (typeof CANONICAL_QUESTION_TYPES)[number];

/** Tipos ricos da Anamnese Completa entram como extensões formais da taxonomia. */
export type QuestionTypeToken = CanonicalQuestionType | `extension:${string}` | 'unknown';

const MAP: Record<string, CanonicalQuestionType> = {
  text: 'short_text',
  short_text: 'short_text',
  textarea: 'long_text',
  long_text: 'long_text',
  number: 'number',
  multiple_choice: 'single_select',
  select: 'single_select',
  radio: 'single_select',
  single_select: 'single_select',
  checkbox: 'multi_select',
  multiselect: 'multi_select',
  multi_select: 'multi_select',
  scale: 'scale',
  symptom_scale: 'scale',
  boolean: 'boolean',
  date: 'date',
  time: 'time',
  info: 'info',
};

/** Converte qualquer tipo legado no token canônico (espelha canonical_question_type no banco). */
export function canonicalQuestionType(legacyType: string | null | undefined): QuestionTypeToken {
  const t = (legacyType ?? '').toLowerCase().trim();
  if (!t) return 'unknown';
  return MAP[t] ?? (`extension:${t}` as QuestionTypeToken);
}

export function isExtensionType(token: QuestionTypeToken): boolean {
  return token.startsWith('extension:');
}

export const CANONICAL_TYPE_LABELS: Record<CanonicalQuestionType, string> = {
  short_text: 'Texto curto',
  long_text: 'Texto longo',
  number: 'Número',
  single_select: 'Escolha única',
  multi_select: 'Múltipla escolha',
  scale: 'Escala',
  boolean: 'Sim / Não',
  date: 'Data',
  time: 'Hora',
  info: 'Bloco informativo',
};

/** Domínios semânticos sugeridos para metadados de pergunta. */
export const QUESTION_DOMAINS = [
  { value: 'anthropometry', label: 'Antropometria' },
  { value: 'wellbeing', label: 'Bem-estar' },
  { value: 'training', label: 'Treino' },
  { value: 'nutrition', label: 'Alimentação' },
  { value: 'sleep', label: 'Sono' },
  { value: 'gi', label: 'Gastrointestinal' },
  { value: 'health', label: 'Saúde' },
  { value: 'behavior', label: 'Comportamento' },
  { value: 'other', label: 'Outros' },
] as const;

export interface SemanticQuestionMeta {
  question_key?: string | null;
  metric_key?: string | null;
  domain?: string | null;
  unit?: string | null;
  canonical_type?: string | null;
  is_adjustment_trigger?: boolean | null;
  conditional_logic?: ConditionalLogic | null;
}

export interface ConditionalLogic {
  depends_on: string;
  operator: 'equals' | 'not_equals' | 'gt' | 'lt' | 'includes' | 'is_true' | 'is_false';
  value?: unknown;
}

/**
 * Avalia visibilidade por question_key (nunca por regex de texto).
 * `answersByKey` é o mapa question_key -> resposta.
 */
export function isVisibleByLogic(
  logic: ConditionalLogic | null | undefined,
  answersByKey: Record<string, unknown>,
): boolean {
  if (!logic?.depends_on) return true;
  const current = answersByKey[logic.depends_on];
  switch (logic.operator) {
    case 'equals':
      return String(current ?? '') === String(logic.value ?? '');
    case 'not_equals':
      return String(current ?? '') !== String(logic.value ?? '');
    case 'gt':
      return Number(current) > Number(logic.value);
    case 'lt':
      return Number(current) < Number(logic.value);
    case 'includes':
      return Array.isArray(current) && current.map(String).includes(String(logic.value));
    case 'is_true':
      return current === true || current === 'true' || current === 'Sim';
    case 'is_false':
      return current === false || current === 'false' || current === 'Não';
    default:
      return true;
  }
}
