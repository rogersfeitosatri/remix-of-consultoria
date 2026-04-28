import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface NpCheckinResponse {
  id: string;
  client_id: string;
  user_id: string;
  link_id: string | null;
  race_id: string | null;
  phase: string | null;
  adherence_pct: number | null;
  gi_score: number | null;
  energy_score: number | null;
  sleep_score: number | null;
  weight_kg: number | null;
  weekly_mileage_km: number | null;
  long_run_completed: boolean | null;
  notes: string | null;
  symptoms: any;
  decision: 'advance' | 'maintain' | 'regress' | null;
  decision_note: string | null;
  decided_at: string | null;
  decided_by: string | null;
  submitted_at: string;
}

function randomToken(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function useNpCheckins(clientId?: string) {
  return useQuery({
    queryKey: ['np-checkins', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<NpCheckinResponse[]> => {
      const { data, error } = await (supabase as any)
        .from('np_periodization_checkins')
        .select('*')
        .eq('client_id', clientId!)
        .order('submitted_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as NpCheckinResponse[];
    },
  });
}

export function useGenerateNpCheckinLink(clientId?: string, userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ token: string; url: string }> => {
      if (!clientId || !userId) throw new Error('clientId e userId obrigatórios');
      const token = randomToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      const { error } = await (supabase as any)
        .from('np_periodization_checkin_links')
        .insert({
          user_id: userId,
          client_id: clientId,
          token,
          active: true,
          expires_at: expiresAt,
        });
      if (error) throw error;
      const url = `${window.location.origin}/np-checkin/${token}`;
      return { token, url };
    },
    onSuccess: ({ url }) => {
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success('Link gerado e copiado para área de transferência');
      qc.invalidateQueries({ queryKey: ['np-checkin-links', clientId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar link'),
  });
}

export function useDecideNpCheckin(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      checkin_id: string;
      decision: 'advance' | 'maintain' | 'regress';
      decision_note?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('np_periodization_checkins')
        .update({
          decision: input.decision,
          decision_note: input.decision_note || null,
          decided_at: new Date().toISOString(),
          decided_by: user?.id ?? null,
        })
        .eq('id', input.checkin_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Decisão registrada');
      qc.invalidateQueries({ queryKey: ['np-checkins', clientId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao registrar decisão'),
  });
}
