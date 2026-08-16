// Etapa de revisão da importação (PDF/MD): mostra o que foi reconhecido —
// refeições, horários, opções, alimentos, quantidades e medidas — e destaca os
// itens que precisam de revisão manual. Nada é gravado sem confirmação: o nutri
// escolhe entre ADICIONAR ao plano atual, SUBSTITUIR o plano da aba ou CANCELAR.

import { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { parseText } from '@/lib/smartPlan/parse';
import { tokenToText } from '@/lib/smartPlan/serialize';

interface Props {
  open: boolean;
  /** Texto do plano reconhecido no arquivo. */
  importedText: string;
  /** Rótulo do destino (ex.: "Segunda-feira" ou "Todos os dias"). */
  targetLabel: string;
  /** true quando a aba de destino já tem plano — habilita "Substituir". */
  hasExisting: boolean;
  onAppend: () => void;
  onReplace: () => void;
  onCancel: () => void;
}

export function ImportPreviewDialog({
  open, importedText, targetLabel, hasExisting, onAppend, onReplace, onCancel,
}: Props) {
  const ast = useMemo(() => parseText(importedText || ''), [importedText]);

  const unresolved = useMemo(() => {
    const out: string[] = [];
    for (const meal of ast.meals) {
      const opts = meal.options?.length ? meal.options : [{ name: 'Opção 1', groups: meal.groups }];
      for (const o of opts) {
        for (const g of o.groups) {
          const t = g.tokens[0];
          if (!t) continue;
          if (!t.measure && t.quantity == null) out.push(`${meal.name} · ${t.name}`);
        }
      }
    }
    return out;
  }, [ast]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisar importação</DialogTitle>
          <DialogDescription>
            Confira o que foi reconhecido antes de gravar. Destino: <b>{targetLabel}</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            {ast.meals.length} refeição(ões) reconhecida(s).
          </p>

          {ast.meals.map((meal, mi) => {
            const opts = meal.options?.length ? meal.options : [{ name: 'Opção 1', primary: true, groups: meal.groups }];
            return (
              <div key={mi} className="rounded-md border p-2">
                <p className="font-medium text-sm">
                  {meal.time ? `${meal.time} · ` : ''}{meal.name}
                </p>
                {opts.map((o, oi) => (
                  <div key={oi} className="mt-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {o.name || `Opção ${oi + 1}`}
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {o.groups.length === 0 && <li className="italic">Sem alimentos</li>}
                      {o.groups.map((g, gi) => (
                        <li key={gi}>{g.tokens.map(tokenToText).join(' ou ')}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {meal.notes && <p className="mt-1 text-[11px] italic text-muted-foreground">{meal.notes}</p>}
              </div>
            );
          })}

          {unresolved.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              <p className="flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> Itens sem quantidade/medida — revise manualmente:
              </p>
              <ul className="mt-1 list-disc pl-4">
                {unresolved.slice(0, 12).map((u, i) => <li key={i}>{u}</li>)}
                {unresolved.length > 12 && <li>+ {unresolved.length - 12} …</li>}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="button" variant="outline" onClick={onAppend}>Adicionar ao plano atual</Button>
          <Button type="button" onClick={onReplace} disabled={!hasExisting && false}>
            {hasExisting ? 'Substituir plano da aba' : 'Usar como plano da aba'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
