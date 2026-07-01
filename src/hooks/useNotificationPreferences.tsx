import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import {
  mergeNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notificationTypes';

export function useNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notification_preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await (supabase as any)
        .from('notification_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.preferences ?? null;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const preferences: NotificationPreferences = mergeNotificationPreferences(query.data);

  const setPreference = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      if (!user?.id) throw new Error('Não autenticado');
      const next = { ...preferences, [key]: value };
      const { error } = await (supabase as any)
        .from('notification_preferences')
        .upsert(
          { user_id: user.id, preferences: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_preferences'] });
    },
    onError: (e: any) => {
      toast.error('Erro ao salvar preferência: ' + (e?.message || ''));
    },
  });

  return {
    preferences,
    isLoading: query.isLoading,
    setPreference: (key: string, value: boolean) => setPreference.mutate({ key, value }),
    saving: setPreference.isPending,
  };
}
