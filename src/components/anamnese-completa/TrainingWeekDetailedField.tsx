// Pergunta 8 — "Semana habitual de treinamento".
// Editor semanal Segunda→Domingo, múltiplas sessões por dia, cada sessão com
// campos detalhados (horário, modalidade, tipo, duração, distância, RPE, notas).
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Copy } from 'lucide-react';
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

type Week = Record<string, Session[]>;

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;

const DEFAULT_MODALITIES = ['Corrida', 'Musculação', 'Ciclismo', 'Natação', 'Mobilidade', 'Outra'];
const DEFAULT_SESSION_TYPES = ['Descanso', 'Regenerativo', 'Corrida leve', 'Competição', 'Outro'];

function emptySession(): Session {
  return {
    start_time: '',
    modality: '',
    session_type: '',
    duration_minutes: '',
    distance_km: '',
    rpe: '',
    notes: '',
  };
}

function normalizeWeek(value: any): Week {
  const week: Week = {};
  for (const day of WEEKDAYS) {
    const arr = value?.[day];
    week[day] = Array.isArray(arr) ? (arr as Session[]) : [];
  }
  return week;
}

const numToStr = (n: NumOrEmpty) => (n === '' || n == null ? '' : String(n));
const strToNum = (s: string): NumOrEmpty => (s === '' ? '' : Number(s));

export function TrainingWeekDetailedField({ value, onChange, config, disabled }: FieldProps) {
  const week = normalizeWeek(value);
  const modalities: string[] = Array.isArray(config?.modalities) ? config!.modalities : DEFAULT_MODALITIES;
  const sessionTypes: string[] = Array.isArray(config?.sessionTypes) ? config!.sessionTypes : DEFAULT_SESSION_TYPES;

  const emit = (day: string, sessions: Session[]) => {
    onChange({ ...week, [day]: sessions });
  };

  const updateSession = (day: string, i: number, patch: Partial<Session>) => {
    emit(day, week[day].map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };
  const addSession = (day: string) => emit(day, [...week[day], emptySession()]);
  const dupSession = (day: string, i: number) =>
    emit(day, [...week[day].slice(0, i + 1), { ...week[day][i] }, ...week[day].slice(i + 1)]);
  const delSession = (day: string, i: number) =>
    emit(day, week[day].filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      {WEEKDAYS.map((day) => {
        const sessions = week[day];
        return (
          <Card key={day}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold">{day}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {sessions.length} {sessions.length === 1 ? 'sessão' : 'sessões'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessions.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma sessão (descanso)</p>
              )}

              {sessions.map((s, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Sessão {i + 1}</span>
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
                      <Label className="text-xs text-muted-foreground">Horário de início</Label>
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
                          {modalities.map((m) => (
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
              ))}

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
          </Card>
        );
      })}
    </div>
  );
}
