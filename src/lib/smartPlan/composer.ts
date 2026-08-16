// Helpers puros do "compositor de alimento" (fluxo guiado: alimento → medida →
// quantidade → confirmar). Ficam separados do componente para poderem ser
// testados sem React.

export interface MeasureChoice {
  /** Identificador estável para o <Select>. */
  key: string;
  /** Rótulo exibido (ex.: "colher de sopa", "unidade média", "g"). */
  label: string;
  /** Peso em gramas de UMA unidade da medida. */
  gramsPerUnit: number;
  /** Medida em g/ml (não usa parênteses no texto final). */
  gramUnit: boolean;
  /** food_measures.id quando veio do banco. */
  measureId?: string | null;
}

/** Medidas caseiras genéricas — usadas quando o alimento não tem medidas no banco. */
export const GENERIC_MEASURES: { name: string; g: number }[] = [
  { name: 'unidade', g: 50 },
  { name: 'fatia', g: 25 },
  { name: 'colher de sopa', g: 15 },
  { name: 'colher de sobremesa', g: 10 },
  { name: 'colher de chá', g: 5 },
  { name: 'xícara', g: 200 },
  { name: 'copo', g: 200 },
  { name: 'concha', g: 80 },
  { name: 'porção', g: 100 },
  { name: 'punhado', g: 30 },
];

export function isGramLabel(label: string): boolean {
  return /^\s*(g|gr|grama|gramas|ml|mls|mililitros?|kg)\s*$/i.test(label || '');
}

/** Remove parênteses e um número inicial que a medida do banco às vezes traz
 *  ("1 unidade média" → "unidade média"), evitando "1 1 unidade". */
export function cleanMeasureLabel(label: string): string {
  return (label || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^\s*\d+(?:[.,]\d+)?(?:\/\d+)?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fmtNum(n: number): string {
  if (!isFinite(n)) return '0';
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
}

/** Gramas totais da porção (quantidade × peso da medida). */
export function totalGrams(quantity: number, measure: MeasureChoice): number {
  const q = Number(quantity);
  if (!isFinite(q) || q <= 0) return 0;
  return Math.round(q * measure.gramsPerUnit * 10) / 10;
}

/**
 * Monta a linha textual do alimento (fonte de verdade do editor).
 * • medida em g/ml → "Nome - 200 g"
 * • medida caseira → "Nome - 2 colher de sopa (30g)"
 * O sufixo "(Xg)" é a autoridade de gramas no cálculo nutricional.
 */
export function buildFoodLine(input: {
  name: string;
  quantity: number;
  measure: MeasureChoice;
}): string {
  const name = (input.name || '').trim();
  const total = totalGrams(input.quantity, input.measure);
  if (input.measure.gramUnit) {
    const unit = /ml/i.test(input.measure.label) ? 'ml' : (/kg/i.test(input.measure.label) ? 'kg' : 'g');
    return `${name} - ${fmtNum(total)} ${unit}`;
  }
  const phrase = cleanMeasureLabel(input.measure.label) || 'porção';
  return `${name} - ${fmtNum(input.quantity)} ${phrase} (${fmtNum(total)}g)`;
}

export interface FoodDraft {
  name: string;
  quantity: number;
  measureLabel: string;
  /** Gramas totais lidos do texto (quando explícitos). */
  grams: number | null;
}

/** Lê de volta uma linha "Nome - 2 colher de sopa (30g)" para edição. */
export function parseFoodLine(line: string): FoodDraft {
  const s = (line || '').trim();
  const div = s.search(/\s+[-–—]\s+|:\s+/);
  if (div < 0) return { name: s, quantity: 1, measureLabel: '', grams: null };
  const name = s.slice(0, div).trim();
  const rest = s.slice(div).replace(/^\s*[-–—:]\s*/, '').trim();
  const gm = rest.match(/\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\)/i);
  const grams = gm ? Number(gm[1].replace(',', '.')) : null;
  const body = rest.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const qm = body.match(/^(\d+(?:[.,]\d+)?)\s*/);
  const quantity = qm ? Number(qm[1].replace(',', '.')) : 1;
  const measureLabel = (qm ? body.slice(qm[0].length) : body).trim();
  return {
    name,
    quantity: isFinite(quantity) && quantity > 0 ? quantity : 1,
    measureLabel,
    grams: grams != null && isFinite(grams) ? grams : (isGramLabel(measureLabel) ? quantity : null),
  };
}

export type ComposerStep = 'food' | 'measure' | 'quantity' | 'ready';

/** Etapa atual do compositor — dirige as mensagens e o comportamento do Enter. */
export function composerStep(state: {
  foodSelected: boolean;
  measureSelected: boolean;
  quantity: number | null;
}): ComposerStep {
  if (!state.foodSelected) return 'food';
  if (!state.measureSelected) return 'measure';
  if (!state.quantity || !isFinite(state.quantity) || state.quantity <= 0) return 'quantity';
  return 'ready';
}

export const STEP_MESSAGE: Record<ComposerStep, string> = {
  food: 'Selecione um alimento',
  measure: 'Escolha uma medida',
  quantity: 'Informe uma quantidade',
  ready: 'Pressione Enter para adicionar',
};
