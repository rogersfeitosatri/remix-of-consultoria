// Lista repetível de sub-campos (ex.: produtos intra-treino, medicamentos,
// suplementos). answer = [{ [subkey]: valor }]. Sub-campos não recursam em
// structured_list para manter a UI simples.
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy } from 'lucide-react';
import { SubFieldInput } from './PrimitiveInputs';
import type { SubFieldProps } from './types';

export function StructuredListField({ field, value, onChange, answersByKey, disabled, clientId }: SubFieldProps) {
  const rows: Record<string, any>[] = Array.isArray(value) ? value : [];
  const subFields = (field.fields || []).filter((f) => f.type !== 'structured_list');

  const update = (i: number, patch: Record<string, any>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  const addRow = () => onChange([...rows, {}]);
  const dupRow = (i: number) => onChange([...rows.slice(0, i + 1), { ...rows[i] }, ...rows.slice(i + 1)]);
  const delRow = (i: number) => onChange(rows.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
            {!disabled && (
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => dupRow(i)}><Copy className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => delRow(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {subFields.map((sf) => (
              <SubFieldInput
                key={sf.key}
                field={sf}
                value={row[sf.key]}
                onChange={(v) => update(i, { [sf.key]: v })}
                selfScope={row}
                answersByKey={answersByKey}
                disabled={disabled}
                clientId={clientId}
              />
            ))}
          </div>
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" /> {field.addLabel || 'Adicionar'}
        </Button>
      )}
    </div>
  );
}
