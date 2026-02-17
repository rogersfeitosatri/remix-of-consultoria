import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ChevronRight, CalendarDays } from 'lucide-react';
import { parseISO, format, isAfter, isBefore } from 'date-fns';

const PHASE_BG: Record<string, string> = {
  'Base': 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  'Específica': 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  'Polimento': 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
  'Transição': 'bg-purple-500/20 border-purple-500/40 text-purple-400',
};

const getStyle = (name: string) =>
  Object.entries(PHASE_BG).find(([k]) => name.includes(k))?.[1] || 'bg-muted border-border text-muted-foreground';

interface Props {
  phases: any[];
  weeks: any[];
  onSelectWeek?: (weekId: string) => void;
  selectedWeekId?: string;
}

export function JourneyTimeline({ phases, weeks, onSelectWeek, selectedWeekId }: Props) {
  const today = new Date();

  if (phases.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Histórico da Jornada
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {phases.map((phase, idx) => {
              const phaseWeeks = weeks.filter(w => w.journey_phase_id === phase.id);
              const isActive = phase.start_date && phase.end_date
                ? !isBefore(today, parseISO(phase.start_date)) && !isAfter(today, parseISO(phase.end_date))
                : false;
              const isPast = phase.end_date ? isAfter(today, parseISO(phase.end_date)) : false;

              // Pick the first week of this phase for selection
              const firstWeek = phaseWeeks[0];
              const isSelected = firstWeek && selectedWeekId === firstWeek.id;

              return (
                <div
                  key={phase.id}
                  className={`relative pl-10 cursor-pointer transition-all ${isPast ? 'opacity-50' : ''}`}
                  onClick={() => firstWeek && onSelectWeek?.(firstWeek.id)}
                >
                  {/* Timeline dot */}
                  <div className={`absolute left-2.5 top-3 w-3.5 h-3.5 rounded-full border-2 ${
                    isActive
                      ? 'bg-primary border-primary ring-4 ring-primary/20'
                      : isPast
                      ? 'bg-muted-foreground/40 border-muted-foreground/40'
                      : 'bg-background border-border'
                  }`} />

                  <div className={`rounded-lg border p-3 ${getStyle(phase.phase_name)} ${
                    isActive ? 'ring-2 ring-primary' : ''
                  } ${isSelected ? 'ring-2 ring-primary/60 scale-[1.01]' : 'hover:opacity-90'}`}>
                    {/* Phase header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{phase.phase_name}</span>
                        {isActive && <Badge className="text-[8px] bg-primary/30 text-primary border-primary/40">ATUAL</Badge>}
                        {isPast && <Badge variant="outline" className="text-[8px] opacity-60">Concluída</Badge>}
                      </div>
                      <Badge variant="outline" className="text-[9px]">
                        {phase.duration_weeks} semana{phase.duration_weeks !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    {/* Prominent dates */}
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 opacity-70" />
                        <span className="text-xs font-semibold">
                          {phase.start_date ? format(parseISO(phase.start_date), 'dd/MM/yyyy') : '—'}
                        </span>
                      </div>
                      <ChevronRight className="h-3 w-3 opacity-50" />
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 opacity-70" />
                        <span className="text-xs font-semibold">
                          {phase.end_date ? format(parseISO(phase.end_date), 'dd/MM/yyyy') : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Objective snippet */}
                    {phase.objective && (
                      <p className="text-[10px] mt-1.5 opacity-70 line-clamp-1">{phase.objective}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
