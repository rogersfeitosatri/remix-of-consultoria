// Editor Inteligente de Plano Alimentar — Fase 1
//
// Como funciona:
// • Um único textarea. Cada quebra de linha é um NOVO alimento principal
//   (grupo). Dentro da mesma linha, "ou" cria substituições. Linhas iniciadas
//   por HH:MM ou por nomes de refeição viram TÍTULO da refeição seguinte.
// • À medida que o nutri digita o NOME DO ALIMENTO na "cabeça" do token, um
//   popover mostra alimentos do banco (useFoodSearch) e um botão de IA
//   (useLookupCustomFood). Após selecionar, insere " - " no texto e o
//   próximo estado do popover são as MEDIDAS daquele alimento
//   (useFoodMeasures) + medidas comuns em gramas.
// • Ao selecionar a medida, o token fica resolvido e o parser recalcula
//   automaticamente macros a partir de food_items × food_measures.
//
// Persistência: rascunho automático em localStorage por atleta (Fase 1). O
// botão "Salvar plano" (fora do editor) é acionado pela página host.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  useFoodSearch,
  useFoodMeasures,
  useLookupCustomFood,
  calcNutrients,
  type FoodItem,
  type FoodMeasure,
} from '@/hooks/useFoodSearch';
import { supabase } from '@/integrations/supabase/client';
import { useLearnedSubstitutions } from '@/hooks/useSubstitutionHistory';
import { parseText } from '@/lib/smartPlan/parse';
import type { PlanAst, FoodToken } from '@/lib/smartPlan/ast';
import { SuggestionPopover, type SuggestionItem } from './SuggestionPopover';
import { recalcGroupSubstitutions } from '@/lib/smartPlan/equivalence';
import { enrichAst, makeEnrichCache } from '@/lib/smartPlan/enrich';

type Mode = 'idle' | 'food' | 'measure';

export interface SmartPlanEditorProps {
  value: string;
  onChange: (text: string) => void;
  /** Enriquece o AST com dados do banco toda vez que o texto muda. */
  onAstChange?: (ast: PlanAst) => void;
  /** Se true, recalcula substituições quando o principal for alterado. */
  autoRecalcSubs?: boolean;
}

interface LineCursorCtx {
  lineStart: number;   // índice no texto
  lineEnd: number;
  lineText: string;
  caretInLine: number;
  /** Trecho da linha até o cursor. */
  before: string;
  /** Trecho após o cursor. */
  after: string;
  /** Segmento (após o último "ou") em que o cursor está. */
  segStart: number;    // absoluto
  segEnd: number;      // absoluto
  segText: string;
  segCaret: number;    // relativo ao segmento
}

const SUBST_SPLIT_TEXT = /\s+ou\s+/i;

function getLineCtx(text: string, caret: number): LineCursorCtx {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
  const nextNl = text.indexOf('\n', caret);
  const lineEnd = nextNl < 0 ? text.length : nextNl;
  const lineText = text.slice(lineStart, lineEnd);
  const caretInLine = caret - lineStart;
  const before = lineText.slice(0, caretInLine);
  const after = lineText.slice(caretInLine);

  // Encontra segmento (após último " ou ") relativo à linha
  const rx = / ou /gi;
  let lastMatchEnd = 0;
  let m: RegExpExecArray | null;
  const beforeLower = before.toLowerCase();
  while ((m = rx.exec(beforeLower))) lastMatchEnd = m.index + m[0].length;
  const segStartRel = lastMatchEnd;
  // fim do segmento: começa próximo " ou " após o caret, ou fim da linha
  const afterLower = after.toLowerCase();
  const afterMatch = afterLower.match(/ ou /i);
  const segEndRel = afterMatch ? caretInLine + afterMatch.index! : lineText.length;
  const segText = lineText.slice(segStartRel, segEndRel);
  const segCaret = caretInLine - segStartRel;

  return {
    lineStart, lineEnd, lineText, caretInLine, before, after,
    segStart: lineStart + segStartRel,
    segEnd: lineStart + segEndRel,
    segText, segCaret,
  };
}

/** Extrai a "query" de busca de alimento no segmento (parte antes de "-" / ":"). */
function foodQueryOfSegment(seg: string): { query: string; hasDivider: boolean; afterDivider: string } {
  const dividers = [' — ', ' - ', ' – ', ' : ', ':', ' = '];
  let idx = -1; let len = 0;
  for (const d of dividers) {
    const i = seg.indexOf(d);
    if (i >= 0 && (idx === -1 || i < idx)) { idx = i; len = d.length; }
  }
  if (idx >= 0) return { query: seg.slice(0, idx).trim(), hasDivider: true, afterDivider: seg.slice(idx + len) };
  return { query: seg.trim(), hasDivider: false, afterDivider: '' };
}

function looksLikeTitleLine(line: string): boolean {
  const t = line.trim();
  if (/^\d{1,2}[:h]\d{0,2}/.test(t)) return true;
  const lower = t.toLowerCase();
  return ['café', 'cafe', 'lanche', 'almo', 'jantar', 'ceia', 'brunch', 'pré', 'pre', 'pós', 'pos', 'refeição', 'refeicao']
    .some((k) => lower.startsWith(k));
}

export function SmartPlanEditor({ value, onChange, onAstChange, autoRecalcSubs = true }: SmartPlanEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [mode, setMode] = useState<Mode>('idle');
  const [activeIdx, setActiveIdx] = useState(0);
  const [popPos, setPopPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pendingFood, setPendingFood] = useState<FoodItem | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const { lookupFood, isLooking } = useLookupCustomFood();

  const ctx = useMemo(() => getLineCtx(value, caret), [value, caret]);

  // Detecta modo (título/observação com @/# → sem sugestão; senão food/measure).
  useEffect(() => {
    const trimmed = ctx.lineText.trimStart();
    const isMarker = trimmed.startsWith('@') || trimmed.startsWith('#') || trimmed.startsWith('>');
    if (!ctx.lineText.trim() || isMarker || looksLikeTitleLine(ctx.lineText)) {
      setMode('idle'); return;
    }
    const { query, hasDivider } = foodQueryOfSegment(ctx.segText.slice(0, ctx.segCaret));
    if (hasDivider) { setMode('measure'); setManualQuery(''); return; }
    setMode(query.length >= 2 ? 'food' : 'idle');
    setManualQuery(query);
  }, [ctx]);

  // Cache para enriquecer o alimento principal em contexto de substituição.
  const subEnrichCache = useRef(makeEnrichCache());

  // Consultas de sugestão
  const foodResults = useFoodSearch(mode === 'food' ? manualQuery : '');
  const measures = useFoodMeasures(mode === 'measure' ? pendingFood?.id ?? null : null);

  // Identifica o alimento principal do grupo atual (quando estamos digitando
  // uma substituição) para sugerir substitutos aprendidos pelo nutricionista.
  const [mainFoodId, setMainFoodId] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    const isSub = ctx.segStart > ctx.lineStart;
    if (mode !== 'food' || !isSub) { setMainFoodId(null); return; }
    (async () => {
      try {
        const mainText = ctx.lineText.split(/\s+ou\s+/i)[0]?.trim() || '';
        if (!mainText) { setMainFoodId(null); return; }
        const ast = parseText(mainText);
        await enrichAst(ast, subEnrichCache.current);
        const tok = ast.meals[0]?.groups[0]?.tokens[0];
        if (!cancel) setMainFoodId(tok?.foodItemId ?? null);
      } catch { if (!cancel) setMainFoodId(null); }
    })();
    return () => { cancel = true; };
  }, [mode, ctx]);
  const learnedSubs = useLearnedSubstitutions(mainFoodId);

  // Reposiciona popover próximo ao caret
  useEffect(() => {
    if (mode === 'idle') return;
    const ta = taRef.current; const mirror = mirrorRef.current;
    if (!ta || !mirror) return;
    // sincroniza estilos e conteúdo do mirror
    const cs = getComputedStyle(ta);
    (['font', 'letterSpacing', 'wordSpacing', 'textTransform', 'whiteSpace', 'lineHeight', 'padding', 'border', 'boxSizing', 'width'] as const)
      .forEach((k) => { (mirror.style as any)[k] = (cs as any)[k]; });
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '0';
    mirror.style.overflow = 'hidden';
    mirror.style.height = 'auto';
    const before = value.slice(0, caret);
    mirror.textContent = before;
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    mirror.appendChild(marker);
    const rect = ta.getBoundingClientRect();
    const mRect = marker.getBoundingClientRect();
    const parentRect = mirror.getBoundingClientRect();
    const x = rect.left + (mRect.left - parentRect.left) - ta.scrollLeft;
    const y = rect.top + (mRect.top - parentRect.top) - ta.scrollTop + 22;
    setPopPos({ x, y });
  }, [caret, mode, value]);

  // Reset índice ativo quando lista muda
  useEffect(() => { setActiveIdx(0); }, [mode, foodResults.data?.length, measures.data?.length]);

  // AST → callback
  useEffect(() => {
    if (!onAstChange) return;
    const ast = parseText(value);
    onAstChange(ast);
  }, [value, onAstChange]);

  const insertAtCaret = useCallback((before: string, insert: string, after: string, cursorOffset?: number) => {
    const next = before + insert + after;
    onChange(next);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      const pos = before.length + (cursorOffset ?? insert.length);
      ta.setSelectionRange(pos, pos);
      ta.focus();
      setCaret(pos);
    });
  }, [onChange]);


  // Aplica seleção de alimento: substitui a "query" pela {nome} + " - "
  // Se estivermos após " ou " (substituição), calcula automaticamente a
  // porção equivalente em CALORIAS ao alimento principal do grupo e insere
  // já resolvido (Nome - N g), pulando o popover de medidas. 100% editável
  // depois pelo nutri.
  const applyFood = useCallback(async (food: FoodItem) => {
    const c = getLineCtx(value, caret);
    const segAbsStart = c.segStart;
    const segAbsCaret = c.segStart + c.segCaret;
    const beforeSeg = value.slice(0, segAbsStart);
    const afterCaret = value.slice(segAbsCaret);

    const isSubstitution = c.segStart > c.lineStart; // segmento inicia após " ou "

    if (isSubstitution && food.calories_per_100g > 0) {
      try {
        // Extrai texto do principal (parte da linha antes do primeiro " ou ").
        const mainText = c.lineText.split(/\s+ou\s+/i)[0]?.trim() || '';
        if (mainText) {
          const ast = parseText(mainText);
          await enrichAst(ast, subEnrichCache.current);
          const mainTok = ast.meals[0]?.groups[0]?.tokens[0];
          const mainKcal = mainTok?.calories || 0;
          if (mainKcal > 0) {
            const targetGrams = Math.max(1, (mainKcal / food.calories_per_100g) * 100);

            // Busca medidas do alimento; se houver uma medida "por unidade"
            // (fatia, unidade, colher, porção, etc.), arredonda a quantidade
            // para o múltiplo de 0,5 mais próximo — evita ex.: "1,3 fatias".
            let unitMeasure: FoodMeasure | null = null;
            try {
              const { data: measuresRows } = await (supabase as any)
                .from('food_measures')
                .select('*')
                .eq('food_item_id', food.id)
                .order('measure_weight_g', { ascending: true });
              const rows = (measuresRows || []) as FoodMeasure[];
              // "unit-like": nome NÃO é apenas g/ml e peso razoável (≤ 300 g).
              const isGramLike = (n: string) => /^\s*(g|gr|gramas?|ml)\s*$/i.test(n);
              const candidates = rows.filter((r) => !isGramLike(r.measure_name) && r.measure_weight_g > 0 && r.measure_weight_g <= 300);
              if (candidates.length > 0) {
                // Preferir a medida cuja qtd resultante mais se aproxima de
                // um valor "redondo" (0,5 / 1 / 1,5 / 2). Escolhe a que gera
                // o menor erro relativo após o arredondamento em 0,5.
                let best: { m: FoodMeasure; qty: number; err: number } | null = null;
                for (const m of candidates) {
                  const rawQty = targetGrams / m.measure_weight_g;
                  if (rawQty < 0.25) continue; // muito pequeno — próxima medida
                  const qty = Math.max(0.5, Math.round(rawQty * 2) / 2);
                  const err = Math.abs(qty - rawQty) / rawQty;
                  if (!best || err < best.err) best = { m, qty, err };
                }
                if (best) unitMeasure = best.m;
                // Recalcula qty final
                if (unitMeasure) {
                  const rawQty = targetGrams / unitMeasure.measure_weight_g;
                  const qty = Math.max(0.5, Math.round(rawQty * 2) / 2);
                  const total = Math.round(qty * unitMeasure.measure_weight_g * 10) / 10;
                  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toString().replace('.', ','));
                  const cleanLabel = unitMeasure.measure_name.replace(/\s*\([^)]*\)\s*/g, '').trim();
                  const insert = `${food.name} - ${fmt(qty)} ${cleanLabel} (${fmt(total)}g)`;
                  setPendingFood(null);
                  setMode('idle');
                  insertAtCaret(beforeSeg, insert, afterCaret);
                  toast.success(`Substituição equivalente: ~${Math.round(mainKcal)} kcal · ${fmt(qty)} ${cleanLabel} de ${food.name}`, { duration: 2000 });
                  return;
                }
              }
            } catch { /* segue para fallback em gramas */ }

            // Sem medida unitária — insere em gramas (editável).
            const grams = Math.max(1, Math.round(targetGrams));
            const insert = `${food.name} - ${grams} Gramas (${grams}g)`;
            setPendingFood(null);
            setMode('idle');
            insertAtCaret(beforeSeg, insert, afterCaret);
            toast.success(`Substituição equivalente: ~${Math.round(mainKcal)} kcal em ${grams} g de ${food.name}`, { duration: 2000 });
            return;
          }
        }
      } catch { /* fallback abaixo */ }
    }


    // Fluxo padrão: nome + " - " e abre popover de medidas.
    const insert = `${food.name} - `;
    setPendingFood(food);
    insertAtCaret(beforeSeg, insert, afterCaret);
  }, [value, caret, insertAtCaret]);

  const applyMeasure = useCallback((measureLabel: string, grams: number, food: FoodItem | null) => {
    const c = getLineCtx(value, caret);
    // Formato inserido: "banana - 4 Unidade (50g cada · 200g)".
    // O sufixo "(Xg cada · Yg)" permite recalcular Y automaticamente quando
    // a quantidade é editada (ver recomputeTotals abaixo).
    const seg = c.segText.slice(0, c.segCaret);
    const q = foodQueryOfSegment(seg);
    if (!q.hasDivider) return;
    const typed = q.afterDivider.trim();
    const qtyMatch = typed.match(/^(\d+(?:[.,]\d+)?)/);
    const qty = qtyMatch ? Number(qtyMatch[1].replace(',', '.')) : 1;
    const qtyPrefix = qtyMatch ? `${qtyMatch[1]} ` : '1 ';
    const cleanLabel = measureLabel.replace(/\s*\([^)]*\)\s*/g, '').trim();
    const per = Math.round(grams * 10) / 10;
    const total = Math.round(grams * qty * 10) / 10;
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toString().replace('.', ','));
    const nameStart = c.segStart;
    const beforeSeg = value.slice(0, nameStart);
    const afterCaret = value.slice(c.segStart + c.segCaret);
    const newSeg = `${q.query} - ${qtyPrefix}${cleanLabel} (${fmt(total)}g)`;
    insertAtCaret(beforeSeg, newSeg, afterCaret);
    if (food) {
      const nutrients = calcNutrients(food, grams * qty);
      toast.success(`${food.name} × ${qtyPrefix}${cleanLabel}`.trim(), {
        description: `${Math.round(nutrients.calories)} kcal · CHO ${nutrients.carbs_g}g · PTN ${nutrients.protein_g}g · GORD ${nutrients.fat_g}g`,
        duration: 1800,
      });
    }
    setPendingFood(null);
    setMode('idle');
  }, [value, caret, insertAtCaret]);

  /** Recalcula o sufixo em gramas (Yg) com base na variação da quantidade
   *  entre o texto anterior e o atual. Para medidas caseiras usamos o
   *  ratio oldY/oldQty * newQty; se o token vier no formato legado
   *  "(Xg cada · Yg)", colapsamos para "(Yg)" usando X * newQty. */
  const recomputeTotals = useCallback((prev: string, next: string): string => {
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toString().replace('.', ','));
    const tokenRx = /(\d+(?:[.,]\d+)?)(\s+)([^\n()]+?)\s*\((?:(\d+(?:[.,]\d+)?)\s*g\s*cada\s*·\s*)?(\d+(?:[.,]\d+)?)\s*g\)/g;
    type Tok = { start: number; end: number; qty: number; label: string; per?: number; total: number; raw: string };
    const extract = (line: string): Tok[] => {
      const out: Tok[] = [];
      let m: RegExpExecArray | null;
      tokenRx.lastIndex = 0;
      while ((m = tokenRx.exec(line))) {
        out.push({
          start: m.index, end: m.index + m[0].length,
          qty: Number(m[1].replace(',', '.')),
          label: m[3],
          per: m[4] ? Number(m[4].replace(',', '.')) : undefined,
          total: Number(m[5].replace(',', '.')),
          raw: m[0],
        });
      }
      return out;
    };

    const prevLines = prev.split('\n');
    const nextLines = next.split('\n');
    const outLines = nextLines.map((line, i) => {
      const prevLine = prevLines[i] ?? '';
      const oldToks = extract(prevLine);
      const newToks = extract(line);
      if (newToks.length === 0) return line;
      // Aplica de trás pra frente para preservar índices.
      let out = line;
      for (let k = newToks.length - 1; k >= 0; k--) {
        const t = newToks[k];
        const old = oldToks[k];
        let newTotal = t.total;
        if (t.per && Number.isFinite(t.per)) {
          newTotal = Math.round(t.per * t.qty * 10) / 10;
        } else if (old && Number.isFinite(old.qty) && old.qty > 0 && Number.isFinite(old.total)) {
          if (old.qty !== t.qty) newTotal = Math.round((old.total / old.qty) * t.qty * 10) / 10;
        }
        if (!Number.isFinite(newTotal)) continue;
        const replacement = `${fmt(t.qty)}${t.raw.match(/^\d+(?:[.,]\d+)?(\s+)/)?.[1] ?? ' '}${t.label.trimEnd()} (${fmt(newTotal)}g)`;
        out = out.slice(0, t.start) + replacement + out.slice(t.end);
      }
      return out;
    });
    return outLines.join('\n');
  }, []);


  const searchWithAi = useCallback(async () => {
    if (!manualQuery) return;
    const f = await lookupFood(manualQuery);
    if (!f) { toast.error('IA não conseguiu identificar esse alimento.'); return; }
    toast.success(`Alimento cadastrado via IA: ${f.name}`);
    applyFood(f);
  }, [manualQuery, lookupFood, applyFood]);

  // Itens do popover
  const items: SuggestionItem[] = useMemo(() => {
    if (mode === 'food') {
      const rows = foodResults.data || [];
      const seen = new Set<string>();
      const list: SuggestionItem[] = [];
      // Substitutos aprendidos aparecem no topo quando estamos após " ou ".
      const learned = learnedSubs.data || [];
      const q = manualQuery.trim().toLowerCase();
      for (const s of learned) {
        if (q && !s.name.toLowerCase().includes(q)) continue;
        seen.add(s.sub_food_id);
        list.push({
          key: `learned-${s.sub_food_id}`,
          label: `⭐ ${s.name}`,
          hint: `usado ${s.uses_count}×`,
          onSelect: () => applyFood(s as unknown as FoodItem),
        });
      }
      for (const f of rows) {
        if (seen.has(f.id)) continue;
        list.push({ key: f.id, label: f.name, hint: f.category, onSelect: () => applyFood(f) });
      }
      if (manualQuery.length >= 2) {
        list.push({
          key: '__ai__',
          label: `🔎 Buscar "${manualQuery}" com IA`,
          onSelect: searchWithAi,
        });
      }
      return list;
    }
    if (mode === 'measure' && pendingFood) {
      const rows = measures.data || [];
      const list: SuggestionItem[] = rows.map((m) => ({
        key: m.id,
        label: `${m.measure_name} · ${Math.round(m.measure_weight_g)} g`,
        onSelect: () => applyMeasure(m.measure_name, m.measure_weight_g, pendingFood),
      }));
      // Gramas comuns
      [50, 100, 150, 200].forEach((g) => list.push({
        key: `g${g}`,
        label: `${g} g`,
        onSelect: () => applyMeasure(`${g} g`, g, pendingFood),
      }));
      return list;
    }
    return [];
  }, [mode, foodResults.data, measures.data, pendingFood, manualQuery, applyFood, applyMeasure, searchWithAi, learnedSubs.data]);

  const stripMarkerOnEnter = (): boolean => {
    // Ao apertar Enter numa linha iniciada por @ (título) ou # (observação),
    // remove o marcador e mantém apenas o texto. `#` vira `> ` (convenção
    // interna de nota preservada pelo parser/serializer).
    const c = getLineCtx(value, caret);
    const raw = c.lineText;
    const leading = raw.match(/^\s*/)?.[0] ?? '';
    const body = raw.slice(leading.length);
    let replaced: string | null = null;
    if (body.startsWith('@')) {
      replaced = leading + body.replace(/^@\s*/, '');
    } else if (body.startsWith('#')) {
      replaced = leading + '> ' + body.replace(/^#\s*/, '');
    }
    if (replaced === null || replaced === raw) return false;
    const before = value.slice(0, c.lineStart);
    const after = value.slice(c.lineEnd);
    const next = before + replaced + '\n' + after;
    const newCaret = before.length + replaced.length + 1;
    onChange(next);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.setSelectionRange(newCaret, newCaret);
      setCaret(newCaret);
    });
    return true;
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter em linha com @ ou # sempre limpa o marcador (mesmo sem popover).
    if (e.key === 'Enter' && !e.shiftKey && mode === 'idle') {
      if (stripMarkerOnEnter()) { e.preventDefault(); return; }
    }
    if (mode === 'idle' || items.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); items[activeIdx]?.onSelect(); }
    else if (e.key === 'Escape') { setMode('idle'); }
  };

  const handleSelect = () => {
    const ta = taRef.current;
    if (ta) setCaret(ta.selectionStart);
  };

  return (
    <div className="relative">
      <Textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          const next = recomputeTotals(value, e.target.value);
          onChange(next);
          setCaret(e.target.selectionStart);
        }}
        onKeyUp={handleSelect}
        onClick={handleSelect}
        onKeyDown={handleKey}
        placeholder={`@ 07:00 Café da manhã
Pão francês - 1 unidade ou Cuscuz - 100 g
Ovo de galinha - 2 unidades
Banana - 1 unidade ou Maçã - 1 unidade
# Beber 500 ml de água ao acordar

@ 12:30 Almoço
Arroz - 4 colheres de sopa ou Macarrão - 120 g
Frango grelhado - 150 g
Salada crua à vontade`}
        className="min-h-[60vh] font-mono text-sm leading-relaxed resize-y whitespace-pre-wrap"
        spellCheck={false}
      />
      <div ref={mirrorRef} aria-hidden="true" />

      <SuggestionPopover
        open={mode !== 'idle' && items.length > 0}
        items={items}
        x={popPos.x}
        y={popPos.y}
        activeIndex={activeIdx}
        onHover={setActiveIdx}
        loading={mode === 'food' ? foodResults.isFetching : measures.isFetching}
        footer={mode === 'food' ? (
          <span className="text-muted-foreground">
            ↑↓ para navegar · Enter/Tab para selecionar · Esc para fechar
          </span>
        ) : mode === 'measure' && pendingFood ? (
          <span className="text-muted-foreground truncate block">Medidas de <b>{pendingFood.name}</b></span>
        ) : null}
      />

      {isLooking && (
        <div className="absolute right-2 top-2 rounded bg-background/80 px-2 py-1 text-xs flex items-center gap-1 border">
          <Sparkles className="h-3 w-3 animate-pulse" /> IA buscando alimento…
        </div>
      )}
    </div>
  );
}
