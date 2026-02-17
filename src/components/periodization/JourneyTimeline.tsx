import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ChevronRight } from 'lucide-react';
import { parseISO, format, isAfter, isBefore } from 'date-fns';

const PHASE_BG: Record<string, string> = {
  'Base': 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  'Específica': 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  'Competitiva': 'bg-orange-500/20 border-orange-500/40 text-orange-400',
  'Pico': 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
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
        <div className="space-y-3">
          {phases.map((phase) => {
            const phaseWeeks = weeks.filter(w => w.journey_phase_id === phase.id);
            const isActive = phase.start_date && phase.end_date
              ? !isBefore(today, parseISO(phase.start_date)) && !isAfter(today, parseISO(phase.end_date))
              : false;
            const isPast = phase.end_date ? isAfter(today, parseISO(phase.end_date)) : false;

            return (
              <div key={phase.id} className={`rounded-lg border p-3 ${getStyle(phase.phase_name)} ${isActive ? 'ring-2 ring-primary' : isPast ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{phase.phase_name}</span>
                    {isActive && <Badge className="text-[8px] bg-primary/30 text-primary border-primary/40">ATUAL</Badge>}
                  </div>
                  <span className="text-[9px] opacity-70">
                    {phase.start_date && phase.end_date
                      ? `${format(parseISO(phase.start_date), 'dd/MM')} → ${format(parseISO(phase.end_date), 'dd/MM')}`
                      : '—'}
                  </span>
                </div>

                {/* Weeks grid */}
                <div className="flex flex-wrap gap-1">
                  {phaseWeeks.map((week) => {
                    const isSelected = selectedWeekId === week.id;
                    return (
                      <button
                        key={week.id}
                        onClick={() => onSelectWeek?.(week.id)}
                        className={`px-2 py-1 rounded text-[9px] border transition-all ${
                          week.status === 'completed'
                            ? 'bg-primary/20 border-primary/30 text-primary'
                            : week.status === 'active'
                            ? 'bg-foreground/10 border-foreground/30 text-foreground ring-1 ring-foreground/20'
                            : 'bg-muted/30 border-border text-muted-foreground'
                        } ${isSelected ? 'ring-2 ring-primary scale-105' : 'hover:opacity-80'}`}
                      >
                        S{week.week_number}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
