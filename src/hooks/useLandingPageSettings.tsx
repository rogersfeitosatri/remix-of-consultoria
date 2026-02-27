import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const DEFAULT_PLANS_LINKS = {
  plans_consultoria_whatsapp_url: 'https://wa.me/5599984817697?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20o%20plano%20consultoria.%20Meu%20objetivo%20%C3%A9%20...',
  plans_consultas_whatsapp_url: 'https://wa.me/5599984817697?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20o%20plano%20consultas.%20Meu%20objetivo%20%C3%A9%20...',
};

export const DEFAULT_PLANS_TEXTS = {
  // Hero
  hero_badge: 'Nutrição Esportiva Especializada',
  hero_title: 'Consultoria',
  hero_title_highlight: 'Nutricional',
  hero_subtitle: 'Emagrecimento e Performance',
  hero_description: 'Acompanhamento personalizado para quem busca emagrecer com saúde, melhorar a performance esportiva ou alcançar a melhor forma física.',
  hero_description_italic: 'Planos adaptados à sua rotina, seja você atleta amador, praticante de corrida, triathlon ou qualquer outra modalidade.',
  hero_cta_button: 'Conhecer os Planos',
  // Para quem é section
  para_quem_title: 'Qual plano é ideal pra você?',
  para_quem_subtitle: 'Entenda as diferenças e escolha o acompanhamento que faz sentido pro seu momento',
  // Consultoria card
  consultoria_card_title: 'Plano Consultoria',
  consultoria_card_subtitle: 'Pra quem é?',
  consultoria_item_1: 'Atleta que já conhece sua rotina alimentar e precisa de direcionamento estratégico',
  consultoria_item_2: 'Quem busca otimizar suplementação e estratégia de prova sem precisar de consultas frequentes',
  consultoria_item_3: 'Corredores que preferem acompanhamento assíncrono via formulários quinzenais e WhatsApp',
  consultoria_item_4: 'Atleta com rotina estável que precisa de ajustes pontuais conforme evolução',
  // Consultas card
  consultas_card_title: 'Plano Consultas',
  consultas_card_subtitle: 'Pra quem é?',
  consultas_badge: 'MAIS COMPLETO',
  consultas_item_1: 'Atleta que quer acompanhamento intensivo com consultas periódicas e ajustes ilimitados',
  consultas_item_2: 'Quem está em fase de preparação para prova importante e precisa de atenção máxima',
  consultas_item_3: 'Corredores que valorizam feedback semanal e resposta rápida às mudanças',
  consultas_item_4: 'Atleta com meta ambiciosa de performance ou emagrecimento acelerado',
  // Timeline section
  timeline_title: 'Linha do tempo do acompanhamento',
  timeline_subtitle: 'Veja como funciona a jornada do atleta em cada plano',
  timeline_consultoria_title: 'Plano Consultoria',
  timeline_consultas_title: 'Plano Consultas',
  timeline_cta_consultoria: 'Quero o Plano Consultoria',
  timeline_cta_consultas: 'Quero o Plano Consultas',
  // CTA Final
  cta_title: 'Ainda tem dúvidas?',
  cta_subtitle: 'Me chama no WhatsApp e eu te digo qual plano faz mais sentido pro seu momento.',
  cta_button: 'Falar no WhatsApp',
  cta_whatsapp_url: 'https://wa.me/5599984817697',
  // Footer
  footer_text: 'Rogers Feitosa - Nutricionista Esportivo',
};

export type PlansTexts = typeof DEFAULT_PLANS_TEXTS;
export type PlansLinks = typeof DEFAULT_PLANS_LINKS;
export type LandingPageSettings = PlansLinks & PlansTexts;

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

      const settings: Record<string, string> = {};
      data?.forEach((item: any) => {
        settings[item.setting_key] = item.setting_value;
      });

      return {
        ...DEFAULT_PLANS_LINKS,
        ...DEFAULT_PLANS_TEXTS,
        ...settings,
      } as LandingPageSettings;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
}

export function usePublicLandingPageSettings() {
  return useQuery({
    queryKey: ['public-landing-page-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_page_settings')
        .select('*');

      if (error) throw error;

      if (!data || data.length === 0) {
        return { ...DEFAULT_PLANS_LINKS, ...DEFAULT_PLANS_TEXTS } as LandingPageSettings;
      }

      const settings: Record<string, string> = {};
      data?.forEach((item: any) => {
        if (!settings[item.setting_key]) {
          settings[item.setting_key] = item.setting_value;
        }
      });

      return {
        ...DEFAULT_PLANS_LINKS,
        ...DEFAULT_PLANS_TEXTS,
        ...settings,
      } as LandingPageSettings;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveLandingPageSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      if (!user) throw new Error('Not authenticated');

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
