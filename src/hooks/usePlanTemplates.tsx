import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface PlanTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  plan_type: string;
  service_type: string;
  plan_duration: string;
  has_consultations: boolean;
  consultation_count: number;
  consultation_frequency: string | null;
  has_checkin: boolean;
  checkin_frequency: string | null;
  suggested_value: number;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PlanTemplateInput = Omit<PlanTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export function usePlanTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['plan-templates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Garante que templates default existam
      await supabase.rpc('seed_default_plan_templates' as any, { p_user_id: user.id });

      const { data, error } = await supabase
        .from('plan_templates' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PlanTemplate[];
    },
    enabled: !!user,
  });

  const upsert = useMutation({
    mutationFn: async (input: PlanTemplateInput & { id?: string }) => {
      if (!user) throw new Error('Não autenticado');
      const payload = { ...input, user_id: user.id };
      if (input.id) {
        const { error } = await supabase
          .from('plan_templates' as any)
          .update(payload)
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plan_templates' as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-templates'] });
      toast.success('Template salvo');
    },
    onError: (e: any) => toast.error('Erro: ' + (e.message || 'tente novamente')),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('plan_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-templates'] });
      toast.success('Template removido');
    },
    onError: (e: any) => toast.error('Erro: ' + (e.message || 'tente novamente')),
  });

  return { templates: list.data || [], isLoading: list.isLoading, upsert, remove };
}
