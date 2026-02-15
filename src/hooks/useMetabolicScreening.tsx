import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { metabolicCategories } from '@/data/metabolicScreeningQuestions';

export function useMetabolicScreening(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: screenings = [], isLoading } = useQuery({
    queryKey: ['metabolic-screenings', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('metabolic_screening_responses')
        .select('*')
        .eq('client_id', clientId)
        .order('screening_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const saveScreening = useMutation({
    mutationFn: async (input: {
      client_id: string;
      screening_date: string;
      responses: Record<string, number>;
      notes?: string;
    }) => {
      // Calculate scores per category
      const scores: Record<string, number> = {};
      let total = 0;
      for (const cat of metabolicCategories) {
        let catScore = 0;
        for (const q of cat.questions) {
          catScore += input.responses[q.id] || 0;
        }
        scores[cat.key] = catScore;
        total += catScore;
      }

      const row = {
        client_id: input.client_id,
        user_id: user?.id,
        screening_date: input.screening_date,
        responses: input.responses,
        score_assimilacao: scores.assimilacao || 0,
        score_defesa_reparo: scores.defesa_reparo || 0,
        score_energia: scores.energia || 0,
        score_biotransformacao: scores.biotransformacao || 0,
        score_transporte: scores.transporte || 0,
        score_comunicacao: scores.comunicacao || 0,
        score_integridade_estrutural: scores.integridade_estrutural || 0,
        score_mental_emocional: scores.mental_emocional || 0,
        score_total: total,
        notes: input.notes || null,
      };

      const { data, error } = await supabase
        .from('metabolic_screening_responses')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metabolic-screenings', clientId] });
      toast({ title: 'Rastreamento salvo com sucesso' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  const deleteScreening = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('metabolic_screening_responses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metabolic-screenings', clientId] });
      toast({ title: 'Rastreamento excluído' });
    },
  });

  return { screenings, isLoading, saveScreening, deleteScreening };
}
