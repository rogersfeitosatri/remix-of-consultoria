// Grupo de campos fixos com sub-campos condicionais. answer = { [subkey]: valor }.
import { SubFieldInput } from './PrimitiveInputs';
import type { FieldProps } from './types';
import type { SubField } from '@/lib/anamneseCompletaQuestions';

export function FieldGroupField({ value, onChange, config, answersByKey, disabled, clientId }: FieldProps) {
  const group: Record<string, any> = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fields: SubField[] = config?.fields || [];

  const setField = (key: string, v: any) => onChange({ ...group, [key]: v });

  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <SubFieldInput
          key={f.key}
          field={f}
          value={group[f.key]}
          onChange={(v) => setField(f.key, v)}
          selfScope={group}
          answersByKey={answersByKey}
          disabled={disabled}
          clientId={clientId}
        />
      ))}
    </div>
  );
}
