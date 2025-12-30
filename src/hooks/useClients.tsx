import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { addMonths, format, parseISO, differenceInDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  service_type: 'nutrition' | 'training' | 'both';
  plan_type: 'consultoria' | 'premium';
  checkin_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | null;
  has_checkin: boolean;
  start_date: string;
  end_date: string;
  monthly_value: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  client_id: string;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
}

export function useClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
  });
}

export function usePayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['payments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          clients (name)
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data.map(p => ({
        ...p,
        client_name: p.clients?.name,
      })) as (Payment & { client_name: string })[];
    },
    enabled: !!user,
  });
}

export function useAddClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data: client, error } = await supabase
        .from('clients')
        .insert({
          ...clientData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Generate payments for this client
      const startDate = parseISO(client.start_date);
      const endDate = parseISO(client.end_date);
      const payments = [];

      let currentDate = startDate;
      while (currentDate <= endDate) {
        payments.push({
          user_id: user.id,
          client_id: client.id,
          due_date: format(currentDate, 'yyyy-MM-dd'),
          amount: client.monthly_value,
          status: 'pending' as const,
        });
        currentDate = addMonths(currentDate, 1);
      }

      if (payments.length > 0) {
        const { error: paymentsError } = await supabase
          .from('payments')
          .insert(payments);

        if (paymentsError) throw paymentsError;
      }

      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, paid_at }: { id: string; status: 'pending' | 'paid' | 'overdue'; paid_at?: string | null }) => {
      const { data, error } = await supabase
        .from('payments')
        .update({ status, paid_at })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

// Helper functions for computed data
export function getExpiringClients(clients: Client[], days: number = 30): Client[] {
  const today = new Date();
  return clients
    .filter(client => {
      if (!client.is_active) return false;
      const endDate = parseISO(client.end_date);
      const daysUntilExpiry = differenceInDays(endDate, today);
      return daysUntilExpiry >= 0 && daysUntilExpiry <= days;
    })
    .sort((a, b) => parseISO(a.end_date).getTime() - parseISO(b.end_date).getTime());
}

export function getUpcomingPayments(payments: (Payment & { client_name: string })[], days: number = 30) {
  const today = new Date();
  return payments
    .filter(payment => {
      if (payment.status === 'paid') return false;
      const dueDate = parseISO(payment.due_date);
      const daysUntilDue = differenceInDays(dueDate, today);
      return daysUntilDue >= -30 && daysUntilDue <= days;
    })
    .map(payment => {
      const daysUntilDue = differenceInDays(parseISO(payment.due_date), today);
      return {
        ...payment,
        status: daysUntilDue < 0 ? 'overdue' as const : payment.status,
      };
    })
    .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime());
}

export function getMonthlyRevenue(payments: (Payment & { client_name: string })[], year: number, month: number) {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));

  const monthPayments = payments.filter(payment => {
    const dueDate = parseISO(payment.due_date);
    return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
  });

  const total = monthPayments.reduce((sum, p) => sum + p.amount, 0);

  return { total, payments: monthPayments };
}

export function getTotalMonthlyRecurring(clients: Client[]): number {
  return clients.filter(c => c.is_active).reduce((sum, c) => sum + c.monthly_value, 0);
}
