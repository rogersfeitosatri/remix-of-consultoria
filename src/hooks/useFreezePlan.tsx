import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { differenceInCalendarDays, addDays, format } from 'date-fns';

export function useFreezePlan() {
  const queryClient = useQueryClient();

  const freezeMutation = useMutation({
    mutationFn: async ({ clientId, freezeDate, reason }: { clientId: string; freezeDate: string; reason: string }) => {
      const { error } = await supabase
        .from('clients')
        .update({
          is_frozen: true,
          frozen_at: freezeDate,
          freeze_reason: reason || null,
        } as any)
        .eq('id', clientId);
      if (error) throw error;
      // ETAPA 6C: evento client_frozen é gravado pelo trigger canônico do banco.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-panorama'] });
      toast.success('Plano congelado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao congelar plano: ' + (err.message || 'Tente novamente'));
    },
  });

  const unfreezeMutation = useMutation({
    mutationFn: async ({ clientId, frozenAt, currentEndDate }: { clientId: string; frozenAt: string; currentEndDate: string }) => {
      const frozenDays = differenceInCalendarDays(new Date(), new Date(frozenAt));
      const newEndDate = format(addDays(new Date(currentEndDate), frozenDays), 'yyyy-MM-dd');

      // Get current total_frozen_days
      const { data: client } = await supabase
        .from('clients')
        .select('total_frozen_days')
        .eq('id', clientId)
        .single();

      const prevFrozenDays = (client as any)?.total_frozen_days || 0;

      const { error } = await supabase
        .from('clients')
        .update({
          is_frozen: false,
          frozen_at: null,
          total_frozen_days: prevFrozenDays + frozenDays,
          end_date: newEndDate,
        } as any)
        .eq('id', clientId);
      if (error) throw error;

      // Shift pending consultation schedules by frozenDays
      const { data: pendingSchedules } = await supabase
        .from('consultation_schedules')
        .select('id, scheduled_date, send_link_date')
        .eq('client_id', clientId)
        .in('status', ['pending', 'sent', 'link_sent']);

      if (pendingSchedules && pendingSchedules.length > 0) {
        for (const schedule of pendingSchedules) {
          const newScheduledDate = format(addDays(new Date(schedule.scheduled_date), frozenDays), 'yyyy-MM-dd');
          const newSendLinkDate = format(addDays(new Date(schedule.send_link_date), frozenDays), 'yyyy-MM-dd');
          
          await supabase
            .from('consultation_schedules')
            .update({
              scheduled_date: newScheduledDate,
              send_link_date: newSendLinkDate,
            })
            .eq('id', schedule.id);
        }
      }

      // ETAPA 6C: evento client_unfrozen é gravado pelo trigger canônico do banco.

      return { frozenDays, newEndDate };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-panorama'] });
      toast.success(`Plano reativado! ${data.frozenDays} dias adicionados. Nova data de término: ${format(new Date(data.newEndDate + 'T12:00:00'), 'dd/MM/yyyy')}`);
    },
    onError: (err: any) => {
      toast.error('Erro ao descongelar plano: ' + (err.message || 'Tente novamente'));
    },
  });

  return { freezeMutation, unfreezeMutation };
}
