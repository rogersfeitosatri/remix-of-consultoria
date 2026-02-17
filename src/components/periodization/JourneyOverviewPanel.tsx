import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Clock, Zap, AlertTriangle, Calendar } from 'lucide-react';
import { differenceInDays, differenceInWeeks, parseISO, format, isAfter } from 'date-fns';

const PHASE_COLORS: Record<string, string> = {
  'Base': 'bg-blue-500',
  'Específica': 'bg-amber-500',
  'Polimento': 'bg-emerald-500',
  'Transição': 'bg-purple-500',
};

const getColor = (name: string) =>
  Object.entries(PHASE_COLORS).find(([k]) => name.includes(k))?.[1] || 'bg-muted-foreground';

interface Props {
  raceName: string;
  raceDate: string;
  raceMeta: string;
  phases: any[];
  totalWeeks: number;
  clientEndDate?: string;
}

export function JourneyOverviewPanel({ raceName, raceDate, raceMeta, phases, totalWeeks, clientEndDate }: Props) {
  const today = new Date();
  const race = raceDate ? parseISO(raceDate) : null;
  const weeksToRace = race ? Math.max(differenceInWeeks(race, today), 0) : null;
  const daysToRace = race ? Math.max(differenceInDays(race, today), 0) : null;
  const elapsedWeeks = totalWeeks - (weeksToRace ?? 0);
  const progressPercent = totalWeeks > 0 ? Math.min((elapsedWeeks / totalWeeks) * 100, 100) : 0;

  // Current phase
  const currentPhase = phases.find(p => {
    if (!p.start_date || !p.end_date) return false;
    const s = parseISO(p.start_date);
    const e = parseISO(p.end_date);
    return today >= s && today <= e;
  });

  const currentWeekInPhase = currentPhase
    ? Math.max(differenceInWeeks(today, parseISO(currentPhase.start_date)) + 1, 1)
    : null;

  // Plan expiration alert
  const planEndDate = clientEndDate ? parseISO(clientEndDate) : null;
  const daysToExpire = planEndDate ? differenceInDays(planEndDate, today) : null;
  const planExpired = planEndDate ? isAfter(today, planEndDate) : false;

  return (
    <div className="space-y-3">
      {/* Plan Expiration Alert (seção 10) */}
      {daysToExpire !== null && daysToExpire <= 15 && (
        <Card className={`border ${planExpired ? 'border-destructive bg-destructive/5' : daysToExpire <= 3 ? 'border-destructive/50 bg-destructive/5' : daysToExpire <= 7 ? 'border-amber-500/50 bg-amber-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <CardContent className="pt-3 pb-3 flex items-center gap-2 text-xs">
            <AlertTriangle className={`h-4 w-4 shrink-0 ${planExpired ? 'text-destructive' : 'text-amber-400'}`} />
            {planExpired ? (
              <span className="text-destructive font-medium">⚠️ Plano vencido — renovar para continuar acompanhamento</span>
            ) : (
              <span className="text-amber-400 font-medium">⚠️ Plano vence em {daysToExpire} dia{daysToExpire !== 1 ? 's' : ''}</span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Header Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase">Prova Alvo</span>
            </div>
            <p className="text-sm font-bold truncate">{raceName || '—'}</p>
            <p className="text-[10px] text-muted-foreground">
              {raceDate ? format(parseISO(raceDate), 'dd/MM/yyyy') : 'Não definida'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] text-muted-foreground uppercase">Meta</span>
            </div>
            <p className="text-sm font-bold truncate">{raceMeta || 'Concluir'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] text-muted-foreground uppercase">Fase Atual</span>
            </div>
            <p className="text-sm font-bold">{currentPhase?.phase_name || 'Não iniciada'}</p>
            <p className="text-[10px] text-muted-foreground">
              {currentWeekInPhase ? `Semana ${currentWeekInPhase} de ${currentPhase?.duration_weeks}` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] text-muted-foreground uppercase">Tempo Restante</span>
            </div>
            <p className="text-xl font-bold text-primary">{weeksToRace ?? '—'}</p>
            <p className="text-[10px] text-muted-foreground">{daysToRace != null ? `${daysToRace} dias (${weeksToRace} sem)` : '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-muted-foreground uppercase">Semanas Restantes</span>
            </div>
            <p className="text-xl font-bold">{weeksToRace ?? '—'}</p>
            <p className="text-[10px] text-muted-foreground">de {totalWeeks} semanas</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar Visual */}
      {phases.length > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Progresso da Jornada</p>
            <div className="relative">
              {/* Phase segments */}
              <div className="flex h-6 rounded-full overflow-hidden border border-border">
                {phases.map((p, i) => {
                  const widthPercent = totalWeeks > 0 ? (p.duration_weeks / totalWeeks) * 100 : 20;
                  const isCurrent = p.id === currentPhase?.id;
                  return (
                    <div
                      key={p.id || i}
                      className={`relative flex items-center justify-center ${getColor(p.phase_name)} ${isCurrent ? 'opacity-100' : today > parseISO(p.end_date || p.start_date) ? 'opacity-40' : 'opacity-20'} transition-all`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      <span className="text-[8px] font-bold text-white truncate px-1">{p.phase_name}</span>
                      {isCurrent && (
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-transparent border-b-primary" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Overall progress indicator */}
              <div className="mt-3">
                <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                  <span>{Math.round(progressPercent)}% concluído</span>
                  <span>{weeksToRace} semanas restantes</span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-3 mt-3 justify-center flex-wrap">
              {phases.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`w-2.5 h-2.5 rounded-sm ${getColor(p.phase_name)}`} />
                  <span className="text-[9px] text-muted-foreground">{p.phase_name} ({p.duration_weeks} sem)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
