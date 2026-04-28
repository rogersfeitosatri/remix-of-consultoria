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
  audience?: 'admin' | 'athlete';
  edited_content?: string | null;
  whatsapp_sent_at?: string | null;
}

export function useEvolutionSummaries(clientId?: string, audience: 'admin' | 'athlete' = 'admin') {
  return useQuery({
    queryKey: ['np-evolution-summaries', clientId, audience],
    enabled: !!clientId,
    queryFn: async (): Promise<EvolutionSummary[]> => {
      const { data, error } = await (supabase as any)
        .from('np_evolution_summaries')
        .select('id, created_at, summary_markdown, phase, weeks_to_race, logs_analyzed, model, audience, edited_content, whatsapp_sent_at')
        .eq('client_id', clientId!)
        .eq('audience', audience)
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
    mutationFn: async (audience: 'admin' | 'athlete' = 'admin') => {
      if (!clientId) throw new Error('clientId obrigatório');
      const { data, error } = await supabase.functions.invoke('np-evolution-summary', {
        body: { client_id: clientId, audience },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).summary as EvolutionSummary;
    },
    onSuccess: (_, audience) => {
      qc.invalidateQueries({ queryKey: ['np-evolution-summaries', clientId, audience || 'admin'] });
      toast.success('Resumo gerado com sucesso');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar resumo'),
  });
}

export function useUpdateAthleteSummary(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; edited_content: string }) => {
      const { error } = await (supabase as any)
        .from('np_evolution_summaries')
        .update({ edited_content: input.edited_content })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['np-evolution-summaries', clientId, 'athlete'] });
      toast.success('Resumo atualizado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });
}

export function useSendAthleteSummaryWhatsapp(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; content: string }) => {
      if (!clientId) throw new Error('clientId obrigatório');
      const { data, error } = await supabase.functions.invoke('send-race-prep-whatsapp', {
        body: {
          client_id: clientId,
          event_type: 'athlete_evolution_summary',
          summary_id: input.id,
          custom_message: input.content,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      // Mark sent
      await (supabase as any)
        .from('np_evolution_summaries')
        .update({ whatsapp_sent_at: new Date().toISOString() })
        .eq('id', input.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['np-evolution-summaries', clientId, 'athlete'] });
      toast.success('Resumo enviado via WhatsApp');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar WhatsApp'),
  });
}
