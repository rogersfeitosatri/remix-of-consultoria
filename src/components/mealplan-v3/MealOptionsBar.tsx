// Barra de refeições detectadas com controle de OPÇÕES por refeição.
// Uma refeição pode ter várias "Opções" (ex.: Opção 1 / Opção 2). O nutri
// marca qual é a PRINCIPAL (★) — só a principal entra nos cálculos do dia.
//
// Mutação: parse do texto → mutação do AST → serialize → setText. Assim o
// próprio editor textual reflete o marcador `== Opção N` (com `*` na principal).

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Star, Trash2 } from 'lucide-react';
import { parseText } from '@/lib/smartPlan/parse';
import { astToText } from '@/lib/smartPlan/serialize';
import type { MealOption } from '@/lib/smartPlan/ast';

interface Props {
  text: string;
  onChange: (next: string) => void;
}

function optionsOf(meal: any): MealOption[] {
  if (meal.options && meal.options.length) return meal.options;
  return [{ name: 'Opção 1', primary: true, groups: meal.groups }];
}

export function MealOptionsBar({ text, onChange }: Props) {
  const ast = parseText(text || '');
  if (!ast.meals.length) return null;

  const mutate = (fn: (ast: ReturnType<typeof parseText>) => void) => {
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

  return (
    <div className="mb-3 rounded-md border bg-muted/30 p-2 space-y-1.5">
      <p className="text-[11px] md:text-xs font-semibold text-muted-foreground">
        Opções por refeição — ★ define qual entra nos cálculos do dia
      </p>
      {ast.meals.map((meal, mi) => {
        const opts = optionsOf(meal);
        return (
          <div key={mi} className="flex flex-wrap items-center gap-1.5 py-1">
            <span className="text-xs font-medium min-w-0 truncate max-w-[180px]">
              {meal.time ? `${meal.time} · ` : ''}{meal.name}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {opts.map((o, oi) => (
                <Badge
                  key={oi}
                  variant={o.primary ? 'default' : 'secondary'}
                  className="h-6 gap-1 pl-1.5 pr-1 text-[10px]"
                >
                  <button
                    type="button"
                    title={o.primary ? 'Opção principal' : 'Definir como principal'}
                    onClick={() => setPrimary(mi, oi)}
                    className="inline-flex items-center"
                  >
                    <Star className={`h-3 w-3 ${o.primary ? 'fill-current' : ''}`} />
                  </button>
                  <span>{o.name || `Opção ${oi + 1}`}</span>
                  {opts.length > 1 && (
                    <button
                      type="button"
                      title="Remover opção"
                      onClick={() => removeOption(mi, oi)}
                      className="inline-flex items-center opacity-70 hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px] border"
                onClick={() => addOption(mi)}
                title="Adicionar nova opção a esta refeição"
              >
                <Plus className="h-3 w-3 mr-0.5" /> Opção
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
