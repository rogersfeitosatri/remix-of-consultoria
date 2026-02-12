import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface FinancialDebt {
  id: string;
  user_id: string;
  name: string;
  total_amount: number;
  remaining_amount: number;
  area: 'pessoal' | 'empresa' | 'consultoria' | 'assessoria';
  has_due_date: boolean;
  due_date: string | null;
  priority: 'baixa' | 'media' | 'alta';
  status: 'ativa' | 'quitada';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useFinancialDebts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['financial_debts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_debts')
        .select('*')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FinancialDebt[];
    },
    enabled: !!user,
  });
}

export type AddDebtInput = Omit<FinancialDebt, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export function useAddDebt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddDebtInput) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('financial_debts')
        .insert({ ...input, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_debts'] });
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FinancialDebt> & { id: string }) => {
      const { data, error } = await supabase
        .from('financial_debts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_debts'] });
    },
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_debts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_debts'] });
    },
  });
}
