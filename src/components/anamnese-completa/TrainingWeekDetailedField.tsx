// Pergunta 8 — "Semana habitual de treinamento".
// 1) Grade Modalidade × Dia (D S T Q Q S S) para o atleta marcar em quais dias
//    executa cada modalidade escolhida na pergunta anterior.
// 2) Editor semanal Segunda→Domingo, múltiplas sessões por dia, cada sessão com
//    campos detalhados (horário, modalidade, tipo, duração, distância, RPE, notas).
// Dias planejados sem sessão preenchida ficam em vermelho e bloqueiam avanço.
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Copy, ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldProps } from './types';

type NumOrEmpty = number | '';

interface Session {
  start_time: string;
  modality: string;
  session_type: string;
  duration_minutes: NumOrEmpty;
  distance_km: NumOrEmpty;
  rpe: NumOrEmpty;
  notes: string;
}

type PlanningMap = Record<string, string[]>; // modality -> day names
// Week: runtime tem chaves de dia (Session[]) e __planning. Usamos any-index no
// TypeScript para evitar união em cada acesso.
type Week = {
  [day: string]: any;
  __planning?: PlanningMap;
};

const daySessions = (w: Week, day: string): Session[] =>
  (Array.isArray(w[day]) ? (w[day] as Session[]) : []);

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;
// Ordem de exibição da grade (usuário pediu Dom→Sáb) e iniciais.
const GRID_DAYS: { name: typeof WEEKDAYS[number]; initial: string }[] = [
  { name: 'Domingo', initial: 'D' },
  { name: 'Segunda', initial: 'S' },
  { name: 'Terça', initial: 'T' },
  { name: 'Quarta', initial: 'Q' },
  { name: 'Quinta', initial: 'Q' },
  { name: 'Sexta', initial: 'S' },
  { name: 'Sábado', initial: 'S' },
];

const DEFAULT_MODALITIES = ['Corrida', 'Musculação', 'Ciclismo', 'Natação', 'Mobilidade', 'Outra'];
const DEFAULT_SESSION_TYPES = ['Descanso', 'Regenerativo', 'Corrida leve', 'Competição', 'Outro'];

// Mapa da resposta de "modalidade_experiencia" (endurance) → modalidades canônicas do editor.
function expandModalityChoice(choice: string, outra?: string): string[] {
  switch (choice) {
    case 'Corrida de rua':
    case 'Trail running':
      return ['Corrida'];
    case 'Ciclismo':
      return ['Ciclismo'];
    case 'Natação':
      return ['Natação'];
    case 'Triatlo':
      return ['Corrida', 'Ciclismo', 'Natação'];
    case 'Duatlo':
      return ['Corrida', 'Ciclismo'];
    case 'Outra modalidade de endurance':
      return [outra?.trim() ? outra.trim() : 'Outra'];
    default:
      return [];
  }
}

function emptySession(modality = ''): Session {
  return {
    start_time: '',
    modality,
    session_type: '',
    duration_minutes: '',
    distance_km: '',
    rpe: '',
    notes: '',
  };
}

function normalizeWeek(value: any): Week {
  const week: Week = {} as Week;
  for (const day of WEEKDAYS) {
    const arr = value?.[day];
    week[day] = Array.isArray(arr) ? (arr as Session[]) : [];
  }
  const planning = value?.__planning;
  week.__planning = planning && typeof planning === 'object' ? { ...planning } : {};
  return week;
}

function sessionHasContent(s: Session): boolean {
  return !!(
    String(s.start_time || '').trim() ||
    String(s.session_type || '').trim() ||
    (s.duration_minutes !== '' && s.duration_minutes != null) ||
    (s.distance_km !== '' && s.distance_km != null) ||
    String(s.notes || '').trim()
  );
}

const numToStr = (n: NumOrEmpty) => (n === '' || n == null ? '' : String(n));
const strToNum = (s: string): NumOrEmpty => (s === '' ? '' : Number(s));

export function TrainingWeekDetailedField({ value, onChange, config, disabled, answersByKey }: FieldProps) {
  const week = normalizeWeek(value);
  const modalityOptions: string[] = Array.isArray(config?.modalities) ? config!.modalities : DEFAULT_MODALITIES;
  const sessionTypes: string[] = Array.isArray(config?.sessionTypes) ? config!.sessionTypes : DEFAULT_SESSION_TYPES;

  // Modalidades derivadas da pergunta "modalidade_experiencia".
  const gridModalities = useMemo<string[]>(() => {
    const src = answersByKey?.modalidade_experiencia;
    const chosen: string[] = Array.isArray(src?.modalidades) ? src.modalidades : [];
    const outra: string | undefined = src?.outra_modalidade;
    const set = new Set<string>();
    for (const c of chosen) for (const m of expandModalityChoice(c, outra)) set.add(m);
    return Array.from(set);
  }, [answersByKey]);

  const planning: PlanningMap = week.__planning || {};

  // Todos os dias iniciam recolhidos; o atleta clica para expandir.
  const [openDays, setOpenDays] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of WEEKDAYS) init[d] = false;
    return init;
  });
  const toggleDay = (day: string) => setOpenDays((s) => ({ ...s, [day]: !s[day] }));

  const commit = (nextWeek: Week) => onChange(nextWeek);

  const emit = (day: string, sessions: Session[]) => {
    commit({ ...week, [day]: sessions });
  };

  const updateSession = (day: string, i: number, patch: Partial<Session>) => {
    emit(day, daySessions(week, day).map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };
  const addSession = (day: string, modality = '') => {
    setOpenDays((s) => ({ ...s, [day]: true }));
    emit(day, [...daySessions(week, day), emptySession(modality)]);
  };
  const dupSession = (day: string, i: number) => {
    const arr = daySessions(week, day);
    emit(day, [...arr.slice(0, i + 1), { ...arr[i] }, ...arr.slice(i + 1)]);
  };
  const delSession = (day: string, i: number) =>
    emit(day, daySessions(week, day).filter((_, j) => j !== i));

  // Toggle célula (modalidade × dia). Auto-cria uma sessão vazia com a modalidade
  // no dia quando não houver nenhuma daquela modalidade; abre o dia.
  const toggleCell = (modality: string, day: typeof WEEKDAYS[number]) => {
    if (disabled) return;
    const current = new Set(planning[modality] || []);
    const next: PlanningMap = { ...planning };
    if (current.has(day)) {
      current.delete(day);
    } else {
      current.add(day);
    }
    next[modality] = Array.from(current);
    const sessions = [...daySessions(week, day)];
    const nowChecked = current.has(day);
    if (nowChecked && !sessions.some((s) => s.modality === modality)) {
      sessions.push(emptySession(modality));
      setOpenDays((s) => ({ ...s, [day]: true }));
    }
    commit({ ...week, __planning: next, [day]: sessions });
  };

  // Limpa planejamento se as modalidades da pergunta anterior mudarem (mantém o
  // que ainda existir; remove entradas órfãs).
  useEffect(() => {
    if (!gridModalities.length) return;
    const set = new Set(gridModalities);
    const cleaned: PlanningMap = {};
    let changed = false;
    for (const k of Object.keys(planning)) {
      if (set.has(k)) cleaned[k] = planning[k];
      else changed = true;
    }
    if (changed) commit({ ...week, __planning: cleaned });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridModalities.join('|')]);

  // Dias planejados que ainda não têm sessão com conteúdo → destacar em vermelho.
  const missingByDay = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [modality, days] of Object.entries(planning)) {
      for (const day of (days as string[]) || []) {
        const sessions = daySessions(week, day);
        const ok = sessions.some((s) => s.modality === modality && sessionHasContent(s));
        if (!ok) (out[day] ||= []).push(modality);
      }
    }
    return out;
  }, [planning, week]);

  return (
    <div className="space-y-4">
      {/* Grade Modalidade × Dia */}
      {gridModalities.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="text-sm font-medium">Em quais dias você executa cada modalidade?</div>
            <p className="text-xs text-muted-foreground">
              Marque os dias. Depois preencha os detalhes de cada treino abaixo.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-xs text-muted-foreground py-1 pr-2">Modalidade</th>
                    {GRID_DAYS.map((d) => (
                      <th
                        key={d.name}
                        title={d.name}
                        className="text-center font-medium text-xs text-muted-foreground py-1 px-1 w-9"
                      >
                        {d.initial}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridModalities.map((m) => (
                    <tr key={m} className="border-t">
                      <td className="py-1.5 pr-2 text-sm font-medium">{m}</td>
                      {GRID_DAYS.map((d) => {
                        const checked = (planning[m] || []).includes(d.name);
                        return (
                          <td key={d.name} className="text-center px-1 py-1.5">
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleCell(m, d.name)}
                              aria-label={`${m} ${d.name}`}
                              aria-pressed={checked}
                              className={cn(
                                'h-6 w-6 rounded-full border transition-colors mx-auto flex items-center justify-center',
                                checked
                                  ? 'bg-primary border-primary'
                                  : 'bg-background border-muted-foreground/30 hover:border-primary',
                                disabled && 'opacity-60 cursor-not-allowed',
                              )}
                            >
                              {checked && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {WEEKDAYS.map((day) => {
        const sessions = week[day];
        const isOpen = !!openDays[day];
        const missing = missingByDay[day] || [];
        const hasMissing = missing.length > 0;
        return (
          <Collapsible key={day} open={isOpen} onOpenChange={() => toggleDay(day)}>
            <Card className={cn(hasMissing && 'border-destructive')}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                    />
                    <span className={cn('text-sm font-semibold', hasMissing && 'text-destructive')}>{day}</span>
                    {hasMissing && (
                      <span className="flex items-center gap-1 text-xs text-destructive font-normal">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Falta preencher: {missing.join(', ')}
                      </span>
                    )}
                  </div>
                  <Badge variant={sessions.length ? 'secondary' : 'outline'} className="text-xs">
                    {sessions.length === 0 ? 'Descanso' : `${sessions.length} ${sessions.length === 1 ? 'sessão' : 'sessões'}`}
                  </Badge>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma sessão (descanso)</p>
              )}

              {sessions.map((s, i) => {
                const plannedForThis = !!s.modality && (planning[s.modality] || []).includes(day);
                const sessionMissing = plannedForThis && !sessionHasContent(s);
                return (
                <div
                  key={i}
                  className={cn('rounded-lg border p-3 space-y-2', sessionMissing && 'border-destructive')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Sessão {i + 1}{s.modality ? ` — ${s.modality}` : ''}
                    </span>
                    {!disabled && (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => dupSession(day, i)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => delSession(day, i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Hora do dia</Label>
                      <Input
                        type="time"
                        value={s.start_time}
                        disabled={disabled}
                        onChange={(e) => updateSession(day, i, { start_time: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Modalidade</Label>
                      <Select
                        value={s.modality || undefined}
                        disabled={disabled}
                        onValueChange={(v) => updateSession(day, i, { modality: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(new Set([...modalityOptions, ...gridModalities])).map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo de sessão</Label>
                      <Select
                        value={s.session_type || undefined}
                        disabled={disabled}
                        onValueChange={(v) => updateSession(day, i, { session_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {sessionTypes.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">RPE (1–10)</Label>
                      <Select
                        value={s.rpe === '' ? undefined : String(s.rpe)}
                        disabled={disabled}
                        onValueChange={(v) => updateSession(day, i, { rpe: strToNum(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Duração (min)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="min"
                        value={numToStr(s.duration_minutes)}
                        disabled={disabled}
                        onChange={(e) => updateSession(day, i, { duration_minutes: strToNum(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Distância (km)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        placeholder="km"
                        value={numToStr(s.distance_km)}
                        disabled={disabled}
                        onChange={(e) => updateSession(day, i, { distance_km: strToNum(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">Observações</Label>
                      <Input
                        type="text"
                        placeholder="Notas (opcional)"
                        value={s.notes}
                        disabled={disabled}
                        onChange={(e) => updateSession(day, i, { notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                );
              })}

              {!disabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => addSession(day)}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar sessão
                </Button>
              )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
