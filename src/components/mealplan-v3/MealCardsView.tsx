// Visualização + edição inline do plano no formato de cards.
// Cada refeição é uma linha (separada por divisor fino) contendo suas OPÇÕES
// lateralizadas. Ao lado do nome de cada opção há um lápis: clicar troca
// a opção para o modo de edição (SmartPlanEditor) com autocomplete de
// alimentos/medidas. Um botão verde (✓) salva e volta ao modo de visualização;
// um "X" cancela sem gravar.
//
// A fonte de verdade continua sendo o texto plano (mesma sintaxe do editor
// clássico). Este componente parseia o texto, oferece as ações e reserializa
// o AST completo ao gravar cada edição pontual.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Star, Trash2, Pencil, Check, X } from 'lucide-react';
import { parseText, parseGroupLine } from '@/lib/smartPlan/parse';
import { astToText, tokenToText } from '@/lib/smartPlan/serialize';
import { enrichAst, makeEnrichCache } from '@/lib/smartPlan/enrich';
import type { MealOption, MealBlock, PlanAst } from '@/lib/smartPlan/ast';
import { sortMealsByTimeInText } from '@/lib/smartPlan/sortMeals';
import { SmartPlanEditor } from './SmartPlanEditor';

// "08:00 Café da manhã" | "08:00 - Café" | "08:00 — Café" | "Café da manhã"
function parseMealTitleInput(raw: string): { time: string | null; name: string } {
  const s = (raw || '').trim();
  const m = /^(\d{1,2}):(\d{2})\s*[-–—:]?\s*(.*)$/.exec(s);
  if (m) {
    const h = Math.min(23, parseInt(m[1], 10));
    const mm = Math.min(59, parseInt(m[2], 10));
    const time = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const name = m[3].trim() || 'Refeição';
    return { time, name };
  }
  return { time: null, name: s || 'Refeição' };
}

interface Props {
  text: string;
  onChange: (next: string) => void;
}

function optionsOf(meal: MealBlock): MealOption[] {
  if (meal.options && meal.options.length) return meal.options;
  return [{ name: 'Opção 1', primary: true, groups: meal.groups }];
}

function totalsOfOption(opt: MealOption) {
  let kcal = 0, cho = 0, ptn = 0, lip = 0;
  for (const g of opt.groups) {
    const t = g.tokens[0];
    if (!t) continue;
    kcal += Number(t.calories) || 0;
    cho += Number(t.carbs_g) || 0;
    ptn += Number(t.protein_g) || 0;
    lip += Number(t.fat_g) || 0;
  }
  return { kcal, cho, ptn, lip };
}

function fmt(n: number): string {
  if (!isFinite(n)) return '0';
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',');
}

/** Texto plano das linhas de alimentos de UMA opção (sem o título da refeição). */
function optionToLines(opt: MealOption): string {
  return opt.groups.map((g) => g.tokens.map(tokenToText).join(' ou ')).join('\n');
}

export function MealCardsView({ text, onChange }: Props) {
  const [ast, setAst] = useState<PlanAst>(() => parseText(text || ''));
  const enrichCache = useRef(makeEnrichCache());
  // Estado "qual opção está em edição": null = nenhuma.
  const [editing, setEditing] = useState<{ mi: number; oi: number } | null>(null);
  const [editText, setEditText] = useState<string>('');

  // Enriquece com macros (debounce curto). Pausa enquanto edita para não
  // sobrescrever o texto do editor inline.
  useEffect(() => {
    if (editing) return;
    const t = setTimeout(async () => {
      try {
        const next = parseText(text || '');
        await enrichAst(next, enrichCache.current);
        setAst(next);
      } catch { /* silencioso */ }
    }, 350);
    return () => clearTimeout(t);
  }, [text, editing]);

  const mutate = (fn: (a: PlanAst) => void) => {
    const next = parseText(text || '');
    fn(next);
    setAst(next); // atualização síncrona — evita "trava" enquanto o efeito debounced não roda
    onChange(astToText(next));
  };

  const addOption = (mealIdx: number) => {
    // Cria a nova opção e já entra no modo edição dela, com autocomplete pronto.
    const next = parseText(text || '');
    const meal = next.meals[mealIdx];
    if (!meal) return;
    const opts = optionsOf(meal).map((o) => ({ ...o, groups: [...o.groups] }));
    const newIdx = opts.length;
    opts.push({ name: `Opção ${opts.length + 1}`, primary: false, groups: [] });
    meal.options = opts;
    const primary = opts.find((o) => o.primary) || opts[0];
    meal.groups = primary.groups;
    setAst(next); // reflete imediatamente na UI
    onChange(astToText(next));
    setEditText('');
    setEditing({ mi: mealIdx, oi: newIdx });
  };


  const setPrimary = (mealIdx: number, optIdx: number) =>
    mutate((a) => {
      const meal = a.meals[mealIdx];
      const opts = optionsOf(meal).map((o, i) => ({ ...o, primary: i === optIdx }));
      meal.options = opts.length > 1 ? opts : undefined;
      meal.groups = opts[optIdx].groups;
    });

  const removeOption = (mealIdx: number, optIdx: number) =>
    mutate((a) => {
      const meal = a.meals[mealIdx];
      const opts = optionsOf(meal).slice();
      if (opts.length <= 1) return;
      const wasPrimary = opts[optIdx].primary;
      opts.splice(optIdx, 1);
      if (wasPrimary) opts[0].primary = true;
      meal.options = opts.length > 1 ? opts : undefined;
      const primary = opts.find((o) => o.primary) || opts[0];
      meal.groups = primary.groups;
    });

  const removeMeal = (mealIdx: number) => {
    const meal = ast.meals[mealIdx];
    const label = meal ? `${meal.time ? meal.time + ' · ' : ''}${meal.name}` : 'esta refeição';
    if (!confirm(`Excluir "${label}"? Todas as opções desta refeição serão removidas.`)) return;
    cancelEdit();
    mutate((a) => {
      a.meals.splice(mealIdx, 1);
    });
  };

  const startEdit = (mi: number, oi: number) => {
    const meal = ast.meals[mi];
    if (!meal) return;
    const opt = optionsOf(meal)[oi];
    setEditText(optionToLines(opt));
    setEditing({ mi, oi });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditText('');
  };

  const saveEdit = () => {
    if (!editing) return;
    const { mi, oi } = editing;
    // Filtra marcadores de título/opção/nota: aqui só entram linhas de alimento.
    const lines = editText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith('@') && !l.startsWith('#') && !l.startsWith('>') && !/^==\s*/.test(l));
    const groups = lines.map(parseGroupLine);
    mutate((a) => {
      const meal = a.meals[mi];
      if (!meal) return;
      const opts = optionsOf(meal).map((o) => ({ ...o, groups: [...o.groups] }));
      opts[oi] = { ...opts[oi], groups };
      meal.options = opts.length > 1 ? opts : undefined;
      const primary = opts.find((o) => o.primary) || opts[0];
      meal.groups = primary.groups;
    });
    setEditing(null);
    setEditText('');
  };

  const meals = useMemo(() => ast.meals, [ast]);
  if (!meals.length) {
    return (
      <div className="mb-3 rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Nenhuma refeição ainda. Use os atalhos "Adicionar refeição" acima para começar.
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-md border bg-card">
      {meals.map((meal, mi) => {
        const opts = optionsOf(meal);
        const isLast = mi === meals.length - 1;
        return (
          <div
            key={mi}
            className={`px-3 py-2 ${!isLast ? 'border-b border-border/50' : ''}`}
          >
            {/* Título + botões da refeição */}
            <div className="flex items-center gap-1 mb-2">
              <span className="text-sm font-medium truncate flex-1">
                {meal.time ? `${meal.time} · ` : ''}{meal.name}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => addOption(mi)}
                aria-label="Adicionar opção nesta refeição"
                title="Adicionar opção nesta refeição"
                disabled={!!editing}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => removeMeal(mi)}
                aria-label="Excluir esta refeição"
                title="Excluir esta refeição"
                disabled={!!editing}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>


            {/* Opções lado a lado */}
            <div className="flex flex-nowrap overflow-x-auto gap-0">
              {opts.map((o, oi) => {
                const isEditing = editing?.mi === mi && editing?.oi === oi;
                const t = totalsOfOption(o);
                return (
                  <div
                    key={oi}
                    className={`${isEditing ? 'min-w-full' : 'min-w-[240px] max-w-[320px]'} flex-1 px-3 py-2 ${
                      oi < opts.length - 1 && !isEditing ? 'border-r border-border/40' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => setPrimary(mi, oi)}
                          title={o.primary ? 'Opção principal (entra nos cálculos)' : 'Definir como principal'}
                          className={`inline-flex items-center ${o.primary ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}
                          disabled={!!editing}
                        >
                          <Star className={`h-3.5 w-3.5 ${o.primary ? 'fill-current' : ''}`} />
                        </button>
                        <span className="text-xs font-medium truncate">
                          {o.name || `Opção ${oi + 1}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={saveEdit}
                              className="inline-flex items-center justify-center h-6 w-6 rounded text-emerald-600 hover:bg-emerald-50"
                              title="Salvar e voltar"
                              aria-label="Salvar edição da opção"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:bg-muted"
                              title="Cancelar"
                              aria-label="Cancelar edição"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(mi, oi)}
                              className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Editar esta opção"
                              aria-label="Editar opção"
                              disabled={!!editing}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {opts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeOption(mi, oi)}
                                className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-destructive"
                                title="Remover opção"
                                aria-label="Remover opção"
                                disabled={!!editing}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-2">
                        <SmartPlanEditor value={editText} onChange={setEditText} />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Cada linha = um alimento. Use "ou" para substituições. Clique no ✓ verde para salvar.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Prévia compacta dos alimentos */}
                        <ul className="text-[11px] leading-snug text-muted-foreground space-y-0.5 mb-2">
                          {o.groups.length === 0 && (
                            <li className="italic opacity-70">Sem alimentos ainda</li>
                          )}
                          {o.groups.slice(0, 6).map((g, gi) => (
                            <li key={gi} className="truncate">
                              {g.tokens.map(tokenToText).join(' ou ')}
                            </li>
                          ))}
                          {o.groups.length > 6 && (
                            <li className="opacity-70">+ {o.groups.length - 6} …</li>
                          )}
                        </ul>

                        {/* Rodapé com macros abreviados */}
                        <div className="text-[11px] font-medium flex flex-wrap gap-x-2 gap-y-0.5 pt-1 border-t border-border/40">
                          <span className="text-amber-600">CHO: {fmt(t.cho)}g</span>
                          <span className="text-red-500">PTN: {fmt(t.ptn)}g</span>
                          <span className="text-blue-500">LIP: {fmt(t.lip)}g</span>
                          <span className="text-purple-600 ml-auto">{Math.round(t.kcal)} kcal</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
