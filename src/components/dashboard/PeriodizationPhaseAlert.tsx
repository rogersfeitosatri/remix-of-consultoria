import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, ChevronRight, AlertTriangle } from 'lucide-react';
import { differenceInDays, parseISO, isAfter, isBefore, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

const PHASE_STYLES: Record<string, string> = {
  'Base': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Construção': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Pico': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Transição': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const getStyle = (name: string) =>
  Object.entries(PHASE_STYLES).find(([k]) => name.includes(k))?.[1] || 'bg-muted text-muted-foreground border-border';

interface AlertItem {
  clientId: string;
  name: string;
  phase: string;
  checkpointDate: string;
  daysToCheckpoint: number;
  isPast: boolean;
}

export function PeriodizationPhaseAlert() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: periodizations = [] } = useQuery({
    queryKey: ['dashboard-athlete-periodizations', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_periodization')
        .select('client_id, timeline_blocks')
        .eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['dashboard-periodization-clients', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!user,
  });

  const alerts = useMemo(() => {
    const today = new Date();
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const result: AlertItem[] = [];

    periodizations.forEach((p: any) => {
      const blocks = (p.timeline_blocks as any[]) || [];
      if (blocks.length === 0) return;

      const name = clientMap.get(p.client_id);
      if (!name) return;

      // Find current or next upcoming block
      const currentBlock = blocks.find((b: any) => {
        const s = parseISO(b.start_date);
        const e = parseISO(b.end_date);
        return !isBefore(today, s) && !isAfter(today, e);
      });

      if (!currentBlock) return;

      const checkpointDate = currentBlock.adjustment_checkpoint_date;
      if (!checkpointDate) return;

      const daysTo = differenceInDays(parseISO(checkpointDate), today);
      const isPast = daysTo < 0;

      // Show if checkpoint is within 10 days or already past
      if (daysTo <= 10) {
        result.push({
          clientId: p.client_id,
          name,
          phase: currentBlock.phase_name_snapshot || 'Sem fase',
          checkpointDate,
          daysToCheckpoint: daysTo,
          isPast,
        });
      }
    });

    // Sort: past first (most overdue), then closest upcoming
    result.sort((a, b) => a.daysToCheckpoint - b.daysToCheckpoint);

    return result;
  }, [periodizations, clients]);

  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Checkpoints de Periodização
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map(a => (
          <button
            key={a.clientId}
            onClick={() => navigate(`/periodization?client=${a.clientId}&tab=periodization`)}
            className="w-full flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0.5 ${getStyle(a.phase)}`}>
                {a.phase}
              </Badge>
              <span className="text-sm font-medium truncate">{a.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {a.isPast ? (
                <Badge className="text-[10px] bg-destructive/20 text-destructive border-destructive/30 gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Pendente ({Math.abs(a.daysToCheckpoint)}d atrás)
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {a.daysToCheckpoint === 0
                    ? 'Hoje'
                    : `em ${a.daysToCheckpoint}d — ${format(parseISO(a.checkpointDate), 'dd/MM')}`}
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
