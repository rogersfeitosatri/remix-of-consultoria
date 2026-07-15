// Pergunta 15 — "Sintomas gastrointestinais".
// Grade de seleção de sintomas; para cada sintoma SELECIONADO, coleta
// momentos (multi), frequência (single) e intensidade (single).
// A opção "Nenhum" (config.noneOption) é mutuamente exclusiva.
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check } from 'lucide-react';
import type { FieldProps } from './types';

interface SymptomDetail {
  moments: string[];
  frequency: string;
  intensity: string;
}
interface SymptomValue {
  selected: string[];
  detail: Record<string, SymptomDetail>;
}

const EMPTY_DETAIL: SymptomDetail = { moments: [], frequency: '', intensity: '' };

function normalize(value: any): SymptomValue {
  const selected = Array.isArray(value?.selected) ? (value.selected as string[]) : [];
  const detail = value?.detail && typeof value.detail === 'object' ? (value.detail as Record<string, SymptomDetail>) : {};
  return { selected, detail };
}

export function SymptomGridField({ value, onChange, config, disabled }: FieldProps) {
  const current = normalize(value);
  const symptoms: string[] = Array.isArray(config?.symptoms) ? config!.symptoms : [];
  const noneOption: string | undefined = config?.noneOption ?? undefined;
  const moments: string[] = Array.isArray(config?.moments) ? config!.moments : [];
  const frequencies: string[] = Array.isArray(config?.frequencies) ? config!.frequencies : [];
  const intensities: string[] = Array.isArray(config?.intensities) ? config!.intensities : [];

  const emit = (selected: string[], detail: Record<string, SymptomDetail>) => {
    // Poda o detalhe de qualquer sintoma que não esteja mais selecionado.
    const pruned: Record<string, SymptomDetail> = {};
    for (const sym of selected) {
      if (sym === noneOption) continue;
      if (detail[sym]) pruned[sym] = detail[sym];
    }
    onChange({ selected, detail: pruned });
  };

  const toggleSymptom = (sym: string, checked: boolean) => {
    if (disabled) return;
    if (!checked) {
      emit(
        current.selected.filter((s) => s !== sym),
        current.detail,
      );
      return;
    }
    // Seleção da opção "Nenhum" limpa todas as demais.
    if (noneOption && sym === noneOption) {
      emit([noneOption], {});
      return;
    }
    // Seleção de qualquer outro sintoma remove "Nenhum".
    const base = current.selected.filter((s) => s !== noneOption && s !== sym);
    const nextDetail = { ...current.detail, [sym]: current.detail[sym] ?? EMPTY_DETAIL };
    emit([...base, sym], nextDetail);
  };

  const setDetail = (sym: string, patch: Partial<SymptomDetail>) => {
    if (disabled) return;
    const prev = current.detail[sym] ?? EMPTY_DETAIL;
    emit(current.selected, { ...current.detail, [sym]: { ...prev, ...patch } });
  };

  const toggleMoment = (sym: string, moment: string, checked: boolean) => {
    const prev = current.detail[sym]?.moments ?? [];
    const next = checked ? [...prev.filter((m) => m !== moment), moment] : prev.filter((m) => m !== moment);
    setDetail(sym, { moments: next });
  };

  return (
    <div className="space-y-2">
      {symptoms.map((sym) => {
        const isSelected = current.selected.includes(sym);
        const isNone = noneOption != null && sym === noneOption;
        const detail = current.detail[sym] ?? EMPTY_DETAIL;
        return (
          <div
            key={sym}
            className={`rounded-lg border p-3 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}
          >
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={isSelected}
                disabled={disabled}
                onCheckedChange={(c) => toggleSymptom(sym, c === true)}
                aria-label={sym}
              />
              <span className="text-sm font-medium leading-tight flex items-center gap-1.5">
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                {sym}
              </span>
            </label>

            {isSelected && !isNone && (
              <div className="mt-3 space-y-3 pl-6">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Momento</Label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {moments.map((m) => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={detail.moments.includes(m)}
                          disabled={disabled}
                          onCheckedChange={(c) => toggleMoment(sym, m, c === true)}
                          aria-label={m}
                        />
                        <span className="text-sm">{m}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Frequência</Label>
                    <Select
                      value={detail.frequency || undefined}
                      disabled={disabled}
                      onValueChange={(v) => setDetail(sym, { frequency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencies.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Intensidade</Label>
                    <Select
                      value={detail.intensity || undefined}
                      disabled={disabled}
                      onValueChange={(v) => setDetail(sym, { intensity: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {intensities.map((i) => (
                          <SelectItem key={i} value={i}>
                            {i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
