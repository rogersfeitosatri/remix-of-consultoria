// Dispatcher: renderiza uma pergunta da ANAMNESE COMPLETA pelo question_type.
// O texto/rótulo da pergunta é mostrado pelo wizard; aqui vai só o controle.
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ChipsInput } from './PrimitiveInputs';
import { FieldGroupField } from './FieldGroupField';
import { MealPlanEditorField } from './MealPlanEditorField';
import { SymptomGridField } from './SymptomGridField';
import { FrequencyGridField } from './FrequencyGridField';
import { TrainingWeekDetailedField } from './TrainingWeekDetailedField';
import { FileUploadField } from './FileUploadField';
import type { FieldProps } from './types';

export interface QuestionLike {
  question_type: string;
  options?: string[] | null;
  scale_min?: number | null;
  scale_max?: number | null;
  config?: Record<string, any> | null;
}

export function QuestionRenderer({
  question, value, onChange, answersByKey, clientId, disabled,
}: {
  question: QuestionLike;
  value: any;
  onChange: (v: any) => void;
  answersByKey: Record<string, any>;
  clientId?: string | null;
  disabled?: boolean;
}) {
  const fp: FieldProps = {
    value, onChange, config: question.config, options: question.options,
    scaleMin: question.scale_min ?? undefined, scaleMax: question.scale_max ?? undefined,
    answersByKey, disabled, clientId,
  };

  switch (question.question_type) {
    case 'field_group': return <FieldGroupField {...fp} />;
    case 'meal_plan_editor': return <MealPlanEditorField {...fp} />;
    case 'symptom_grid': return <SymptomGridField {...fp} />;
    case 'frequency_grid': return <FrequencyGridField {...fp} />;
    case 'training_week': return <TrainingWeekDetailedField {...fp} />;
    case 'file_upload': return <FileUploadField value={value} onChange={onChange} answersByKey={answersByKey} disabled={disabled} clientId={clientId} />;

    case 'textarea':
      return <Textarea rows={4} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return <Input type="number" inputMode="decimal" value={value ?? ''} disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
    case 'date':
      return <Input type="date" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    case 'time':
      return <Input type="time" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    case 'boolean':
      return (
        <RadioGroup value={value ?? ''} onValueChange={onChange} disabled={disabled} className="flex gap-4">
          {['Sim', 'Não'].map((o) => (
            <label key={o} className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value={o} />{o}</label>
          ))}
        </RadioGroup>
      );
    case 'select':
      return (
        <RadioGroup value={value ?? ''} onValueChange={onChange} disabled={disabled} className="space-y-1.5">
          {(question.options || []).map((o) => (
            <label key={o} className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm cursor-pointer ${value === o ? 'border-primary bg-primary/5' : ''}`}>
              <RadioGroupItem value={o} /> {o}
            </label>
          ))}
        </RadioGroup>
      );
    case 'multiselect': {
      const sel: string[] = Array.isArray(value) ? value : [];
      const toggle = (o: string) => onChange(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]);
      return (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(question.options || []).map((o) => (
            <label key={o} className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm cursor-pointer ${sel.includes(o) ? 'border-primary bg-primary/5' : ''}`}>
              <Checkbox checked={sel.includes(o)} onCheckedChange={() => toggle(o)} disabled={disabled} /> <span>{o}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'scale': {
      const min = question.scale_min ?? 0, max = question.scale_max ?? 10;
      const v = typeof value === 'number' ? value : Math.floor((min + max) / 2);
      return (
        <div className="space-y-2">
          <Slider value={[v]} min={min} max={max} step={1} disabled={disabled} onValueChange={(a) => onChange(a[0])} />
          <div className="flex justify-between text-xs text-muted-foreground"><span>{min}</span><span className="font-semibold text-foreground">{v}</span><span>{max}</span></div>
        </div>
      );
    }
    case 'chips':
      return <ChipsInput value={value} onChange={onChange} disabled={disabled} />;
    case 'text':
    default:
      return <Input value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }
}
