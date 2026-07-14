import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const PIPELINE_WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
export const WEEKDAY_LABEL: Record<string, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom',
};

export interface PlanJob {
  id: string; status: string; current_stage: string | null;
  completed_days: number; total_days: number; error: string | null;
  weekly_blueprint: any; created_at: string;
}
export interface PlanDay {
  id: string; job_id: string; weekday: string; status: string; attempts: number;
  validation_result: any; error: string | null;
}

const ACTIVE = ['queued', 'generating_blueprint', 'generating_days', 'validating'];

export function usePlanPipeline(clientId?: string) {
  const qc = useQueryClient();
  const driving = useRef(false);

  const jobQuery = useQuery({
    queryKey: ['plan-job', clientId],
    enabled: !!clientId,
    refetchInterval: (q) => {
      const job = (q.state.data as any)?.job as PlanJob | null;
      return job && ACTIVE.includes(job.status) ? 3500 : false;
    },
    queryFn: async () => {
      const { data: job } = await (supabase as any)
        .from('plan_generation_jobs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!job) return { job: null, days: [] as PlanDay[] };
      const { data: days } = await (supabase as any)
        .from('plan_generation_days')
        .select('*')
        .eq('job_id', job.id);
      return { job: job as PlanJob, days: (days || []) as PlanDay[] };
    },
  });

  const job = jobQuery.data?.job ?? null;
  const days = jobQuery.data?.days ?? [];

  const start = useMutation({
    mutationFn: async (adminGuidance?: any) => {
      const { data, error } = await supabase.functions.invoke('generate-weekly-blueprint', {
        body: { clientId, adminGuidance },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plan-job', clientId] }); },
    onError: (e: any) => toast.error(e.message || 'Erro ao iniciar a geração'),
  });

  const runDay = async (weekday: string) => {
    await supabase.functions.invoke('generate-plan-day', { body: { jobId: job!.id, weekday } });
  };

  const retryDay = async (weekday: string) => {
    if (!job) return;
    await (supabase as any).from('plan_generation_days').update({ status: 'pending', error: null }).eq('job_id', job.id).eq('weekday', weekday);
    qc.invalidateQueries({ queryKey: ['plan-job', clientId] });
  };

  // Driver: enquanto o job está gerando dias, dispara até 3 dias pendentes por vez;
  // quando todos têm cardápio, finaliza. Retomável após reload (lê do banco).
  useEffect(() => {
    if (!job || driving.current) return;
    const drive = async () => {
      driving.current = true;
      try {
        if (job.status === 'generating_days') {
          const pending = days.filter((d) => d.status === 'pending');
          if (pending.length) {
            const batch = pending.slice(0, 3);
            await Promise.all(batch.map((d) => runDay(d.weekday).catch(() => {})));
            qc.invalidateQueries({ queryKey: ['plan-job', clientId] });
            return;
          }
          const stuck = days.some((d) => ['pending', 'generating', 'validating'].includes(d.status));
          const allDone = days.length >= 7 && days.every((d) => ['completed', 'correction_required'].includes(d.status));
          if (allDone) {
            await supabase.functions.invoke('finalize-plan', { body: { jobId: job.id } });
            qc.invalidateQueries({ queryKey: ['plan-job', clientId] });
          } else if (!stuck) {
            // Há dias failed → não avança sozinho; usuário decide retry.
          }
        }
      } finally {
        driving.current = false;
      }
    };
    drive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status, JSON.stringify(days.map((d) => `${d.weekday}:${d.status}`))]);

  const completed = days.filter((d) => ['completed', 'correction_required'].includes(d.status)).length;
  const failed = days.filter((d) => d.status === 'failed');
  const isActive = !!job && ACTIVE.includes(job.status);

  return { job, days, isActive, completed, failed, start, retryDay, refetch: jobQuery.refetch, isLoading: jobQuery.isLoading };
}
