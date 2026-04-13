import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface InitialBalance {
  id: string;
  user_id: string;
  area: 'geral' | 'pessoal' | 'empresa';
  amount: number;
  reference_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useInitialBalances() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['financial_initial_balances', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_initial_balances')
        .select('*')
        .order('reference_date', { ascending: false });

      if (error) throw error;
      return data as InitialBalance[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertInitialBalance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { area: string; amount: number; notes?: string; monthly_cost_goal?: number }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if exists
      const { data: existing } = await supabase
        .from('financial_initial_balances')
        .select('id')
        .eq('area', input.area)
        .maybeSingle();

      if (existing) {
        const updateData: any = { amount: input.amount, notes: input.notes || null };
        if (input.monthly_cost_goal !== undefined) updateData.monthly_cost_goal = input.monthly_cost_goal;
        const { data, error } = await supabase
          .from('financial_initial_balances')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const insertData: any = { user_id: user.id, area: input.area, amount: input.amount, notes: input.notes || null };
        if (input.monthly_cost_goal !== undefined) insertData.monthly_cost_goal = input.monthly_cost_goal;
        const { data, error } = await supabase
          .from('financial_initial_balances')
          .insert(insertData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_initial_balances'] });
    },
  });
}
