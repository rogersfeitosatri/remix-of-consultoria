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
import { FoodComposer } from './FoodComposer';


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
  /** Cache de enriquecimento COMPARTILHADO com a página (já semeado com os macros
   *  salvos). Sem ele, os cards usariam um cache próprio vazio → IA a cada edição
   *  e macros divergentes do total do dia. */
  cacheRef?: React.MutableRefObject<ReturnType<typeof makeEnrichCache>>;
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

export function MealCardsView({ text, onChange, cacheRef }: Props) {
  const [ast, setAst] = useState<PlanAst>(() => parseText(text || ''));
  const localCache = useRef(makeEnrichCache());
  const enrichCache = cacheRef ?? localCache;
  // Estado "qual opção está em edição": null = nenhuma.
  const [editing, setEditing] = useState<{ mi: number; oi: number } | null>(null);
  const [editText, setEditText] = useState<string>('');
  // Compositor guiado aberto: gi = índice do alimento em edição (null = novo).
  const [composer, setComposer] = useState<{ mi: number; oi: number; gi: number | null; nonce?: number } | null>(null);
  const isComposing = (mi: number, oi: number) => composer?.mi === mi && composer?.oi === oi;


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

  // Edição inline do título (horário + nome) de uma refeição.
  const [titleEditIdx, setTitleEditIdx] = useState<number | null>(null);
  const [titleDraft, setTitleDraft] = useState<string>('');

  const mutate = (fn: (a: PlanAst) => void) => {
    const next = parseText(text || '');
    fn(next);
    setAst(next); // atualização síncrona — evita "trava" enquanto o efeito debounced não roda
    onChange(astToText(next));
  };

  const startTitleEdit = (mi: number) => {
    const meal = ast.meals[mi];
    if (!meal) return;
    setTitleDraft(meal.time ? `${meal.time} ${meal.name}` : meal.name);
    setTitleEditIdx(mi);
  };
  const cancelTitleEdit = () => {
    setTitleEditIdx(null);
    setTitleDraft('');
  };
  const saveTitleEdit = () => {
    if (titleEditIdx == null) return;
    const { time, name } = parseMealTitleInput(titleDraft);
    const next = parseText(text || '');
    const meal = next.meals[titleEditIdx];
    if (meal) {
      meal.name = name;
      meal.time = time;
    }
    // Reordena cronologicamente (se o novo horário mudou a posição).
    const sorted = sortMealsByTimeInText(astToText(next));
    setAst(parseText(sorted));
    onChange(sorted);
    setTitleEditIdx(null);
    setTitleDraft('');
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

  // ── Compositor guiado de alimento (adicionar / editar item da opção) ──
  const applyLine = (mi: number, oi: number, gi: number | null, line: string) =>
    mutate((a) => {
      const meal = a.meals[mi];
      if (!meal) return;
      const opts = optionsOf(meal).map((o) => ({ ...o, groups: [...o.groups] }));
      const groups = [...opts[oi].groups];
      const parsed = parseGroupLine(line);
      if (!parsed.tokens.length) return;
      if (gi == null) {
        groups.push(parsed);
      } else {
        const subs = groups[gi]?.tokens.slice(1) ?? [];
        groups[gi] = { tokens: [parsed.tokens[0], ...subs] };
      }
      opts[oi] = { ...opts[oi], groups };
      meal.options = opts.length > 1 ? opts : undefined;
      const primary = opts.find((o) => o.primary) || opts[0];
      meal.groups = primary.groups;
    });

  const removeGroupItem = (mi: number, oi: number, gi: number) =>
    mutate((a) => {
      const meal = a.meals[mi];
      if (!meal) return;
      const opts = optionsOf(meal).map((o) => ({ ...o, groups: [...o.groups] }));
      opts[oi].groups.splice(gi, 1);
      meal.options = opts.length > 1 ? opts : undefined;
      const primary = opts.find((o) => o.primary) || opts[0];
      meal.groups = primary.groups;
    });

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
              {titleEditIdx === mi ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveTitleEdit(); }
                      else if (e.key === 'Escape') { e.preventDefault(); cancelTitleEdit(); }
                    }}
                    placeholder="08:00 Café da manhã"
                    className="flex-1 text-sm font-medium bg-background border border-input rounded px-2 py-1 h-7 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={saveTitleEdit}
                    className="inline-flex items-center justify-center h-6 w-6 rounded text-emerald-600 hover:bg-emerald-50"
                    title="Salvar horário e nome"
                    aria-label="Salvar título da refeição"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelTitleEdit}
                    className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:bg-muted"
                    title="Cancelar"
                    aria-label="Cancelar edição do título"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium truncate flex-1">
                    {meal.time ? `${meal.time} · ` : ''}{meal.name}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => startTitleEdit(mi)}
                    aria-label="Editar horário e nome da refeição"
                    title="Editar horário e nome"
                    disabled={!!editing}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
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
                </>
              )}
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
                        {/* Alimentos da opção — edição item a item */}
                        <ul className="text-[11px] leading-snug space-y-0.5 mb-2">
                          {o.groups.length === 0 && !isComposing(mi, oi) && (
                            <li className="italic opacity-70 text-muted-foreground">Sem alimentos ainda</li>
                          )}
                          {o.groups.map((g, gi) => {
                            const editingItem = composer?.mi === mi && composer?.oi === oi && composer?.gi === gi;
                            if (editingItem) {
                              return (
                                <li key={gi}>
                                  <FoodComposer
                                    initialLine={tokenToText(g.tokens[0])}
                                    context={`${meal.time ? meal.time + ' · ' : ''}${meal.name} · ${o.name || `Opção ${oi + 1}`}`}
                                    onConfirm={(line) => { applyLine(mi, oi, gi, line); setComposer(null); }}
                                    onCancel={() => setComposer(null)}
                                  />
                                </li>
                              );
                            }
                            return (
                              <li key={gi} className="group flex items-start gap-1">
                                <span className="flex-1 min-w-0 text-muted-foreground break-words">
                                  {g.tokens.map(tokenToText).join(' ou ')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setComposer({ mi, oi, gi })}
                                  className="shrink-0 text-muted-foreground hover:text-foreground"
                                  title="Editar alimento"
                                  aria-label="Editar alimento"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeGroupItem(mi, oi, gi)}
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                  title="Remover alimento"
                                  aria-label="Remover alimento"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </li>
                            );
                          })}
                          {isComposing(mi, oi) && composer?.gi == null && (
                            <li>
                              <FoodComposer
                                context={`${meal.time ? meal.time + ' · ' : ''}${meal.name} · ${o.name || `Opção ${oi + 1}`}`}
                                onConfirm={(line) => { applyLine(mi, oi, null, line); setComposer({ mi, oi, gi: null, nonce: Date.now() }); }}
                                onCancel={() => setComposer(null)}
                                key={composer?.nonce ?? 'new'}
                              />
                            </li>
                          )}
                        </ul>

                        {!isComposing(mi, oi) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1 text-[11px] text-emerald-700 hover:bg-emerald-50 mb-1"
                            onClick={() => setComposer({ mi, oi, gi: null })}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Adicionar alimento
                          </Button>
                        )}


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
