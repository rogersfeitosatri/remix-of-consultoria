import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { parseISO, differenceInDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export interface Expense {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  due_date: string;
  category: string;
  status: 'pending' | 'paid' | 'overdue';
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useExpenses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!user,
  });
}

export function useAddExpense() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: Omit<Expense, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          ...expense,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Expense> & { id: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

// Helper functions
export function getUpcomingExpenses(expenses: Expense[], days: number = 30) {
  const today = new Date();
  return expenses
    .filter(expense => {
      if (expense.status === 'paid') return false;
      const dueDate = parseISO(expense.due_date);
      const daysUntilDue = differenceInDays(dueDate, today);
      return daysUntilDue >= 0 && daysUntilDue <= days;
    })
    .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime());
}

export function getOverdueExpenses(expenses: Expense[]) {
  const today = new Date();
  return expenses
    .filter(expense => {
      if (expense.status === 'paid') return false;
      const dueDate = parseISO(expense.due_date);
      return dueDate < today;
    })
    .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime());
}

export function getMonthlyExpenses(expenses: Expense[], year: number, month: number) {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  const monthExpenses = expenses.filter(expense => {
    const dueDate = parseISO(expense.due_date);
    return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
  });

  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paid = monthExpenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);

  return { total, paid, expenses: monthExpenses };
}
