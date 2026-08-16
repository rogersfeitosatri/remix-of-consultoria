/**
 * ETAPA 5A — Revisões nutricionais canônicas.
 *
 * Fonte ÚNICA da área "Ajustes". Nada aqui é calculado na tela:
 * as revisões são entidades reais em `nutrition_reviews`, materializadas
 * pela função canônica `materialize_nutrition_reviews`.
 */
import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { logOperationalEvent } from '@/lib/operationalEvents';
import {
  reviewBucket,
  todayKey,
  type NutritionReview,
  type ReviewDecision,
} from '@/lib/nutritionReview';

const TABLE = 'nutrition_reviews' as never;

export interface ReviewWithClient extends NutritionReview {
  client: {
    id: string;
    name: string;
    phone: string | null;
    plan_type: string | null;
    is_frozen: boolean | null;
  } | null;
}

async function fetchReviews(userId: string): Promise<ReviewWithClient[]> {
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select('*, client:clients(id, name, phone, plan_type, is_frozen)')
    .eq('user_id', userId)
    .order('scheduled_for', { ascending: true });
  if (error) throw error;
  return (data || []) as ReviewWithClient[];
}

export function useNutritionReviews() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['nutrition-reviews', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: () => fetchReviews(user!.id),
  });

  // Materializa a cadência ao abrir a área (idempotente, não duplica).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { error } = await (supabase as any).rpc('materialize_nutrition_reviews', {
        p_user_id: user.id,
      });
      if (!cancelled && !error) qc.invalidateQueries({ queryKey: ['nutrition-reviews', user.id] });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, qc]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['nutrition-reviews'] });
    qc.invalidateQueries({ queryKey: ['operational-dashboard'] });
  };

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, unknown> }) => {
      const { error } = await (supabase as any).from(TABLE).update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  /** Conclui a revisão registrando SEMPRE a decisão clínica. */
  const complete = useMutation({
    mutationFn: async (args: {
      review: NutritionReview;
      decision: ReviewDecision;
      notes?: string | null;
      resultPlanVersionId?: string | null;
      overrideWithoutCheckin?: boolean;
    }) => {
      const { review, decision, notes, resultPlanVersionId, overrideWithoutCheckin } = args;
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({
          status: 'completed',
          decision,
          notes: notes ?? review.notes,
          result_plan_version_id: resultPlanVersionId ?? review.result_plan_version_id,
          override_without_checkin: overrideWithoutCheckin ?? review.override_without_checkin,
          missing_information: null,
          needs_review: false,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        })
        .eq('id', review.id);
      if (error) throw error;

      await logOperationalEvent({
        clientId: review.client_id,
        eventType: 'nutrition_review_completed',
        source: 'app',
        payload: { review_id: review.id, decision, scheduled_for: review.scheduled_for },
      });

      // Gera a próxima obrigação do ciclo imediatamente.
      await (supabase as any).rpc('materialize_nutrition_reviews', { p_user_id: user?.id });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Revisão concluída', description: 'A próxima revisão do ciclo já foi agendada.' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  /** Marca que falta informação — continua sendo pendência real. */
  const waitInformation = useMutation({
    mutationFn: async ({ review, missing }: { review: NutritionReview; missing: string }) => {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ status: 'waiting_information', missing_information: missing })
        .eq('id', review.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Marcada como aguardando informação' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  /** Revisão extra fora da cadência (não altera a cadência oficial). */
  const createExtra = useMutation({
    mutationFn: async ({ clientId, date, notes }: { clientId: string; date: string; notes?: string }) => {
      const { error } = await (supabase as any).from(TABLE).insert({
        user_id: user!.id,
        client_id: clientId,
        cycle_key: `extra:${date}`,
        scheduled_for: date,
        status: date <= todayKey() ? 'pending' : 'scheduled',
        source: 'manual_extra_review',
        notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Revisão extra criada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const reschedule = useMutation({
    mutationFn: async ({ review, date }: { review: NutritionReview; date: string }) => {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ scheduled_for: date, status: date <= todayKey() ? 'pending' : 'scheduled' })
        .eq('id', review.id);
      if (error) throw error;
      await logOperationalEvent({
        clientId: review.client_id,
        eventType: 'nutrition_review_rescheduled',
        source: 'app',
        payload: { review_id: review.id, from: review.scheduled_for, to: date },
      });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Revisão remarcada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const cancel = useMutation({
    mutationFn: async ({ review, reason }: { review: NutritionReview; reason: string }) => {
      const { error } = await (supabase as any)
        .from(TABLE)
        .update({ status: 'cancelled', cancel_reason: reason, reviewed_at: new Date().toISOString() })
        .eq('id', review.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Revisão cancelada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const all = query.data ?? [];
  const today = todayKey();

  const buckets = useMemo(() => {
    const out = { pending: [] as ReviewWithClient[], upcoming: [] as ReviewWithClient[], history: [] as ReviewWithClient[] };
    for (const r of all) {
      if (r.status === 'paused') continue;
      out[reviewBucket(r, today)].push(r);
    }
    out.history.sort((a, b) => (a.scheduled_for < b.scheduled_for ? 1 : -1));
    return out;
  }, [all, today]);

  const paused = all.filter((r) => r.status === 'paused');
  const needsReview = all.filter((r) => r.needs_review && r.status !== 'completed' && r.status !== 'cancelled');

  return {
    reviews: all,
    ...buckets,
    paused,
    needsReview,
    isLoading: query.isLoading,
    refetch: query.refetch,
    patch,
    complete,
    waitInformation,
    createExtra,
    reschedule,
    cancel,
  };
}

/** Revisões de um atleta específico (aba do perfil). */
export function useClientNutritionReviews(clientId?: string) {
  return useQuery({
    queryKey: ['nutrition-reviews', 'client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('client_id', clientId)
        .order('scheduled_for', { ascending: false });
      if (error) throw error;
      return (data || []) as NutritionReview[];
    },
  });
}
