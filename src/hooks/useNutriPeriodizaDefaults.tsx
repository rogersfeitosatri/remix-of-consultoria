import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  type RacePhase,
  type DistanceCategory,
  getStaticProtocol,
  type PhaseProtocolDefaults,
} from '@/lib/nutriperiodiza';

export interface ProtocolDefaultRow {
  id?: string;
  user_id?: string;
  phase: RacePhase;
  distance_category: DistanceCategory;
  cho_daily_range: string | null;
  gut_training_description: string | null;
  pre_training_protocol: string | null;
  cho_intra_min_g_h: number | null;
  cho_intra_max_g_h: number | null;
  cho_intra_description: string | null;
  cho_intra_source: string | null;
  carboloading_indicated: boolean;
  carboloading_protocol: string | null;
  carboloading_duration_days: number | null;
  carboloading_min_gkg: number | null;
  carboloading_max_gkg: number | null;
  clinical_focus: string | null;
  alerts_contraindications: string | null;
}

export function useProtocolDefaults(userId?: string) {
  return useQuery({
    queryKey: ['np-protocol-defaults', userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProtocolDefaultRow[]> => {
      const { data, error } = await (supabase as any)
        .from('np_protocol_defaults')
        .select('*')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data || []) as ProtocolDefaultRow[];
    },
  });
}

export function useUpsertProtocolDefault(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProtocolDefaultRow) => {
      if (!userId) throw new Error('userId obrigatório');
      const payload: any = { ...input, user_id: userId };
      delete payload.id;
      const { error } = await (supabase as any)
        .from('np_protocol_defaults')
        .upsert(payload, { onConflict: 'user_id,phase,distance_category' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['np-protocol-defaults', userId] });
      toast.success('Protocolo salvo');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar protocolo'),
  });
}

/**
 * Merge: lê do DB; se faltar, usa fallback estático de getStaticProtocol.
 */
export function getMergedProtocol(
  dbRows: ProtocolDefaultRow[],
  phase: RacePhase,
  distance: DistanceCategory | null,
): PhaseProtocolDefaults {
  const fallback = getStaticProtocol(phase, distance);
  if (!distance) return fallback;
  const row = dbRows.find((r) => r.phase === phase && r.distance_category === distance);
  if (!row) return fallback;
  return {
    cho_daily_range: row.cho_daily_range || fallback.cho_daily_range,
    gut_training: row.gut_training_description || fallback.gut_training,
    pre_training: row.pre_training_protocol || fallback.pre_training,
    intra_training: row.cho_intra_description || fallback.intra_training,
    carboloading: row.carboloading_protocol || fallback.carboloading,
    carboloading_indicated: row.carboloading_indicated ?? fallback.carboloading_indicated,
  };
}
