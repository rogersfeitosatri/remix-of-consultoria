import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CalendarClock, AlertTriangle, ChevronRight, TrendingUp, Trophy } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useTemperaturaPacientes, Temperatura } from '@/hooks/useTemperaturaPacientes';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import {
  addMonths,
  differenceInCalendarDays,
  startOfWeek,
  endOfWeek,
  parseISO,
  format,
  isWithinInterval,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type DurationFilter = 'all' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

interface AthleteEntry {
  id: string;
  name: string;
  planDurationLabel: string;
  endingThisWeek: boolean;
  monthNumber: number;
  daysToEnd: number;
  targetRace?: string | null;
  targetDeadline?: string | null;
}

const TEMP_DOT: Record<Temperatura, string> = {
  frio:   'bg-red-500',
  morno:  'bg-yellow-400',
  quente: 'bg-green-500',
};

const DURATION_LABELS: Record<string, string> = {
  monthly: '1 mês',
  quarterly: '3 meses',
  semiannual: '6 meses',
  annual: '12 meses',
  custom: 'Personalizado',
  six_weeks: '6 semanas',
};

export function MonthlyProgressionPanel() {
  const { data: clients = [] } = useClients();
  const { data: temperaturas = [] } = useTemperaturaPacientes();
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [open, setOpen] = useState(false);

  const tempByClient = useMemo(() => {
    const map: Record<string, { temperatura: Temperatura; motivo: string }> = {};
    temperaturas.forEach(p => { map[p.client_id] = { temperatura: p.temperatura, motivo: p.motivo }; });
    return map;
  }, [temperaturas]);

  const { data: targetRaces = [] } = useQuery({
    queryKey: ['monthly-progression-target-races'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athlete_profiles')
        .select('client_id, target_race, target_deadline')
        .not('target_race', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const racesByClient = useMemo(() => {
    const map: Record<string, { target_race: string | null; target_deadline: string | null }> = {};
    for (const r of targetRaces) {
      map[r.client_id] = { target_race: r.target_race, target_deadline: r.target_deadline };
    }
    return map;
  }, [targetRaces]);

  const { newCycleGroups, endingThisWeek } = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const ending: AthleteEntry[] = [];
    const newCycles: Record<number, AthleteEntry[]> = {};

    for (const c of clients) {
      if (!c.is_active || c.is_frozen) continue;
      if (c.plan_type !== 'consultoria') continue;
      if (c.service_type === 'training') continue;
      if (!c.start_date || !c.end_date) continue;
      if (durationFilter !== 'all' && c.plan_duration !== durationFilter) continue;

      const start = parseISO(c.start_date);
      const end = parseISO(c.end_date);
      const daysToEnd = differenceInCalendarDays(end, today);
      if (daysToEnd < 0) continue;

      const planLabel = DURATION_LABELS[c.plan_duration] || c.plan_duration;
      const race = racesByClient[c.id];

      if (isWithinInterval(end, { start: weekStart, end: weekEnd })) {
        ending.push({
          id: c.id, name: c.name, planDurationLabel: planLabel,
          endingThisWeek: true, monthNumber: 0, daysToEnd,
          targetRace: race?.target_race ?? null,
          targetDeadline: race?.target_deadline ?? null,
        });
        continue;
      }

      for (let m = 1; m <= 24; m++) {
        const anniversary = addMonths(start, m);
        if (anniversary > end) break;
        if (isWithinInterval(anniversary, { start: weekStart, end: weekEnd })) {
          const monthNum = m + 1;
          if (!newCycles[monthNum]) newCycles[monthNum] = [];
          newCycles[monthNum].push({
            id: c.id, name: c.name, planDurationLabel: planLabel,
            endingThisWeek: false, monthNumber: monthNum, daysToEnd,
            targetRace: race?.target_race ?? null,
            targetDeadline: race?.target_deadline ?? null,
          });
          break;
        }
      }
    }

    const groups = Object.keys(newCycles)
      .map(Number)
      .sort((a, b) => a - b)
      .map(month => ({ month, athletes: newCycles[month].sort((a, b) => a.name.localeCompare(b.name)) }));
    ending.sort((a, b) => a.daysToEnd - b.daysToEnd);

    return { newCycleGroups: groups, endingThisWeek: ending };
  }, [clients, durationFilter, racesByClient]);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "dd 'de' MMM", { locale: ptBR })} – ${format(weekEnd, "dd 'de' MMM", { locale: ptBR })}`;

  const totalCycles = newCycleGroups.reduce((acc, g) => acc + g.athletes.length, 0);
  const isEmpty = totalCycles === 0 && endingThisWeek.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left transition-transform hover:scale-[1.01]"
      >
        <Card className="border-border/50 hover:border-primary/40 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Evolução Mensal</h3>
              <span className="text-xs text-muted-foreground ml-auto capitalize">{weekLabel}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{totalCycles + endingThisWeek.length}</span>
              <span className="text-xs text-muted-foreground">atletas em transição nesta semana</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {totalCycles} iniciando novo ciclo · {endingThisWeek.length} encerrando plano
            </p>
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Evolução Mensal — Semana atual
            </DialogTitle>
            <DialogDescription className="capitalize">{weekLabel}</DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Select value={durationFilter} onValueChange={(v) => setDurationFilter(v as DurationFilter)}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as durações</SelectItem>
                <SelectItem value="quarterly">3 meses</SelectItem>
                <SelectItem value="semiannual">6 meses</SelectItem>
                <SelectItem value="annual">12 meses</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {isEmpty && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum atleta iniciando novo ciclo ou encerrando plano nesta semana.
              </div>
            )}

            {endingThisWeek.length > 0 && (
              <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h4 className="text-sm font-bold text-destructive uppercase tracking-wide">
                    Encerrando plano nesta semana
                  </h4>
                  <Badge variant="destructive" className="ml-auto">{endingThisWeek.length}</Badge>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {endingThisWeek.map(a => (
                    <AthleteRow key={a.id} athlete={a} highlight onNav={() => setOpen(false)} temp={tempByClient[a.id]} />
                  ))}
                </div>
              </div>
            )}

            {newCycleGroups.map(group => (
              <div key={group.month} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Iniciando {group.month}º mês</h4>
                  <Badge variant="secondary" className="ml-auto">{group.athletes.length}</Badge>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {group.athletes.map(a => (
                    <AthleteRow key={a.id} athlete={a} onNav={() => setOpen(false)} temp={tempByClient[a.id]} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AthleteRow({
  athlete,
  highlight,
  onNav,
  temp,
}: {
  athlete: AthleteEntry;
  highlight?: boolean;
  onNav?: () => void;
  temp?: { temperatura: Temperatura; motivo: string };
}) {
  return (
    <TooltipProvider>
      <Link
        to={`/clients/${athlete.id}?tab=checkins`}
        onClick={onNav}
        className={cn(
          'flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors hover:bg-accent',
          highlight && 'border-destructive/30 bg-background'
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {temp && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${TEMP_DOT[temp.temperatura]}`} />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{temp.motivo}</p>
                </TooltipContent>
              </Tooltip>
            )}
            <span className="font-medium truncate">{athlete.name}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Plano: {athlete.planDurationLabel}
            {athlete.endingThisWeek && ` · encerra em ${athlete.daysToEnd}d`}
          </div>
          {athlete.targetRace && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
              <Trophy className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium">{athlete.targetRace}</span>
              {athlete.targetDeadline && (
                <span className="text-muted-foreground">
                  · {format(parseISO(athlete.targetDeadline), "dd/MM/yyyy")}
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </TooltipProvider>
  );
}
