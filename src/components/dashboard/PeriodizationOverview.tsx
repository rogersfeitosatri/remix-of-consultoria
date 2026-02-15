import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, ChevronRight, AlertTriangle, Target, Clock, Zap } from 'lucide-react';
import { differenceInDays, differenceInWeeks, parseISO, isAfter, isBefore, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PHASE_STYLES: Record<string, string> = {
  'Base': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Construção': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Pico': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Transição': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const getStyle = (name: string) =>
  Object.entries(PHASE_STYLES).find(([k]) => name.includes(k))?.[1] || 'bg-muted text-muted-foreground border-border';

interface AthleteRow {
  clientId: string;
  name: string;
  phase: string;
  raceName: string;
  raceDate: string;
  weeksToRace: number;
  checkpointDate: string;
  daysToCheckpoint: number;
  isPastCheckpoint: boolean;
  blockIndex: number;
  totalBlocks: number;
}

export function PeriodizationOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: periodizations = [] } = useQuery({
    queryKey: ['dashboard-periodization-overview', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_periodization')
        .select('client_id, timeline_blocks, race_date')
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

  const { data: profiles = [] } = useQuery({
    queryKey: ['dashboard-periodization-profiles', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_profiles')
        .select('client_id, target_race, target_deadline');
      return data || [];
    },
    enabled: !!user,
  });

  const rows = useMemo(() => {
    const today = new Date();
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const profileMap = new Map(profiles.map((p: any) => [p.client_id, p]));
    const result: AthleteRow[] = [];

    periodizations.forEach((p: any) => {
      const blocks = (p.timeline_blocks as any[]) || [];
      if (blocks.length === 0) return;

      const name = clientMap.get(p.client_id);
      if (!name) return;

      const profile = profileMap.get(p.client_id);
      const raceDate = p.race_date || profile?.target_deadline || '';
      const raceName = profile?.target_race || '';

      // Find current block
      const currentBlock = blocks.find((b: any) => {
        const s = parseISO(b.start_date);
        const e = parseISO(b.end_date);
        return !isBefore(today, s) && !isAfter(today, e);
      });

      // If no current block, use last block (cycle may have ended)
      const block = currentBlock || blocks[blocks.length - 1];
      const blockIdx = blocks.indexOf(block);

      const checkpoint = block.adjustment_checkpoint_date;
      const daysTo = checkpoint ? differenceInDays(parseISO(checkpoint), today) : 999;
      const weeksToRace = raceDate ? Math.max(differenceInWeeks(parseISO(raceDate), today), 0) : -1;

      result.push({
        clientId: p.client_id,
        name,
        phase: block.phase_name_snapshot || '—',
        raceName,
        raceDate,
        weeksToRace,
        checkpointDate: checkpoint || '',
        daysToCheckpoint: daysTo,
        isPastCheckpoint: daysTo < 0,
        blockIndex: blockIdx,
        totalBlocks: blocks.length,
      });
    });

    // Sort: past checkpoints first, then closest upcoming
    result.sort((a, b) => a.daysToCheckpoint - b.daysToCheckpoint);
    return result;
  }, [periodizations, clients, profiles]);

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Controle da Periodização
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">{rows.length} atleta{rows.length > 1 ? 's' : ''}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                <TableHead className="text-[11px] font-medium">Atleta</TableHead>
                <TableHead className="text-[11px] font-medium">Fase Atual</TableHead>
                <TableHead className="text-[11px] font-medium">Prova Alvo</TableHead>
                <TableHead className="text-[11px] font-medium text-center">Semanas p/ Prova</TableHead>
                <TableHead className="text-[11px] font-medium">Próx. Ajuste</TableHead>
                <TableHead className="text-[11px] font-medium text-center">Progresso</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow
                  key={r.clientId}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/periodization?client=${r.clientId}&tab=periodization`)}
                >
                  <TableCell className="text-sm font-medium py-2">{r.name}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${getStyle(r.phase)}`}>
                      {r.phase}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate max-w-[120px]">{r.raceName || '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    {r.weeksToRace >= 0 ? (
                      <span className={`text-xs font-semibold ${r.weeksToRace <= 4 ? 'text-destructive' : r.weeksToRace <= 8 ? 'text-amber-400' : 'text-foreground'}`}>
                        {r.weeksToRace} sem
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {r.checkpointDate ? (
                      r.isPastCheckpoint ? (
                        <Badge className="text-[10px] bg-destructive/20 text-destructive border-destructive/30 gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Pendente ({Math.abs(r.daysToCheckpoint)}d)
                        </Badge>
                      ) : r.daysToCheckpoint <= 7 ? (
                        <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {r.daysToCheckpoint === 0 ? 'Hoje' : `${r.daysToCheckpoint}d`}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(r.checkpointDate), 'dd/MM')} ({r.daysToCheckpoint}d)
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <span className="text-[10px] text-muted-foreground">
                      {r.blockIndex + 1}/{r.totalBlocks}
                    </span>
                  </TableCell>
                  <TableCell className="py-2">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
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
