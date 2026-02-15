import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { differenceInWeeks, parseISO, isAfter, isBefore } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

const PHASE_STYLES: Record<string, string> = {
  'Base Metabólica': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Transição': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Performance': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Taper': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

interface BlockData {
  block_index: number;
  phase_name: string;
  date_start: string;
  date_end: string;
  notes_admin?: string;
}

export function PeriodizationPhaseAlert() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: periodizations = [] } = useQuery({
    queryKey: ['dashboard-periodization-phases', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('periodiza_suggestions')
        .select('client_id, blocks, periodization_start_date, plan_adjustment_type')
        .eq('is_active', true);
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

  const athletesInPhase = useMemo(() => {
    const today = new Date();
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const result: { clientId: string; name: string; phase: string; weeksLeft: number; blockNotes?: string }[] = [];

    periodizations.forEach((p: any) => {
      const blocks = (p.blocks as BlockData[]) || [];
      if (blocks.length === 0) return;

      const name = clientMap.get(p.client_id);
      if (!name) return;

      // Find current block
      const currentBlock = blocks.find(b => {
        const start = parseISO(b.date_start);
        const end = parseISO(b.date_end);
        return !isBefore(today, start) && !isAfter(today, end);
      });

      if (!currentBlock) return;

      const endDate = parseISO(currentBlock.date_end);
      const weeksLeft = Math.max(0, differenceInWeeks(endDate, today));

      result.push({
        clientId: p.client_id,
        name,
        phase: currentBlock.phase_name,
        weeksLeft,
        blockNotes: currentBlock.notes_admin,
      });
    });

    // Sort: Taper first, then by weeks left ascending
    const phaseOrder: Record<string, number> = { 'Taper': 0, 'Performance': 1, 'Transição': 2, 'Base Metabólica': 3 };
    result.sort((a, b) => (phaseOrder[a.phase] ?? 9) - (phaseOrder[b.phase] ?? 9) || a.weeksLeft - b.weeksLeft);

    return result;
  }, [periodizations, clients]);

  if (athletesInPhase.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Fases da Periodização — Ajustes Pendentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {athletesInPhase.map(a => (
          <button
            key={a.clientId}
            onClick={() => navigate(`/periodization?client=${a.clientId}`)}
            className="w-full flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0.5 ${PHASE_STYLES[a.phase] || ''}`}>
                {a.phase}
              </Badge>
              <span className="text-sm font-medium truncate">{a.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {a.weeksLeft === 0 ? 'Última semana' : `${a.weeksLeft} sem restantes`}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
