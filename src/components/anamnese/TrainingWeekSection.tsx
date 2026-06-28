import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Info, Dumbbell, Plus, X } from 'lucide-react';

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;

const MODALIDADES = [
  { value: 'repouso', label: '😴 Repouso' },
  { value: 'corrida', label: '🏃 Corrida' },
  { value: 'ciclismo', label: '🚴 Ciclismo' },
  { value: 'natacao', label: '🏊 Natação' },
  { value: 'musculacao', label: '🏋️ Musculação' },
  { value: 'funcional', label: '⚡ Funcional' },
  { value: 'triathlon', label: '🏅 Triathlon' },
  { value: 'outro', label: '🎯 Outro' },
];

const TURNOS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
];

const INTENSIDADES = [
  { value: 'leve', label: '🟢 Leve' },
  { value: 'moderado', label: '🟡 Moderado' },
  { value: 'intenso', label: '🔴 Intenso' },
];

export interface TrainingSession {
  modalidade: string;
  turno: string;
  intensidade: string;
  longao?: boolean;
}

// Cada dia pode ter uma ou mais sessões (modalidades)
export type TrainingWeekData = Record<typeof DIAS[number], TrainingSession[]>;

// Modalidades de endurance onde faz sentido marcar "longão" (sessão longa)
const ENDURANCE_MODALIDADES = ['corrida', 'ciclismo', 'natacao', 'triathlon'];

const emptySession = (): TrainingSession => ({ modalidade: '', turno: '', intensidade: '', longao: false });

export const defaultTrainingWeekData: TrainingWeekData = {
  Segunda: [emptySession()],
  Terça: [emptySession()],
  Quarta: [emptySession()],
  Quinta: [emptySession()],
  Sexta: [emptySession()],
  Sábado: [emptySession()],
  Domingo: [emptySession()],
};

interface TrainingWeekSectionProps {
  data: TrainingWeekData;
  onChange: (data: TrainingWeekData) => void;
}

export function TrainingWeekSection({ data, onChange }: TrainingWeekSectionProps) {
  const getSessions = (dia: typeof DIAS[number]): TrainingSession[] => {
    const v = data[dia] as unknown;
    if (Array.isArray(v)) return v.length ? v : [emptySession()];
    if (v && typeof v === 'object' && 'modalidade' in (v as any)) return [v as TrainingSession];
    return [emptySession()];
  };

  const setSessions = (dia: typeof DIAS[number], sessions: TrainingSession[]) => {
    onChange({ ...data, [dia]: sessions });
  };

  const setField = (dia: typeof DIAS[number], idx: number, field: keyof TrainingSession, value: string | boolean) => {
    const sessions = getSessions(dia).map((s, i) => (i === idx ? { ...s, [field]: value } : s));
    if (field === 'modalidade') {
      if (value === 'repouso') {
        sessions[idx] = { modalidade: 'repouso', turno: '', intensidade: '', longao: false };
      } else if (!ENDURANCE_MODALIDADES.includes(value as string)) {
        sessions[idx] = { ...sessions[idx], longao: false };
      }
    }
    setSessions(dia, sessions);
  };

  const addSession = (dia: typeof DIAS[number]) => setSessions(dia, [...getSessions(dia), emptySession()]);
  const removeSession = (dia: typeof DIAS[number], idx: number) => {
    const sessions = getSessions(dia);
    if (sessions.length <= 1) return;
    setSessions(dia, sessions.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold">Rotina de Treino Semanal</h3>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Preencha como costuma ser sua semana de treinos. Você pode adicionar mais de uma modalidade no mesmo dia. Coloque "Repouso" nos dias que não treina.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {DIAS.map((dia) => {
          const sessions = getSessions(dia);
          return (
            <Card key={dia}>
              <CardHeader className="py-3 pb-0">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {dia}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 pb-4 space-y-3">
                {sessions.map((session, idx) => {
                  const isRepouso = session.modalidade === 'repouso';
                  const showLongao = ENDURANCE_MODALIDADES.includes(session.modalidade);
                  return (
                    <div key={idx} className={`space-y-2 ${isRepouso ? 'opacity-60' : ''} ${idx > 0 ? 'pt-3 border-t border-dashed' : ''}`}>
                      <div className="flex items-start gap-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                          <Select value={session.modalidade} onValueChange={(v) => setField(dia, idx, 'modalidade', v)}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Modalidade..." /></SelectTrigger>
                            <SelectContent>
                              {MODALIDADES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={session.turno} onValueChange={(v) => setField(dia, idx, 'turno', v)} disabled={isRepouso || !session.modalidade}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Turno..." /></SelectTrigger>
                            <SelectContent>
                              {TURNOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={session.intensidade} onValueChange={(v) => setField(dia, idx, 'intensidade', v)} disabled={isRepouso || !session.modalidade}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Intensidade..." /></SelectTrigger>
                            <SelectContent>
                              {INTENSIDADES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {sessions.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeSession(dia, idx)} className="h-9 w-9 p-0 shrink-0">
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {showLongao && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`longao-${dia}-${idx}`}
                            checked={!!session.longao}
                            onCheckedChange={(checked) => setField(dia, idx, 'longao', !!checked)}
                          />
                          <Label htmlFor={`longao-${dia}-${idx}`} className="cursor-pointer font-normal text-sm">
                            🐢 É o <strong>longão</strong> da semana
                            <span className="text-xs text-muted-foreground ml-1">(volume longo / sessão de resistência)</span>
                          </Label>
                        </div>
                      )}
                    </div>
                  );
                })}

                <Button type="button" variant="ghost" size="sm" onClick={() => addSession(dia)} className="gap-1 px-2 h-8 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Adicionar modalidade neste dia
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
