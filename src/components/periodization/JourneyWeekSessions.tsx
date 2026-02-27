import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dumbbell, Save, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const SHIFTS = ['Manhã', 'Tarde', 'Noite'];
const INTENSITIES = ['Leve', 'Moderado', 'Intenso'];
const PRIORITIES = ['A', 'B', 'C'];

interface Session {
  id?: string;
  journey_week_id: string;
  day_of_week: number;
  modality: string;
  shift: string;
  intensity: string;
  priority: string;
  metabolic_objective: string;
  duration_minutes?: number | null;
  is_day_off?: boolean;
  is_long_run?: boolean;
  carb_loading_enabled?: boolean;
  carb_loading_hours?: number | null;
}

interface Props {
  weekId: string;
  weekNumber: number;
  weekInPhase: number;
  phaseName: string;
  existingSessions: any[];
  onSaveSessions: (weekId: string, sessions: Omit<Session, 'id'>[]) => void;
  isSaving: boolean;
}

export function JourneyWeekSessions({
  weekId, weekNumber, weekInPhase, phaseName, existingSessions, onSaveSessions, isSaving
}: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (existingSessions.length > 0) {
      setSessions(existingSessions.map(s => ({ ...s })));
    } else {
      setSessions(DAYS.map((_, i) => ({
        journey_week_id: weekId,
        day_of_week: i,
        modality: '',
        shift: 'Manhã',
        intensity: 'Moderado',
        priority: 'B',
        metabolic_objective: '',
        is_long_run: false,
        carb_loading_enabled: false,
        carb_loading_hours: null,
      })));
    }
    setDirty(false);
  }, [weekId, existingSessions]);

  const updateSession = (dayIdx: number, field: string, value: any) => {
    setDirty(true);
    setSessions(prev => prev.map(s => {
      if (s.day_of_week !== dayIdx) return s;
      const updated = { ...s, [field]: value };
      // Auto-enable carb loading when marking as long run
      if (field === 'is_long_run' && value === true && !s.carb_loading_enabled) {
        updated.carb_loading_enabled = true;
        updated.carb_loading_hours = 24;
      }
      // Reset carb loading when unmarking long run
      if (field === 'is_long_run' && value === false) {
        updated.carb_loading_enabled = false;
        updated.carb_loading_hours = null;
      }
      // Reset hours when disabling carb loading
      if (field === 'carb_loading_enabled' && value === false) {
        updated.carb_loading_hours = null;
      }
      if (field === 'carb_loading_enabled' && value === true && !updated.carb_loading_hours) {
        updated.carb_loading_hours = 24;
      }
      return updated;
    }));
  };

  const handleSave = () => {
    onSaveSessions(weekId, sessions.map(({ id, ...rest }) => rest));
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'Leve': return 'text-emerald-400 border-emerald-500/30';
      case 'Moderado': return 'text-amber-400 border-amber-500/30';
      case 'Intenso': return 'text-red-400 border-red-500/30';
      default: return 'text-muted-foreground border-border';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-primary" />
            Semana {weekNumber} — {phaseName}
            <Badge variant="outline" className="text-[9px] ml-1">S{weekInPhase} da fase</Badge>
          </CardTitle>
          <Button size="sm" onClick={handleSave} disabled={isSaving || !dirty} className="gap-1 text-xs h-7">
            <Save className="h-3 w-3" /> Salvar Sessões
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] w-[80px]">Dia</TableHead>
                <TableHead className="text-[10px]">Modalidade</TableHead>
                <TableHead className="text-[10px] w-[90px]">Turno</TableHead>
                <TableHead className="text-[10px] w-[100px]">Intensidade</TableHead>
                <TableHead className="text-[10px] w-[60px]">Prio</TableHead>
                <TableHead className="text-[10px]">Objetivo Metab.</TableHead>
                <TableHead className="text-[10px] w-[70px] text-center">Longão</TableHead>
                <TableHead className="text-[10px] w-[130px] text-center">Carb-Loading</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.day_of_week}>
                  <TableCell className="py-1.5 text-xs font-medium">{DAYS[session.day_of_week]}</TableCell>
                  <TableCell className="py-1.5">
                    <Input
                      value={session.modality}
                      onChange={e => updateSession(session.day_of_week, 'modality', e.target.value)}
                      placeholder="ex: Corrida, Natação, Descanso"
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Select value={session.shift} onValueChange={v => updateSession(session.day_of_week, 'shift', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHIFTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Select value={session.intensity} onValueChange={v => updateSession(session.day_of_week, 'intensity', v)}>
                      <SelectTrigger className={`h-7 text-xs border ${getIntensityColor(session.intensity)}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTENSITIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Select value={session.priority} onValueChange={v => updateSession(session.day_of_week, 'priority', v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input
                      value={session.metabolic_objective}
                      onChange={e => updateSession(session.day_of_week, 'metabolic_objective', e.target.value)}
                      placeholder="opcional"
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell className="py-1.5 text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex justify-center">
                            <Switch
                              checked={session.is_long_run || false}
                              onCheckedChange={v => updateSession(session.day_of_week, 'is_long_run', v)}
                              className="scale-75"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">Marcar como treino longo (longão)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="py-1.5">
                    {session.is_long_run ? (
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={session.carb_loading_enabled || false}
                          onCheckedChange={v => updateSession(session.day_of_week, 'carb_loading_enabled', v)}
                          className="scale-75"
                        />
                        {session.carb_loading_enabled && (
                          <Select
                            value={String(session.carb_loading_hours || 24)}
                            onValueChange={v => updateSession(session.day_of_week, 'carb_loading_hours', parseInt(v))}
                          >
                            <SelectTrigger className="h-6 text-[10px] w-[65px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="24">24h</SelectItem>
                              <SelectItem value="48">48h</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {session.carb_loading_enabled && (
                          <Zap className="h-3 w-3 text-amber-400 shrink-0" />
                        )}
                      </div>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
