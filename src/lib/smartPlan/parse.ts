// Parser tolerante: texto plano → PlanAst.
// - Uma linha começando com HH:MM ou reconhecível como título abre um bloco de refeição.
// - Cada linha subsequente vira um GroupLine (linha vazia é ignorada).
// - Dentro da linha, "ou" (case-insensitive), "/", "ou então", "substituir por"
//   separam alimento principal das substituições.
// - Dentro do token, "-", "—", ":" ou espaço numérico separam nome e quantidade.

import type { PlanAst, MealBlock, GroupLine, FoodToken } from './ast';

const TIME_RE = /(\d{1,2})[:hH](\d{2})?/;
const SUBST_SPLIT = /\s+ou(?:\s+então)?\s+|\s+\/\s+|\s+substituir\s+por\s+/i;

function extractTime(s: string): { time: string | null; rest: string } {
  const m = s.match(TIME_RE);
  if (!m) return { time: null, rest: s };
  const h = String(Math.min(23, parseInt(m[1], 10) || 0)).padStart(2, '0');
  const mm = String(Math.min(59, parseInt(m[2] || '0', 10) || 0)).padStart(2, '0');
  const rest = (s.slice(0, m.index!) + s.slice(m.index! + m[0].length))
    .replace(/^[\s—\-:·•]+|[\s—\-:·•]+$/g, '')
    .trim();
  return { time: `${h}:${mm}`, rest };
}

/** Detecta título de refeição: linha começa com hora OU é curta e não tem separador. */
export function looksLikeMealTitle(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (TIME_RE.test(t)) {
    // se tem hora + palavras (mesmo poucas), é título
    const nonTime = t.replace(TIME_RE, '').replace(/[—\-:·•]/g, '').trim();
    if (nonTime.length >= 3) return true;
    return false;
  }
  // Sem hora: heurística de palavras conhecidas.
  const lower = t.toLowerCase();
  const meals = [
    'café', 'cafe', 'lanche', 'almoço', 'almoco', 'jantar', 'ceia', 'brunch',
    'pré-treino', 'pre-treino', 'pré treino', 'pre treino',
    'pós-treino', 'pos-treino', 'pós treino', 'pos treino',
    'refeição', 'refeicao',
  ];
  return meals.some((m) => lower.startsWith(m));
}

const QTY_RE = /(\d+(?:[.,]\d+)?)/;
// Medidas comuns em pt-BR — só para reconhecimento; a medida real vem do banco.
const MEASURE_HINT = /(colher(?:es)?\s+(?:de\s+)?(?:sopa|chá|cha|café|cafe|servir))|(x[íi]cara(?:s)?(?:\s+de\s+ch[áa])?)|(unidade(?:s)?)|(fatia(?:s)?)|(concha(?:s)?)|(punhado(?:s)?)|(copo(?:s)?)|(pote(?:s)?)|([gG]\b)|([mM][lL]\b)|(kg\b)/;

/** name - quantidade medida  |  name: quantidade medida  |  1 unidade de name */
export function parseToken(raw: string): FoodToken {
  const s = raw.trim();
  if (!s) return { name: '', raw };

  // Padrão inverso: "1 unidade de banana"
  const inv = s.match(/^(\d+(?:[.,]\d+)?)\s+([^\d]+?)\s+de\s+(.+)$/i);
  if (inv) {
    return {
      name: inv[3].trim(),
      quantity: Number(inv[1].replace(',', '.')),
      measure: inv[2].trim(),
      raw,
    };
  }

  // Divisor primário: " - " / " — " / ":" / "="
  const splitIdx = firstDivider(s);
  let namePart = s;
  let qtyPart = '';
  if (splitIdx >= 0) {
    namePart = s.slice(0, splitIdx.index).trim();
    qtyPart = s.slice(splitIdx.index + splitIdx.len).trim();
  } else {
    // Sem divisor: tenta detectar "Nome 200 g" no fim.
    const m = s.match(/^(.+?)\s+(\d+(?:[.,]\d+)?(?:\s*(?:g|ml|kg|unidade|fatia|colher|xícara|xicara|concha|copo|pote))?.*)$/i);
    if (m) { namePart = m[1].trim(); qtyPart = m[2].trim(); }
  }

  if (!qtyPart) return { name: namePart, raw };

  const q = qtyPart.match(QTY_RE);
  const qty = q ? Number(q[1].replace(',', '.')) : null;
  const measure = qtyPart.replace(QTY_RE, '').trim() || null;
  return { name: namePart, quantity: qty, measure, raw };
}

function firstDivider(s: string): { index: number; len: number } | -1 {
  const dividers = [' — ', ' - ', ' – ', ' : ', ':', ' = '];
  let best: { index: number; len: number } | -1 = -1;
  for (const d of dividers) {
    const i = s.indexOf(d);
    if (i >= 0 && (best === -1 || i < best.index)) best = { index: i, len: d.length };
  }
  return best;
}

export function parseGroupLine(line: string): GroupLine {
  const parts = line.split(SUBST_SPLIT).map((p) => p.trim()).filter(Boolean);
  return { tokens: parts.map(parseToken) };
}

export function parseText(text: string): PlanAst {
  const lines = text.split(/\r?\n/);
  const meals: MealBlock[] = [];
  let current: MealBlock | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '');
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (looksLikeMealTitle(trimmed)) {
      const { time, rest } = extractTime(trimmed);
      current = { name: rest || 'Refeição', time, groups: [] };
      meals.push(current);
      continue;
    }
    // Sem refeição corrente ainda? Cria uma "solta".
    if (!current) {
      current = { name: 'Refeição', time: null, groups: [] };
      meals.push(current);
    }
    current.groups.push(parseGroupLine(trimmed));
  }
  return { meals };
}
