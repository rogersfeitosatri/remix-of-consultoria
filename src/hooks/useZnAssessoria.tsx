import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type ZnAthleteStatus = 'pending' | 'active' | 'inactive';
export type ZnPlanCode = 'monthly' | 'semiannual' | 'annual';
export type ZnSubscriptionStatus =
  | 'pending' | 'active' | 'overdue' | 'suspended' | 'cancelled' | 'expired';
export type ZnPaymentStatus =
  | 'pending' | 'confirmed' | 'received' | 'overdue' | 'refunded' | 'failed' | 'deleted';

export interface ZnAthlete {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf_cnpj: string | null;
  asaas_customer_id: string | null;
  status: ZnAthleteStatus;
  first_payment_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZnSubscription {
  id: string;
  user_id: string;
  athlete_id: string;
  plan_code: ZnPlanCode;
  status: ZnSubscriptionStatus;
  start_date: string | null;
  expires_at: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  last_payment_id: string | null;
  cancel_reason: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZnPayment {
  id: string;
  user_id: string;
  athlete_id: string | null;
  subscription_id: string | null;
  asaas_payment_id: string;
  amount: number;
  net_amount: number | null;
  status: ZnPaymentStatus;
  billing_type: string | null;
  due_date: string | null;
  paid_at: string | null;
  invoice_url: string | null;
  event_type: string | null;
  created_at: string;
}

export interface ZnPlan {
  id: string;
  user_id: string;
  code: ZnPlanCode;
  name: string;
  duration_months: number;
  price: number;
  description: string | null;
  is_active: boolean;
}

export interface ZnWebhookEvent {
  id: string;
  asaas_event_id: string | null;
  event_type: string;
  status: 'received' | 'processed' | 'failed' | 'skipped';
  attempts: number;
  error: string | null;
  payload: any;
  received_at: string;
  processed_at: string | null;
}

// ---------- Queries ----------
export function useZnAthletes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zn_athletes', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_athletes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ZnAthlete[];
    },
  });
}

export function useZnSubscriptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zn_subscriptions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ZnSubscription[];
    },
  });
}

export function useZnPayments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zn_payments', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_payments')
        .select('*')
        .order('paid_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ZnPayment[];
    },
  });
}

export function useZnPlans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zn_plans', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_plans')
        .select('*')
        .order('duration_months', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ZnPlan[];
    },
  });
}

export function useZnWebhookEvents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zn_webhook_events', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_webhook_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ZnWebhookEvent[];
    },
  });
}

// ---------- Mutations ----------
export function useUpdateZnPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ZnPlan> & { id: string }) => {
      const { id, ...patch } = input;
      const { error } = await (supabase as any)
        .from('zn_plans')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn_plans'] });
      toast.success('Plano atualizado');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar plano'),
  });
}

export function useCancelZnSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('zn_subscriptions')
        .update({ status: 'cancelled', canceled_at: new Date().toISOString(), cancel_reason: 'manual' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn_subscriptions'] });
      toast.success('Assinatura cancelada');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  });
}
