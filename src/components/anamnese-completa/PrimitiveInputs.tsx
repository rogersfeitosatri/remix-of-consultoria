// Inputs primitivos + chips + sub-campo (usados por field_group e structured_list).
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import { isSubFieldVisible } from '@/lib/anamneseConditions';
import type { SubField } from '@/lib/anamneseCompletaQuestions';
import type { SubFieldProps } from './types';
import { StructuredListField } from './StructuredListField';
import { FileUploadField } from './FileUploadField';

// ─────────── Chips / tags ───────────
export function ChipsInput({ value, onChange, disabled, placeholder }: {
  value: string[] | undefined; onChange: (v: string[]) => void; disabled?: boolean; placeholder?: string;
}) {
  const [text, setText] = useState('');
  const items = Array.isArray(value) ? value : [];
  const add = () => {
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...items];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setText('');
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={text} disabled={disabled}
          placeholder={placeholder || 'Digite e pressione Enter ou vírgula'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add} disabled={disabled}><Plus className="h-4 w-4" /></Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {it}
              {!disabled && <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────── Multiselect (checkboxes) ───────────
function MultiSelect({ options, value, onChange, disabled }: {
  options: string[]; value: string[] | undefined; onChange: (v: string[]) => void; disabled?: boolean;
}) {
  const sel = Array.isArray(value) ? value : [];
  const toggle = (opt: string) => {
    if (sel.includes(opt)) onChange(sel.filter((o) => o !== opt));
    else onChange([...sel, opt]);
  };
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {options.map((opt) => (
        <label key={opt} className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm cursor-pointer ${sel.includes(opt) ? 'border-primary bg-primary/5' : ''}`}>
          <Checkbox checked={sel.includes(opt)} onCheckedChange={() => toggle(opt)} disabled={disabled} />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

// ─────────── Sub-campo genérico ───────────
// Renderiza um SubField respeitando show_if. `from` (select_from) usa as opções
// selecionadas em outro sub-campo do mesmo grupo.
export function SubFieldInput({ field, value, onChange, selfScope, answersByKey, disabled, clientId }: SubFieldProps) {
  if (!isSubFieldVisible(field, selfScope, answersByKey)) return null;

  const control = (() => {
    switch (field.type) {
      case 'textarea':
        return <Textarea rows={3} value={value ?? ''} disabled={disabled} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
      case 'number':
        return (
          <div className="flex items-center gap-2">
            <Input type="number" inputMode="decimal" value={value ?? ''} disabled={disabled} placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
            {field.unit && <span className="text-sm text-muted-foreground">{field.unit}</span>}
          </div>
        );
      case 'date':
        return <Input type="date" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      case 'time':
        return <Input type="time" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      case 'boolean':
        return (
          <RadioGroup value={value ?? ''} onValueChange={onChange} disabled={disabled} className="flex gap-4">
            {['Sim', 'Não'].map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value={o} />{o}</label>
            ))}
          </RadioGroup>
        );
      case 'select':
        return (
          <Select value={value ?? ''} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>{(field.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        );
      case 'select_from': {
        const from = field.from ? selfScope[field.from] : [];
        const opts: string[] = Array.isArray(from) ? from : [];
        return (
          <Select value={value ?? ''} onValueChange={onChange} disabled={disabled || opts.length === 0}>
            <SelectTrigger><SelectValue placeholder={opts.length ? 'Selecione…' : 'Selecione as opções acima primeiro'} /></SelectTrigger>
            <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        );
      }
      case 'multiselect':
        return <MultiSelect options={field.options || []} value={value} onChange={onChange} disabled={disabled} />;
      case 'chips':
        return <ChipsInput value={value} onChange={onChange} disabled={disabled} placeholder={field.placeholder} />;
      case 'structured_list':
        return <StructuredListField field={field} value={value} onChange={onChange} selfScope={selfScope} answersByKey={answersByKey} disabled={disabled} clientId={clientId} />;
      case 'file_upload':
        return <FileUploadField value={value} onChange={onChange} answersByKey={answersByKey} disabled={disabled} clientId={clientId} />;
      case 'text':
      default:
        return <Input value={value ?? ''} disabled={disabled} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    }
  })();

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
      {control}
    </div>
  );
}

export type { SubField };
