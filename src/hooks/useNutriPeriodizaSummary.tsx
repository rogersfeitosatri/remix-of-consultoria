import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EvolutionSummary {
  id: string;
  created_at: string;
  summary_markdown: string;
  phase: string | null;
  weeks_to_race: number | null;
  logs_analyzed: number;
  model: string;
}

export function useEvolutionSummaries(clientId?: string) {
  return useQuery({
    queryKey: ['np-evolution-summaries', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<EvolutionSummary[]> => {
      const { data, error } = await (supabase as any)
        .from('np_evolution_summaries')
        .select('id, created_at, summary_markdown, phase, weeks_to_race, logs_analyzed, model')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as EvolutionSummary[];
    },
  });
}

export function useGenerateEvolutionSummary(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('clientId obrigatório');
      const { data, error } = await supabase.functions.invoke('np-evolution-summary', {
        body: { client_id: clientId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).summary as EvolutionSummary;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['np-evolution-summaries', clientId] });
      toast.success('Resumo de evolução gerado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar resumo'),
  });
}
