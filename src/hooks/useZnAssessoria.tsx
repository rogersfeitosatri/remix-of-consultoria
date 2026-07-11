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

export interface ZnOutboxRow {
  id: string;
  event_type: string;
  status: 'pending' | 'sent' | 'error' | string;
  attempts: number | null;
  last_error: string | null;
  http_status: number | null;
  duration_ms: number | null;
  next_attempt_at: string | null;
  sent_at: string | null;
  created_at: string;
  athlete_id: string | null;
  subscription_id: string | null;
  payload: any;
}

export function useZnOutbox() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zn_integration_outbox', user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_integration_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ZnOutboxRow[];
    },
  });
}

export function useRetryZnOutbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id?: string) => {
      if (id) {
        // Reset row to pending + now
        const { error } = await (supabase as any)
          .from('zn_integration_outbox')
          .update({ status: 'pending', next_attempt_at: new Date().toISOString(), last_error: null })
          .eq('id', id);
        if (error) throw error;
      }
      const { data, error } = await supabase.functions.invoke('zn-sync-retry');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn_integration_outbox'] });
      toast.success('Fila reprocessada');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao reprocessar'),
  });
}

// ---------- Cupons & Criadores (afiliados) ----------
export interface ZnPromoter {
  id: string;
  user_id: string;
  name: string;
  handle: string | null;
  contact: string | null;
  ref_code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ZnCoupon {
  id: string;
  user_id: string;
  code: string;
  description: string | null;
  promoter_id: string | null;
  discount_type: 'percent' | 'free_months';
  percent_off: number | null;
  free_months: number | null;
  applies_to: 'first' | 'all';
  max_uses: number | null;
  uses_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ZnRedemption {
  id: string;
  coupon_id: string | null;
  promoter_id: string | null;
  athlete_id: string | null;
  code: string | null;
  discount_type: string | null;
  amount_off: number | null;
  created_at: string;
}

export function useZnPromoters() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zn_promoters', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_promoters')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ZnPromoter[];
    },
  });
}

export function useZnCoupons() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zn_coupons', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ZnCoupon[];
    },
  });
}

export function useZnRedemptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['zn_coupon_redemptions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_coupon_redemptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ZnRedemption[];
    },
  });
}

export function useSaveZnPromoter() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<ZnPromoter> & { id?: string }) => {
      const { id, created_at, user_id, ...patch } = input as any;
      if (id) {
        const { error } = await (supabase as any).from('zn_promoters').update(patch).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('zn_promoters').insert({ ...patch, user_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn_promoters'] });
      toast.success('Criador salvo');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar criador'),
  });
}

export function useDeleteZnPromoter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('zn_promoters').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn_promoters'] });
      qc.invalidateQueries({ queryKey: ['zn_coupons'] });
      toast.success('Criador removido');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao remover'),
  });
}

export function useSaveZnCoupon() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<ZnCoupon> & { id?: string }) => {
      const { id, created_at, user_id, uses_count, ...patch } = input as any;
      if (id) {
        const { error } = await (supabase as any).from('zn_coupons').update(patch).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('zn_coupons').insert({ ...patch, user_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn_coupons'] });
      toast.success('Cupom salvo');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar cupom'),
  });
}

export function useDeleteZnCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('zn_coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn_coupons'] });
      toast.success('Cupom removido');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao remover'),
  });
}
