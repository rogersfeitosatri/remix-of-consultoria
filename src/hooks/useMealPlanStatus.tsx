import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface MealPlanStatus {
  id: string;
  client_id: string;
  user_id: string;
  status: 'pending' | 'sent';
  task_id: string | null;
  created_at: string;
  sent_at: string | null;
  updated_at: string;
}

export interface MealPlanStatusWithClient extends MealPlanStatus {
  client_name: string;
  client_phone: string | null;
  anamnese_submitted_at: string | null;
}

export function useMealPlanStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['meal-plan-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('meal_plan_status')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MealPlanStatus[];
    },
    enabled: !!user?.id,
  });
}

export function usePendingMealPlans() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-meal-plans', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: mealPlanData, error: mealError } = await supabase
        .from('meal_plan_status')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (mealError) throw mealError;

      if (!mealPlanData || mealPlanData.length === 0) return [];

      // Fetch client names and service_type
      const clientIds = mealPlanData.map(mp => mp.client_id);
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id, name, phone, service_type')
        .in('id', clientIds)
        .in('service_type', ['nutrition', 'both']);

      if (clientError) throw clientError;

      // Fetch anamnese submitted_at for each client
      const { data: anamneseData } = await supabase
        .from('anamnese_responses')
        .select('client_id, submitted_at')
        .in('client_id', clientIds)
        .order('submitted_at', { ascending: false });

      // Map: client_id -> most recent submitted_at
      const anamneseMap = new Map<string, string>();
      for (const a of anamneseData || []) {
        if (a.client_id && !anamneseMap.has(a.client_id)) {
          anamneseMap.set(a.client_id, a.submitted_at);
        }
      }

      const clientMap = new Map(clients?.map(c => [c.id, c]) || []);

      return mealPlanData
        .map(mp => ({
          ...mp,
          client_name: clientMap.get(mp.client_id)?.name || 'Desconhecido',
          client_phone: clientMap.get(mp.client_id)?.phone || null,
          anamnese_submitted_at: anamneseMap.get(mp.client_id) || null,
        }))
        .filter(mp => clientMap.has(mp.client_id)) as MealPlanStatusWithClient[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateMealPlanStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      client_id: string; 
      task_id?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Check if already exists
      const { data: existing } = await supabase
        .from('meal_plan_status')
        .select('id')
        .eq('client_id', data.client_id)
        .single();

      if (existing) {
        // If exists but marked as sent, reset to pending
        const { error } = await supabase
          .from('meal_plan_status')
          .update({ status: 'pending', sent_at: null, task_id: data.task_id })
          .eq('client_id', data.client_id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('meal_plan_status')
        .insert({
          client_id: data.client_id,
          user_id: user.id,
          status: 'pending',
          task_id: data.task_id || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan-status'] });
      queryClient.invalidateQueries({ queryKey: ['pending-meal-plans'] });
    },
    onError: (error) => {
      console.error('Error creating meal plan status:', error);
    },
  });
}

export function useMarkMealPlanSent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      // Update meal plan status
      const { data: mealPlan, error: updateError } = await supabase
        .from('meal_plan_status')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('client_id', clientId)
        .select('task_id')
        .single();

      if (updateError) throw updateError;

      // If there's a linked task, archive it
      if (mealPlan?.task_id) {
        await supabase
          .from('tasks')
          .update({ is_archived: true })
          .eq('id', mealPlan.task_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan-status'] });
      queryClient.invalidateQueries({ queryKey: ['pending-meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Plano alimentar marcado como enviado!');
    },
    onError: (error) => {
      console.error('Error marking meal plan as sent:', error);
      toast.error('Erro ao marcar plano como enviado');
    },
  });
}

export function useDeleteMealPlanStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('meal_plan_status')
        .delete()
        .eq('client_id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plan-status'] });
      queryClient.invalidateQueries({ queryKey: ['pending-meal-plans'] });
    },
  });
}
