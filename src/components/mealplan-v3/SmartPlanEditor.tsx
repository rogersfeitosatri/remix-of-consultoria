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

  // Consultas de sugestão
  const foodResults = useFoodSearch(mode === 'food' ? manualQuery : '');
  const measures = useFoodMeasures(mode === 'measure' ? pendingFood?.id ?? null : null);

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
  const applyFood = useCallback((food: FoodItem) => {
    const c = getLineCtx(value, caret);
    const segAbsStart = c.segStart;
    const segAbsCaret = c.segStart + c.segCaret;
    const beforeSeg = value.slice(0, segAbsStart);
    const afterCaret = value.slice(segAbsCaret);
    // preserva prefixo (ex.: já digitado antes do nome? não; segmento começa
    // depois do último " ou "), então reconstrói: nome + " - "
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
    const newSeg = `${q.query} - ${qtyPrefix}${cleanLabel} (${fmt(per)}g cada · ${fmt(total)}g)`;
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

  /** Recalcula "(Xg cada · Yg)" com base na quantidade digitada antes da medida. */
  const recomputeTotals = useCallback((text: string): string => {
    const rx = /(\d+(?:[.,]\d+)?)(\s+)([^\n()]+?)\s*\((\d+(?:[.,]\d+)?)\s*g\s*cada\s*·\s*(\d+(?:[.,]\d+)?)\s*g\)/g;
    return text.replace(rx, (_m, qtyStr: string, sp: string, label: string, perStr: string) => {
      const qty = Number(qtyStr.replace(',', '.'));
      const per = Number(perStr.replace(',', '.'));
      if (!Number.isFinite(qty) || !Number.isFinite(per)) return _m;
      const total = Math.round(qty * per * 10) / 10;
      const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toString().replace('.', ','));
      return `${qtyStr}${sp}${label.trimEnd()} (${fmt(per)}g cada · ${fmt(total)}g)`;
    });
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
      const list: SuggestionItem[] = rows.map((f) => ({
        key: f.id,
        label: f.name,
        hint: f.category,
        onSelect: () => applyFood(f),
      }));
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
  }, [mode, foodResults.data, measures.data, pendingFood, manualQuery, applyFood, applyMeasure, searchWithAi]);

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
          const next = recomputeTotals(e.target.value);
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
