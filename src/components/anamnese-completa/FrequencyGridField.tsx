// Pergunta 28 — "Frequência de consumo de grupos alimentares".
// Grade de linhas (grupos alimentares) x colunas de escolha única (frequência).
// answer = { [grupo]: coluna_escolhida }. Mobile-first: cada linha vira um card
// com o rótulo do grupo e as colunas como chips que quebram linha (1 escolha).
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';
import type { FieldProps } from './types';

export function FrequencyGridField({ value, onChange, config, disabled }: FieldProps) {
  const rows: string[] = Array.isArray(config?.rows) ? config!.rows : [];
  const columns: string[] = Array.isArray(config?.columns) ? config!.columns : [];
  const answer: Record<string, string> =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  const select = (row: string, column: string) => {
    if (disabled) return;
    const next = { ...answer };
    if (next[row] === column) {
      delete next[row]; // toggle off para permitir limpar a escolha
    } else {
      next[row] = column;
    }
    onChange(next);
  };

  if (rows.length === 0 || columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Configuração de frequência indisponível (linhas/colunas não definidas).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const selected = answer[row];
        return (
          <div key={row} className="rounded-lg border p-3 space-y-2">
            <Label className="text-sm font-medium leading-snug">{row}</Label>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((column) => {
                const isSel = selected === column;
                return (
                  <button
                    key={column}
                    type="button"
                    role="radio"
                    aria-checked={isSel}
                    disabled={disabled}
                    onClick={() => select(row, column)}
                    className={[
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      isSel
                        ? 'border-primary bg-primary/5 text-primary font-medium'
                        : 'border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    ].join(' ')}
                  >
                    {isSel && <Check className="h-3 w-3 shrink-0" />}
                    {column}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
