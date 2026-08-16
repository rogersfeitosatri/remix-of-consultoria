/**
 * ETAPA 3C — Override individual do formulário de check-in do atleta.
 * Exceção explícita e rastreável sobre o formulário definido pelo plano/produto.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logOperationalEvent } from '@/lib/operationalEvents';

export interface CheckinFormOverride {
  id: string;
  client_id: string;
  checkin_form_id: string;
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

export function useAthleteCheckinFormOverride(clientId: string | undefined) {
  return useQuery({
    queryKey: ['athlete_checkin_override', clientId],
    queryFn: async (): Promise<CheckinFormOverride | null> => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('athlete_checkin_form_overrides' as never)
        .select('*')
        .eq('client_id', clientId)
        .is('removed_at', null)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as CheckinFormOverride | null;
    },
    enabled: !!clientId,
  });
}

/** Resolução oficial: override > plano/produto > schedule. Nunca "primeiro ativo". */
export function useResolvedCheckinForm(clientId: string | undefined) {
  return useQuery({
    queryKey: ['resolved_checkin_form', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase.rpc('resolve_checkin_form_for_client' as never, {
        p_client_id: clientId,
      } as never);
      if (error) throw error;
      const rows = data as unknown as any;
      const row = Array.isArray(rows) ? rows[0] : rows;
      return (row ?? null) as unknown as {
        form_id: string | null;
        form_version_id: string | null;
        source: string | null;
        error_code: string | null;
      } | null;
    },
    enabled: !!clientId,
  });
}

export function useSetCheckinFormOverride() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      clientId,
      formId,
      reason,
    }: {
      clientId: string;
      formId: string;
      reason?: string;
    }) => {
      // remove override anterior (mantém histórico)
      await supabase
        .from('athlete_checkin_form_overrides' as never)
        .update({ removed_at: new Date().toISOString(), removed_by: user?.id ?? null } as never)
        .eq('client_id', clientId)
        .is('removed_at', null);

      const { error } = await supabase.from('athlete_checkin_form_overrides' as never).insert({
        user_id: user?.id,
        client_id: clientId,
        checkin_form_id: formId,
        reason: reason ?? null,
        created_by: user?.id,
      } as never);
      if (error) throw error;
      return { clientId, formId };
    },
    onSuccess: async ({ clientId, formId }) => {
      await logOperationalEvent({
        clientId,
        entityType: 'checkin_form',
        entityId: formId,
        eventType: 'athlete_checkin_form_override_set',
        metadata: { form_id: formId },
      });
      queryClient.invalidateQueries({ queryKey: ['athlete_checkin_override', clientId] });
      queryClient.invalidateQueries({ queryKey: ['resolved_checkin_form', clientId] });
    },
  });
}

export function useRemoveCheckinFormOverride() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('athlete_checkin_form_overrides' as never)
        .update({ removed_at: new Date().toISOString(), removed_by: user?.id ?? null } as never)
        .eq('client_id', clientId)
        .is('removed_at', null);
      if (error) throw error;
      return clientId;
    },
    onSuccess: async (clientId) => {
      await logOperationalEvent({
        clientId,
        entityType: 'checkin_form',
        eventType: 'athlete_checkin_form_override_removed',
      });
      queryClient.invalidateQueries({ queryKey: ['athlete_checkin_override', clientId] });
      queryClient.invalidateQueries({ queryKey: ['resolved_checkin_form', clientId] });
    },
  });
}
