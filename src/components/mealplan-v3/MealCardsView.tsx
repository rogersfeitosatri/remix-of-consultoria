// Visualização em cards do plano montado no editor.
// Cada refeição vira uma linha separada por um divisor bem fino/claro.
// As OPÇÕES da refeição ficam lado a lado (lateralizadas). Ao lado do título
// há um botão "+" para adicionar mais uma opção àquela refeição. Cada card
// mostra, no rodapé, o resumo abreviado (kcal/CHO/PTN/LIP) da opção.
//
// A fonte de verdade continua sendo o texto do editor (SmartPlanEditor). Este
// componente apenas parseia o texto, enriquece com os macros e oferece
// atalhos visuais (adicionar opção, marcar principal, remover). Toda edição
// de alimentos continua acontecendo dentro do textarea abaixo.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Star, Trash2 } from 'lucide-react';
import { parseText } from '@/lib/smartPlan/parse';
import { astToText } from '@/lib/smartPlan/serialize';
import { enrichAst, makeEnrichCache } from '@/lib/smartPlan/enrich';
import type { MealOption, MealBlock, PlanAst } from '@/lib/smartPlan/ast';
import { tokenToText } from '@/lib/smartPlan/serialize';

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

export function MealCardsView({ text, onChange }: Props) {
  const [ast, setAst] = useState<PlanAst>(() => parseText(text || ''));
  const enrichCache = useRef(makeEnrichCache());

  // Enriquece com macros (debounce curto).
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const next = parseText(text || '');
        await enrichAst(next, enrichCache.current);
        setAst(next);
      } catch { /* silencioso */ }
    }, 350);
    return () => clearTimeout(t);
  }, [text]);

  const mutate = (fn: (a: PlanAst) => void) => {
    const next = parseText(text || '');
    fn(next);
    onChange(astToText(next));
  };

  const addOption = (mealIdx: number) =>
    mutate((a) => {
      const meal = a.meals[mealIdx];
      const opts = optionsOf(meal).map((o) => ({ ...o, groups: [...o.groups] }));
      opts.push({ name: `Opção ${opts.length + 1}`, primary: false, groups: [] });
      meal.options = opts;
      const primary = opts.find((o) => o.primary) || opts[0];
      meal.groups = primary.groups;
    });

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

  const meals = useMemo(() => ast.meals, [ast]);
  if (!meals.length) return null;

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
            {/* Título + botão de adicionar opção */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium truncate">
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
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Opções lado a lado */}
            <div className="flex flex-nowrap overflow-x-auto gap-0">
              {opts.map((o, oi) => {
                const t = totalsOfOption(o);
                return (
                  <div
                    key={oi}
                    className={`min-w-[240px] max-w-[320px] flex-1 px-3 py-2 ${
                      oi < opts.length - 1 ? 'border-r border-border/40' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPrimary(mi, oi)}
                          title={o.primary ? 'Opção principal (entra nos cálculos)' : 'Definir como principal'}
                          className={`inline-flex items-center ${o.primary ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}
                        >
                          <Star className={`h-3.5 w-3.5 ${o.primary ? 'fill-current' : ''}`} />
                        </button>
                        <span className="text-xs font-medium">
                          {o.name || `Opção ${oi + 1}`}
                        </span>
                      </div>
                      {opts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOption(mi, oi)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Remover opção"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>

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
