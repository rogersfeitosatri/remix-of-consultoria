import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface AdminSettings {
  id: string;
  user_id: string;
  enable_continuation_mode: boolean;
  created_at: string;
  updated_at: string;
}

export function useAdminSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['admin-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      
      // Return default settings if none exist
      if (!data) {
        return {
          id: '',
          user_id: user?.id || '',
          enable_continuation_mode: true, // Default to enabled during migration phase
          created_at: '',
          updated_at: '',
        } as AdminSettings;
      }
      
      return data as AdminSettings;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes - rarely changes
  });
}

export function useSaveAdminSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<AdminSettings>) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('admin_settings')
        .upsert({ 
          ...settings, 
          user_id: user.id 
        }, { 
          onConflict: 'user_id' 
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });
}
