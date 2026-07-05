import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the nutrition-support WhatsApp number configured by this athlete's admin.
 * Uses a SECURITY DEFINER RPC so athletes can safely read only that one field.
 */
export function useNutritionSupportWhatsapp(clientId?: string | null) {
  return useQuery({
    queryKey: ['nutrition-support-whatsapp', clientId],
    enabled: !!clientId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await (supabase as any).rpc('get_nutrition_support_whatsapp', {
        _client_id: clientId,
      });
      if (error) {
        console.warn('[nutrition-support-whatsapp] rpc failed:', error.message);
        return null;
      }
      return (data as string | null) || null;
    },
  });
}
