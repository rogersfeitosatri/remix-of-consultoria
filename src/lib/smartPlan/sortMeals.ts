// Ordena refeições do plano cronologicamente por HH:MM.
// - Refeições sem horário reconhecido vão para o final (mantendo ordem relativa).
// - Preserva TODO o conteúdo (opções, tokens, notas) — só reordena os blocos.
//
// Usado ao adicionar refeição via atalhos ("Almoço 12:30" precisa cair entre o
// lanche da manhã e o pós-treino, não no fim) e após importar Markdown (garante
// que os planos por dia respeitem a ordem: café → lanche → almoço → …).

import { parseText } from './parse';
import { astToText } from './serialize';

function timeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!isFinite(h) || !isFinite(mm)) return null;
  return h * 60 + mm;
}

export function sortMealsByTimeInText(text: string): string {
  if (!text || !text.trim()) return text;
  const ast = parseText(text);
  if (ast.meals.length < 2) return text;
  const indexed = ast.meals.map((m, i) => ({ m, i, t: timeToMinutes(m.time) }));
  indexed.sort((a, b) => {
    if (a.t == null && b.t == null) return a.i - b.i;
    if (a.t == null) return 1;
    if (b.t == null) return -1;
    if (a.t !== b.t) return a.t - b.t;
    return a.i - b.i;
  });
  ast.meals = indexed.map((x) => x.m);
  return astToText(ast);
}
