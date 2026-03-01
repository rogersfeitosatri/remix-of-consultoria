import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const DEFAULT_PLANS_LINKS = {
  plans_consultoria_whatsapp_url: 'https://wa.me/5599984817697?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20o%20plano%20consultoria.%20Meu%20objetivo%20%C3%A9%20...',
  plans_consultas_whatsapp_url: 'https://wa.me/5599984817697?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20o%20plano%20consultas.%20Meu%20objetivo%20%C3%A9%20...',
};

export interface OfferItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export const DEFAULT_CONSULTAS_OFFERS: OfferItem[] = [
  { id: '1', icon: 'Calendar', title: 'Consulta a cada 6 semanas', description: 'Consultas periódicas para avaliar evolução, ajustar metas e refinar o plano.' },
  { id: '2', icon: 'Utensils', title: 'Plano alimentar e suplementar', description: 'Receba seu plano alimentar com quantidades, alimentos, porções personalizadas e substituições de preferência, além de estratégias de suplementação pré, intra e pós-treino.' },
  { id: '3', icon: 'ClipboardList', title: 'Avaliação semanal', description: 'Formulário semanal para coleta de sensações e acompanhamento contínuo da evolução.' },
  { id: '4', icon: 'RefreshCw', title: 'Ajustes ilimitados', description: 'Solicite ajustes no plano alimentar sempre que precisar, sem limite.' },
  { id: '5', icon: 'Dumbbell', title: 'Zona Nutri', description: 'Acesso ao sistema de estratégia suplementar para elaborar a nutrição do treino longo.' },
  { id: '6', icon: 'MessageCircle', title: 'Suporte diário no WhatsApp', description: 'Tire dúvidas diretamente com o Nutri todos os dias pelo WhatsApp.' },
];

export const DEFAULT_CONSULTORIA_OFFERS: OfferItem[] = [
  { id: '1', icon: 'FileText', title: 'Formulário inicial', description: 'Preencha o formulário de anamnese para o Nutri conhecer sua rotina e objetivos.' },
  { id: '2', icon: 'Utensils', title: 'Plano alimentar e suplementar', description: 'Receba seu plano alimentar personalizado para a fase atual do ciclo de treino com estratégias de suplementação.' },
  { id: '3', icon: 'RefreshCw', title: 'Avaliação quinzenal', description: 'Avaliação quinzenal via formulário para coleta de sensações e ajustes no plano se necessário.' },
  { id: '4', icon: 'Activity', title: '🎁 Bônus: Zona Nutri', description: 'Acesso ao sistema de ajuste estratégico de géis e suplementação nos treinos de corrida — incluso como bônus exclusivo.' },
  { id: '5', icon: 'MessageCircle', title: 'Suporte no WhatsApp', description: 'Tire dúvidas diretamente com o Nutri pelo WhatsApp.' },
];

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
export type LandingPageSettings = PlansLinks & PlansTexts & {
  consultas_offers?: OfferItem[];
  consultoria_offers?: OfferItem[];
};

function parseSettings(data: any[]): LandingPageSettings {
  const settings: Record<string, any> = {};
  data?.forEach((item: any) => {
    if (item.setting_key === 'consultas_offers' || item.setting_key === 'consultoria_offers') {
      try { settings[item.setting_key] = JSON.parse(item.setting_value); } catch { /* ignore */ }
    } else {
      settings[item.setting_key] = item.setting_value;
    }
  });

  return {
    ...DEFAULT_PLANS_LINKS,
    ...DEFAULT_PLANS_TEXTS,
    consultas_offers: DEFAULT_CONSULTAS_OFFERS,
    consultoria_offers: DEFAULT_CONSULTORIA_OFFERS,
    ...settings,
  } as LandingPageSettings;
}

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
      return parseSettings(data || []);
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
        return {
          ...DEFAULT_PLANS_LINKS,
          ...DEFAULT_PLANS_TEXTS,
          consultas_offers: DEFAULT_CONSULTAS_OFFERS,
          consultoria_offers: DEFAULT_CONSULTORIA_OFFERS,
        } as LandingPageSettings;
      }

      // Deduplicate by key (first occurrence wins)
      const seen = new Set<string>();
      const deduped = data.filter((item: any) => {
        if (seen.has(item.setting_key)) return false;
        seen.add(item.setting_key);
        return true;
      });

      return parseSettings(deduped);
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveLandingPageSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Record<string, any>) => {
      if (!user) throw new Error('Not authenticated');

      for (const [key, value] of Object.entries(settings)) {
        const settingValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        const { error } = await supabase
          .from('landing_page_settings')
          .upsert(
            {
              user_id: user.id,
              setting_key: key,
              setting_value: settingValue,
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
