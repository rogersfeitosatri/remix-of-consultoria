import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ActiveRace {
  id: string;
  race_name: string | null;
  race_date: string | null;
  race_distance_km: number | null;
  race_type: string | null;
  target_time_minutes: number | null;
  notes: string | null;
  is_active: boolean;
}

export function useActiveRace(clientId?: string) {
  return useQuery({
    queryKey: ['np-active-race', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ActiveRace | null> => {
      const { data, error } = await (supabase as any)
        .from('np_athlete_races')
        .select('id, race_name, race_date, race_distance_km, race_type, target_time_minutes, notes, is_active')
        .eq('client_id', clientId!)
        .eq('is_active', true)
        .order('race_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ActiveRace | null;
    },
  });
}

export function useUpsertActiveRace(clientId?: string, userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ActiveRace>) => {
      if (!clientId || !userId) throw new Error('clientId/userId obrigatórios');
      const payload: any = {
        client_id: clientId,
        user_id: userId,
        race_name: input.race_name ?? null,
        race_date: input.race_date,
        race_distance_km: input.race_distance_km,
        race_type: input.race_type ?? 'road',
        target_time_minutes: input.target_time_minutes ?? null,
        notes: input.notes ?? null,
        is_active: true,
      };
      if (input.id) {
        const { error } = await (supabase as any).from('np_athlete_races').update(payload).eq('id', input.id);
        if (error) throw error;
        return input.id;
      }
      // Desativar provas anteriores
      await (supabase as any).from('np_athlete_races')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .eq('is_active', true);
      const { data, error } = await (supabase as any).from('np_athlete_races').insert(payload).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['np-active-race', clientId] });
      toast.success('Prova-alvo salva');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar prova'),
  });
}

export interface GutLogRow {
  id: string;
  client_id: string;
  checkin_date: string;
  current_cho_rate_g_h: number | null;
  cho_source: string | null;
  adherence_pct: number | null;
  gi_nausea: number;
  gi_bloating: number;
  gi_cramps: number;
  gi_diarrhea: number;
  gi_score_global: number | null;
  decision: 'advance' | 'maintain' | 'regress' | null;
  next_cho_rate_g_h: number | null;
  nutritionist_notes: string | null;
  athlete_notes: string | null;
  created_at: string;
}

export function useGutLogs(clientId?: string) {
  return useQuery({
    queryKey: ['np-gut-logs', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<GutLogRow[]> => {
      const { data, error } = await supabase
        .from('np_gut_training_logs')
        .select('*')
        .eq('client_id', clientId!)
        .order('checkin_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as GutLogRow[];
    },
  });
}

export function useCreateGutLog(clientId?: string, userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<GutLogRow>) => {
      if (!clientId || !userId) throw new Error('clientId/userId obrigatórios');
      const { error } = await supabase.from('np_gut_training_logs').insert({
        client_id: clientId,
        user_id: userId,
        checkin_date: input.checkin_date || new Date().toISOString().slice(0, 10),
        current_cho_rate_g_h: input.current_cho_rate_g_h ?? null,
        cho_source: input.cho_source ?? null,
        adherence_pct: input.adherence_pct ?? null,
        gi_nausea: input.gi_nausea ?? 0,
        gi_bloating: input.gi_bloating ?? 0,
        gi_cramps: input.gi_cramps ?? 0,
        gi_diarrhea: input.gi_diarrhea ?? 0,
        decision: input.decision ?? null,
        next_cho_rate_g_h: input.next_cho_rate_g_h ?? null,
        nutritionist_notes: input.nutritionist_notes ?? null,
        athlete_notes: input.athlete_notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['np-gut-logs', clientId] });
      qc.invalidateQueries({ queryKey: ['np-phase-protocol', clientId] });
      toast.success('Registro de gut training salvo');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar registro'),
  });
}

export interface PhaseProtocol {
  id: string;
  client_id: string;
  phase_override: string | null;
  override_reason: string | null;
  carboloading_checklist: Record<string, boolean>;
}

export function usePhaseProtocol(clientId?: string) {
  return useQuery({
    queryKey: ['np-phase-protocol', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<PhaseProtocol | null> => {
      const { data, error } = await supabase
        .from('np_phase_protocols')
        .select('id, client_id, phase_override, override_reason, carboloading_checklist')
        .eq('client_id', clientId!)
        .maybeSingle();
      if (error) throw error;
      return data as PhaseProtocol | null;
    },
  });
}

export function useUpsertPhaseProtocol(clientId?: string, userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PhaseProtocol>) => {
      if (!clientId || !userId) throw new Error('clientId/userId obrigatórios');
      const { error } = await supabase
        .from('np_phase_protocols')
        .upsert({
          client_id: clientId,
          user_id: userId,
          phase_override: input.phase_override ?? null,
          override_reason: input.override_reason ?? null,
          carboloading_checklist: input.carboloading_checklist ?? {},
        }, { onConflict: 'client_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['np-phase-protocol', clientId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar protocolo'),
  });
}
