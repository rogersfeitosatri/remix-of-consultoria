import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Archive } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const SERVICE_LABELS: Record<string, string> = {
  nutrition: 'Nutrição',
  training: 'Treino',
  both: 'Ambos',
};

const PLAN_LABELS: Record<string, string> = {
  consultoria: 'Consultoria',
  premium: 'Premium',
};

export function PlanHistorySection({ clientId }: { clientId: string }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['client-plan-history', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_plan_history')
        .select('*')
        .eq('client_id', clientId)
        .order('renewed_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>;
  }

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano anterior registrado.</p>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Archive className="h-5 w-5 text-muted-foreground" />
          Histórico de Planos ({history.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {history.map((h: any) => (
            <div key={h.id} className="p-3 rounded-lg bg-muted/30 border text-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2">
                  <Badge variant="outline">{PLAN_LABELS[h.plan_type] || h.plan_type}</Badge>
                  <Badge variant="outline">{SERVICE_LABELS[h.service_type] || h.service_type}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Renovado em {format(parseISO(h.renewed_at), 'dd/MM/yyyy')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                <span>Início: {format(parseISO(h.start_date), 'dd/MM/yyyy')}</span>
                <span>Término: {format(parseISO(h.end_date), 'dd/MM/yyyy')}</span>
                <span>Total: R$ {Number(h.monthly_value).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
