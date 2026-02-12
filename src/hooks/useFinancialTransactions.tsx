import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface FinancialTransaction {
  id: string;
  user_id: string;
  type: 'expense' | 'income';
  area: 'pessoal' | 'empresa' | 'consultoria' | 'assessoria';
  date: string;
  amount: number;
  category: string;
  description: string | null;
  payment_method: string | null;
  card_name: string | null;
  installments: number;
  current_installment: number;
  origin: string | null;
  receipt_method: string | null;
  is_recurring: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Normalize area for display: consultoria/assessoria → empresa
export function normalizeArea(area: string): 'pessoal' | 'empresa' {
  if (area === 'consultoria' || area === 'assessoria' || area === 'empresa') return 'empresa';
  return 'pessoal';
}

export function useFinancialTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['financial_transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      return data as FinancialTransaction[];
    },
    enabled: !!user,
  });
}

export type AddTransactionInput = Omit<FinancialTransaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export function useAddTransaction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddTransactionInput) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('financial_transactions')
        .insert({ ...input, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FinancialTransaction> & { id: string }) => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial_transactions'] });
    },
  });
}
