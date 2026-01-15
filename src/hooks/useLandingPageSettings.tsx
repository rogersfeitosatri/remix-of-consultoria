import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const DEFAULT_PLANS_LINKS = {
  plans_consultoria_whatsapp_url: 'https://wa.me/5599984817697?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20o%20plano%20consultoria.%20Meu%20objetivo%20%C3%A9%20...',
  plans_consultas_whatsapp_url: 'https://wa.me/5599984817697?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20o%20plano%20consultas.%20Meu%20objetivo%20%C3%A9%20...',
};

export function useLandingPageSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['landing-page-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_page_settings')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;

      // Convert array to object
      const settings: Record<string, string> = {};
      data?.forEach((item: any) => {
        settings[item.setting_key] = item.setting_value;
      });

      return {
        plans_consultoria_whatsapp_url: settings.plans_consultoria_whatsapp_url || DEFAULT_PLANS_LINKS.plans_consultoria_whatsapp_url,
        plans_consultas_whatsapp_url: settings.plans_consultas_whatsapp_url || DEFAULT_PLANS_LINKS.plans_consultas_whatsapp_url,
      };
    },
    enabled: !!user,
  });
}

// Hook para buscar settings publicamente (sem auth)
export function usePublicLandingPageSettings() {
  return useQuery({
    queryKey: ['public-landing-page-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_page_settings')
        .select('*');

      if (error) throw error;

      // Se não houver dados, retorna defaults
      if (!data || data.length === 0) {
        return DEFAULT_PLANS_LINKS;
      }

      // Convert array to object (pega o primeiro admin que configurou)
      const settings: Record<string, string> = {};
      data?.forEach((item: any) => {
        if (!settings[item.setting_key]) {
          settings[item.setting_key] = item.setting_value;
        }
      });

      return {
        plans_consultoria_whatsapp_url: settings.plans_consultoria_whatsapp_url || DEFAULT_PLANS_LINKS.plans_consultoria_whatsapp_url,
        plans_consultas_whatsapp_url: settings.plans_consultas_whatsapp_url || DEFAULT_PLANS_LINKS.plans_consultas_whatsapp_url,
      };
    },
  });
}

export function useSaveLandingPageSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      if (!user) throw new Error('Not authenticated');

      // Upsert each setting
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from('landing_page_settings')
          .upsert(
            {
              user_id: user.id,
              setting_key: key,
              setting_value: value,
            },
            {
              onConflict: 'user_id,setting_key',
            }
          );

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-page-settings'] });
      queryClient.invalidateQueries({ queryKey: ['public-landing-page-settings'] });
    },
  });
}
