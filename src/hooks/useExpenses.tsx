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
  expense_type: 'single' | 'subscription';
  due_day: number | null;
  created_at: string;
  updated_at: string;
}

// Virtual expense for displaying subscriptions with calculated due dates
export interface VirtualExpense extends Expense {
  is_virtual?: boolean;
  original_id?: string;
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

export interface ExpensePayment {
  id: string;
  expense_id: string;
  period_year: number;
  period_month: number;
  paid_at: string;
}

export function useExpensePayments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['expense_payments', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('expense_payments')
        .select('*');
      if (error) throw error;
      return (data || []) as ExpensePayment[];
    },
    enabled: !!user,
  });
}

export function useToggleSubscriptionPaid() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expense_id, year, month, paid }: { expense_id: string; year: number; month: number; paid: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      if (paid) {
        const { error } = await (supabase as any)
          .from('expense_payments')
          .insert({ expense_id, user_id: user.id, period_year: year, period_month: month });
        if (error && !String(error.message).includes('duplicate')) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('expense_payments')
          .delete()
          .eq('expense_id', expense_id)
          .eq('period_year', year)
          .eq('period_month', month);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_payments'] });
    },
  });
}

export type AddExpenseInput = {
  description: string;
  amount: number;
  category: string;
  notes?: string | null;
  status: 'pending' | 'paid' | 'overdue';
  paid_at?: string | null;
  expense_type: 'single' | 'subscription';
  due_date?: string; // Required for 'single'
  due_day?: number | null; // Required for 'subscription'
};

export function useAddExpense() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: AddExpenseInput) => {
      if (!user) throw new Error('Not authenticated');

      // For subscriptions, we need to generate a due_date based on due_day
      let dueDate = expense.due_date;
      if (expense.expense_type === 'subscription' && expense.due_day) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        // Set to current month's due_day
        dueDate = new Date(year, month, expense.due_day).toISOString().split('T')[0];
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          notes: expense.notes || null,
          status: expense.status,
          paid_at: expense.paid_at || null,
          expense_type: expense.expense_type,
          due_date: dueDate!,
          due_day: expense.due_day || null,
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

// Generate virtual expenses for subscriptions within a date range
export function getExpensesForPeriod(
  expenses: Expense[],
  startDate: Date,
  endDate: Date,
  payments: ExpensePayment[] = []
): VirtualExpense[] {
  const result: VirtualExpense[] = [];
  const paymentMap = new Map<string, ExpensePayment>();
  for (const p of payments) {
    paymentMap.set(`${p.expense_id}-${p.period_year}-${p.period_month}`, p);
  }

  for (const expense of expenses) {
    if (expense.expense_type === 'single') {
      const dueDate = parseISO(expense.due_date);
      if (isWithinInterval(dueDate, { start: startDate, end: endDate })) {
        result.push({ ...expense, is_virtual: false });
      }
    } else if (expense.expense_type === 'subscription' && expense.due_day) {
      const startMonth = startOfMonth(startDate);
      const endMonth = endOfMonth(endDate);

      let currentMonth = startMonth;
      while (currentMonth <= endMonth) {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const lastDayOfMonth = endOfMonth(currentMonth).getDate();
        const actualDueDay = Math.min(expense.due_day, lastDayOfMonth);
        const virtualDueDate = new Date(year, month, actualDueDay);

        if (isWithinInterval(virtualDueDate, { start: startDate, end: endDate })) {
          const payment = paymentMap.get(`${expense.id}-${year}-${month}`);
          result.push({
            ...expense,
            id: `${expense.id}-${year}-${month}`,
            due_date: virtualDueDate.toISOString().split('T')[0],
            status: payment ? 'paid' : 'pending',
            paid_at: payment ? payment.paid_at : null,
            is_virtual: true,
            original_id: expense.id,
          });
        }

        currentMonth = new Date(year, month + 1, 1);
      }
    }
  }

  return result.sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime());
}

export function getUpcomingExpenses(expenses: Expense[], days: number = 30, payments: ExpensePayment[] = []) {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  return getExpensesForPeriod(expenses, today, endDate, payments)
    .filter(expense => expense.status !== 'paid');
}

export function getOverdueExpenses(expenses: Expense[]) {
  const today = new Date();
  return expenses
    .filter(expense => {
      if (expense.status === 'paid') return false;
      if (expense.expense_type === 'subscription') return false;
      const dueDate = parseISO(expense.due_date);
      return dueDate < today;
    })
    .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime());
}

export function getMonthlyExpenses(expenses: Expense[], year: number, month: number, payments: ExpensePayment[] = []) {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  const monthExpenses = getExpensesForPeriod(expenses, monthStart, monthEnd, payments);

  const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const paid = monthExpenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);

  return { total, paid, expenses: monthExpenses };
}
