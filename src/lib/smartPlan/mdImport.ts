// Importador de plano alimentar em Markdown (formato ChatGPT).
// Reconhece:
//  - Blocos "PLANO A/B/C/D ..." com linha "Dias: <dias da semana>"
//  - Refeições no formato "CAFÉ DA MANHÃ — 07:00"
//  - Opções "OPÇÃO 1", "OPÇÃO 2" (a primeira é a principal)
//  - Itens "- Alimento — 1 unidade (50 g)" (com/sem "ou" para substituições)
//  - Seção "ORIENTAÇÕES ESPECÍFICAS PARA O ATLETA" no final
//
// Saída: mapa por dia da semana no formato textual do editor V3
// (@ HH:MM Nome / == Opção N * / linhas de alimento) + texto de orientações.
//
// Também garante que alimentos desconhecidos sejam criados via a edge function
// "lookup-custom-food" para que o enriquecimento local calcule kcal/macros.

import { supabase } from '@/integrations/supabase/client';
import { sortMealsByTimeInText } from './sortMeals';

export type DayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export interface MdImportResult {
  /** Texto do editor por dia. Chaves ausentes = sem override. */
  perDay: Partial<Record<DayKey, string>>;
  /** Texto do editor "Todos os dias" quando o MD só tem UM plano sem "Dias:". */
  base?: string;
  /** Texto consolidado de orientações (para o botão "Criar orientação"). */
  orientations: string;
  /** Nomes de planos que caíram em conflito e foram anexados nas orientações. */
  skippedPlans: string[];
  /** Nomes de alimentos que precisaram ser criados no banco. */
  createdFoods: string[];
}

const DAY_TOKENS: Array<{ re: RegExp; key: DayKey }> = [
  { re: /\bdomingos?\b/i, key: 'dom' },
  { re: /\bsegundas?(?:-feiras?)?\b/i, key: 'seg' },
  { re: /\bter[çc]as?(?:-feiras?)?\b/i, key: 'ter' },
  { re: /\bquartas?(?:-feiras?)?\b/i, key: 'qua' },
  { re: /\bquintas?(?:-feiras?)?\b/i, key: 'qui' },
  { re: /\bsextas?(?:-feiras?)?\b/i, key: 'sex' },
  { re: /\bs[áa]bados?\b/i, key: 'sab' },
];

interface PlanBlock {
  title: string; // "PLANO A", "PLANO C — CARBLOADING (D-2)"
  daysText: string; // linha "Dias: ..."
  bodyText: string; // corpo até o próximo plano
  weekdays: DayKey[];
  special: boolean; // "anterior à prova" / "exceto" / carbloading
}

function stripListDash(s: string) {
  return s.replace(/^[-•·]\s*/, '').replace(/\.\s*$/, '').trim();
}

/** Extrai os blocos de "PLANO X" e a seção final de orientações. */
function splitBlocks(md: string): { plans: PlanBlock[]; orientations: string } {
  const lines = md.split(/\r?\n/);
  const plans: PlanBlock[] = [];
  let orientations = '';
  let cur: { title: string; buf: string[] } | null = null;
  let inOrientations = false;

  const flush = () => {
    if (!cur) return;
    const body = cur.buf.join('\n');
    const daysLine = body.match(/^\s*Dias:\s*(.+)$/im)?.[1] || '';
    const weekdays: DayKey[] = [];
    for (const t of DAY_TOKENS) if (t.re.test(daysLine)) weekdays.push(t.key);
    const special = /anterior\s+à\s+prova|carbloading|exceto/i.test(daysLine + ' ' + cur.title);
    plans.push({
      title: cur.title.trim(),
      daysText: daysLine.trim(),
      bodyText: body.replace(/^\s*Dias:.*$/im, '').trim(),
      weekdays,
      special,
    });
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '');
    // "ORIENTAÇÕES…" e "TROCAS PERMITIDAS" encerram os planos e vão para as
    // orientações (senão os itens de troca vazam para a última refeição).
    if (/^ORIENTA[ÇC][ÕO]ES\b/i.test(line.trim()) || /^TROCAS?\s+PERMITID/i.test(line.trim())) {
      flush();
      inOrientations = true;
      orientations += (orientations ? '\n' : '') + line; // mantém o título da seção
      continue;
    }
    if (inOrientations) {
      orientations += (orientations ? '\n' : '') + line;
      continue;
    }
    if (/^\s*PLANO\s+[A-Z]/i.test(line)) {
      flush();
      cur = { title: line.trim(), buf: [] };
      continue;
    }
    if (cur) cur.buf.push(line);
  }
  flush();
  return { plans, orientations: orientations.trim() };
}

const MEAL_HEADER_RE = /^\s*([A-ZÁÂÃÉÊÍÓÔÕÚÇ][A-ZÁÂÃÉÊÍÓÔÕÚÇ \-'/]{2,})\s*[—–-]\s*(\d{1,2})[:h](\d{2})\s*$/;
const OPTION_RE = /^\s*OP[ÇC][ÃA]O\s+(\d+)\s*$/i;

interface Meal {
  name: string;
  time: string;
  options: Array<{ label: string; items: string[] }>;
}

/** Converte o corpo de um "PLANO X" em texto do editor V3. */
function planBodyToEditorText(body: string): { text: string; foods: string[] } {
  const lines = body.split(/\r?\n/);
  const meals: Meal[] = [];
  let curMeal: Meal | null = null;
  let curOpt: { label: string; items: string[] } | null = null;
  const foods: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Resumo do dia/i.test(line)) continue;
    if (/^-{3,}$/.test(line)) continue;

    const mh = line.match(MEAL_HEADER_RE);
    if (mh) {
      curMeal = {
        name: titleCase(mh[1].trim()),
        time: `${mh[2].padStart(2, '0')}:${mh[3]}`,
        options: [],
      };
      meals.push(curMeal);
      curOpt = null;
      continue;
    }
    const op = line.match(OPTION_RE);
    if (op && curMeal) {
      curOpt = { label: `Opção ${op[1]}`, items: [] };
      curMeal.options.push(curOpt);
      continue;
    }
    if (/^[-•·]/.test(line)) {
      if (!curMeal) continue;
      if (!curOpt) { curOpt = { label: 'Opção 1', items: [] }; curMeal.options.push(curOpt); }
      // Pré-processa: separa alternativas com ";" em "ou" para o parser do editor.
      // Ex.: "Peito de frango — 100 g ou carne bovina magra — 90 g; peixe — 120 g"
      const clean = stripListDash(line).replace(/;\s+/g, ' ou ');
      curOpt.items.push(clean);
      for (const t of clean.split(/\s+ou\s+/i)) {
        const name = extractFoodName(t);
        if (name) foods.push(name);
      }
    }
  }

  const parts: string[] = [];
  for (const m of meals) {
    parts.push(`@ ${m.time} ${m.name}`);
    if (!m.options.length) continue;
    if (m.options.length === 1) {
      for (const it of m.options[0].items) parts.push(it);
    } else {
      m.options.forEach((o, i) => {
        parts.push(`== ${o.label}${i === 0 ? ' *' : ''}`);
        for (const it of o.items) parts.push(it);
      });
    }
    parts.push('');
  }
  return { text: parts.join('\n').trim(), foods };
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)([a-záâãéêíóôõúç])/g, (_, sp, ch) => sp + ch.toUpperCase());
}

/** Extrai o nome do alimento de um item "Alimento — 1 unidade (50 g)". */
function extractFoodName(item: string): string | null {
  const t = item.trim().replace(/\.$/, '');
  if (!t) return null;
  // divide no primeiro separador de quantidade
  const idx = firstDivider(t);
  const name = (idx >= 0 ? t.slice(0, idx) : t).trim();
  return name.length >= 2 ? name : null;
}
function firstDivider(s: string): number {
  const dividers = [' — ', ' – ', ' - ', ':', ' = '];
  let best = -1;
  for (const d of dividers) {
    const i = s.indexOf(d);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

/** Verifica quais nomes ainda não existem em food_items e cria pela IA. */
async function ensureFoodsExist(names: string[]): Promise<string[]> {
  const uniq = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  const created: string[] = [];
  for (const name of uniq) {
    try {
      // Busca pela primeira palavra "âncora" e exige correspondência EXATA de
      // nome (normalizada). Só assim o cálculo do plano é DETERMINÍSTICO: o
      // enriquecimento usa o item do banco de mesmo nome (nada de IA a cada
      // importação). Se não houver item idêntico, cria um com ESSE nome exato.
      const anchor = name.split(/\s+/)[0].replace(/[%_]/g, '');
      if (!anchor) continue;
      const target = normalize(name);
      const { data: existing } = await (supabase as any)
        .from('food_items').select('id, name').ilike('name', `%${anchor}%`).limit(30);
      const found = (existing || []).some((r: any) => normalize(r.name) === target);
      if (found) continue;
      // Cria via IA com o NOME EXATO (storeName). Ignora falhas — usa (Xg).
      await supabase.functions.invoke('lookup-custom-food', { body: { foodName: name, storeName: name } });
      created.push(name);
    } catch { /* silencioso */ }
  }
  return created;
}

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/** Ponto de entrada: recebe o conteúdo do MD e retorna a distribuição pronta. */
export async function importMealPlanFromMarkdown(md: string): Promise<MdImportResult> {
  const { plans, orientations } = splitBlocks(md);

  const perDay: Partial<Record<DayKey, string>> = {};
  const skippedPlans: string[] = [];
  let base: string | undefined;
  const orientationParts: string[] = [];
  const allFoodNames: string[] = [];

  // Ordena: planos "regulares" primeiro (sem "carbloading"/"anterior à prova").
  const sorted = [...plans].sort((a, b) => Number(a.special) - Number(b.special));

  for (const p of sorted) {
    const { text, foods } = planBodyToEditorText(p.bodyText);
    allFoodNames.push(...foods);
    if (!text.trim()) continue;

    if (!p.weekdays.length) {
      if (!base) base = text; else orientationParts.push(`\n\n== ${p.title} ==\n(sem distribuição semanal reconhecida)\n${p.bodyText}`);
      continue;
    }

    // Planos "especiais" (carbloading / anterior à prova) SOBRESCREVEM os
    // dias declarados; planos regulares só preenchem dias ainda vazios.
    const assigned: DayKey[] = [];
    const conflicts: DayKey[] = [];
    for (const d of p.weekdays) {
      if (perDay[d] && !p.special) conflicts.push(d);
      else { perDay[d] = text; assigned.push(d); }
    }
    if (!assigned.length) {
      skippedPlans.push(p.title);
      orientationParts.push(`\n\n${p.title}\nDias: ${p.daysText}\n\n${p.bodyText}`);
    } else if (conflicts.length) {
      skippedPlans.push(`${p.title} (conflito em ${conflicts.join(', ')})`);
    }
  }

  const orientationsFinal = [orientations, ...orientationParts].filter(Boolean).join('\n').trim();
  const createdFoods = await ensureFoodsExist(allFoodNames);

  // Reordena cada texto por horário (garante Café → Lanche → Almoço → Jantar → Ceia
  // mesmo se o MD original vier fora de ordem). Também evita que opções caiam
  // sob a refeição errada quando o ChatGPT emite blocos desordenados.
  try {
    for (const k of Object.keys(perDay) as DayKey[]) {
      const t = perDay[k];
      if (t) perDay[k] = sortMealsByTimeInText(t);
    }
    if (base) base = sortMealsByTimeInText(base);
  } catch { /* silencioso */ }

  return { perDay, base, orientations: orientationsFinal, skippedPlans, createdFoods };
}
