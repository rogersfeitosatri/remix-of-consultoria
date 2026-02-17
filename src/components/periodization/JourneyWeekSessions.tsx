import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dumbbell, Save, Plus, Trash2 } from 'lucide-react';

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
      // Init empty sessions for each day
      setSessions(DAYS.map((_, i) => ({
        journey_week_id: weekId,
        day_of_week: i,
        modality: '',
        shift: 'Manhã',
        intensity: 'Moderado',
        priority: 'B',
        metabolic_objective: '',
      })));
    }
    setDirty(false);
  }, [weekId, existingSessions]);

  const updateSession = (dayIdx: number, field: string, value: string) => {
    setDirty(true);
    setSessions(prev => prev.map(s =>
      s.day_of_week === dayIdx ? { ...s, [field]: value } : s
    ));
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'A': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'B': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'C': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-muted text-muted-foreground';
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
