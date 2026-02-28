import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UnresponsiveAthlete {
  clientId: string;
  clientName: string;
  missedCount: number;
  lastSentAt: string;
}

export function UnresponsiveAthletesAlert() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: unresponsiveAthletes = [], isLoading } = useQuery({
    queryKey: ['unresponsive-athletes-checkin', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get the last 2 sent/pending checkins per client that haven't been completed
      const { data: dispatches, error } = await supabase
        .from('checkin_dispatches')
        .select('client_id, sent_at, status')
        .eq('user_id', user.id)
        .in('status', ['sent', 'pending'])
        .order('sent_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!dispatches || dispatches.length === 0) return [];

      // Group by client
      const byClient: Record<string, { count: number; lastSentAt: string }> = {};
      for (const d of dispatches) {
        if (!byClient[d.client_id]) {
          byClient[d.client_id] = { count: 0, lastSentAt: d.sent_at };
        }
        byClient[d.client_id].count++;
      }

      // Filter to clients with 2+ unanswered
      const problematic = Object.entries(byClient)
        .filter(([_, v]) => v.count >= 2)
        .map(([clientId, v]) => ({ clientId, ...v }));

      if (problematic.length === 0) return [];

      // Get client names
      const clientIds = problematic.map(p => p.clientId);
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds)
        .eq('is_active', true);

      const clientMap = new Map((clients || []).map(c => [c.id, c.name]));

      return problematic
        .filter(p => clientMap.has(p.clientId))
        .map(p => ({
          clientId: p.clientId,
          clientName: clientMap.get(p.clientId) || '',
          missedCount: p.count,
          lastSentAt: p.lastSentAt,
        }))
        .sort((a, b) => b.missedCount - a.missedCount) as UnresponsiveAthlete[];
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  if (isLoading || unresponsiveAthletes.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Atletas sem resposta nos últimos check-ins
          <Badge variant="destructive">{unresponsiveAthletes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {unresponsiveAthletes.map((athlete) => (
            <div
              key={athlete.clientId}
              className="flex items-center justify-between p-3 rounded-lg bg-background/80 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/clients/${athlete.clientId}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{athlete.clientName}</p>
                <p className="text-xs text-muted-foreground">
                  {athlete.missedCount} check-ins sem resposta · último envio{' '}
                  {formatDistanceToNow(parseISO(athlete.lastSentAt), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  {athlete.missedCount}x sem resposta
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
