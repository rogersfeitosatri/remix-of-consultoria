/**
 * ETAPA 2A — Serviço central do ciclo de vida do atleta.
 *
 * Toda transição de estado (encerrar, reativar, arquivar, desarquivar) passa
 * por aqui: atualiza `clients`, registra em `operational_events` e invalida os
 * caches das telas operacionais. Nenhuma tela deve escrever esses campos
 * diretamente.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logOperationalEvent, type OperationalEventType } from '@/lib/operationalEvents';

const OPERATIONAL_KEYS = [
  ['clients'],
  ['athlete-panorama'],
  ['athlete-radar'],
  ['consultation_schedules'],
  ['scheduled_checkins'],
];

export type LifecycleAction = 'end' | 'reactivate' | 'archive' | 'unarchive';

const ACTION_EVENT: Record<LifecycleAction, OperationalEventType> = {
  end: 'client_ended',
  reactivate: 'client_reactivated',
  archive: 'client_archived',
  unarchive: 'client_reactivated',
};

const ACTION_LABEL: Record<LifecycleAction, string> = {
  end: 'Acompanhamento encerrado',
  reactivate: 'Atleta reativado',
  archive: 'Atleta arquivado',
  unarchive: 'Atleta desarquivado',
};

function patchFor(action: LifecycleAction) {
  const now = new Date().toISOString();
  switch (action) {
    case 'end':
      return { ended_at: now, is_active: false, is_frozen: false, frozen_at: null };
    case 'reactivate':
      return { ended_at: null, archived_at: null, is_active: true };
    case 'archive':
      return { archived_at: now, is_active: false };
    case 'unarchive':
      return { archived_at: null };
  }
}

export function useAthleteLifecycle() {
  const qc = useQueryClient();

  const invalidate = () => {
    OPERATIONAL_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key }));
  };

  const transition = useMutation({
    mutationFn: async ({
      clientId,
      action,
      reason,
    }: {
      clientId: string;
      action: LifecycleAction;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from('clients')
        .update(patchFor(action) as never)
        .eq('id', clientId);
      if (error) throw error;

      await logOperationalEvent({
        clientId,
        entityType: 'client',
        entityId: clientId,
        eventType: ACTION_EVENT[action],
        metadata: { action, reason: reason ?? null },
      });

      return action;
    },
    onSuccess: (action) => {
      invalidate();
      toast.success(ACTION_LABEL[action]);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Tente novamente';
      toast.error('Não foi possível atualizar o estado do atleta: ' + message);
    },
  });

  return {
    transition,
    isPending: transition.isPending,
    endFollowUp: (clientId: string, reason?: string) =>
      transition.mutateAsync({ clientId, action: 'end', reason }),
    reactivate: (clientId: string, reason?: string) =>
      transition.mutateAsync({ clientId, action: 'reactivate', reason }),
    archive: (clientId: string, reason?: string) =>
      transition.mutateAsync({ clientId, action: 'archive', reason }),
    unarchive: (clientId: string, reason?: string) =>
      transition.mutateAsync({ clientId, action: 'unarchive', reason }),
  };
}
