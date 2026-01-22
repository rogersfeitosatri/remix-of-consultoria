import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MessageTemplate {
  id: string;
  user_id: string;
  template_key: string;
  template_name: string;
  template_content: string;
  description: string | null;
  available_variables: string[] | null;
  created_at: string;
  updated_at: string;
}

// Default templates with their keys and default content
export const DEFAULT_TEMPLATES: Omit<MessageTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    template_key: 'booking_invite',
    template_name: 'Convite para Agendamento',
    template_content: 'Olá {nome}! 📅\n\nHora de agendar sua próxima consulta! Escolha seu melhor horário aqui:\n\n🔗 {booking_link}\n\n⏰ Este link é válido por 7 dias.\n\nQualquer dúvida, estou à disposição! 💪',
    description: 'Mensagem enviada para convidar o atleta a agendar uma consulta',
    available_variables: ['{nome}', '{booking_link}'],
  },
  {
    template_key: 'booking_confirmation',
    template_name: 'Confirmação de Agendamento',
    template_content: '✅ *Consulta Confirmada!*\n\nOlá {nome}!\n\nSua consulta está agendada para:\n📅 {data}\n⏰ {hora}\n\n💻 Link da reunião:\n{meet_link}\n\nAté lá! 🙂',
    description: 'Mensagem enviada após o atleta confirmar um agendamento',
    available_variables: ['{nome}', '{data}', '{hora}', '{meet_link}'],
  },
  {
    template_key: 'consultation_reminder',
    template_name: 'Lembrete de Consulta',
    template_content: '🔔 *Lembrete de Consulta*\n\nOlá {nome}!\n\nSua consulta está agendada para *amanhã*:\n📅 {data}\n⏰ {hora}\n\n💻 Link da reunião:\n{meet_link}\n\nPor favor, esteja pronto(a) no horário. Caso precise reagendar, entre em contato o mais breve possível.\n\nAté amanhã! 🙂',
    description: 'Mensagem enviada 24h antes da consulta',
    available_variables: ['{nome}', '{data}', '{hora}', '{meet_link}'],
  },
  {
    template_key: 'checkin_request',
    template_name: 'Solicitação de Check-in',
    template_content: 'Olá {nome}! 📊\n\nÉ hora do seu check-in semanal! Por favor, preencha o formulário abaixo para que eu possa acompanhar seu progresso:\n\n🔗 {checkin_link}\n\nSeu feedback é muito importante para ajustarmos seu plano! 💪',
    description: 'Mensagem enviada para solicitar o preenchimento do check-in',
    available_variables: ['{nome}', '{checkin_link}'],
  },
  {
    template_key: 'checkin_feedback',
    template_name: 'Feedback do Check-in',
    template_content: 'Olá {nome}! 📝\n\n{feedback}\n\nQualquer dúvida, estou à disposição!\n\nVamos juntos! 💪',
    description: 'Mensagem enviada com o feedback do nutricionista após análise do check-in',
    available_variables: ['{nome}', '{feedback}'],
  },
  {
    template_key: 'anamnese_request',
    template_name: 'Solicitação de Anamnese',
    template_content: 'Olá {nome}! 👋\n\nPara começarmos seu acompanhamento, preciso que você preencha sua anamnese completa:\n\n🔗 {anamnese_link}\n\nIsso me ajudará a conhecer melhor você e personalizar seu plano! 📋',
    description: 'Mensagem enviada para solicitar o preenchimento da anamnese',
    available_variables: ['{nome}', '{anamnese_link}'],
  },
  {
    template_key: 'welcome_athlete',
    template_name: 'Boas-vindas ao Atleta',
    template_content: 'Olá {nome}! 🎉\n\nSeja muito bem-vindo(a) à nossa assessoria!\n\nEstou muito feliz em te ter por aqui. Vamos trabalhar juntos para alcançar seus objetivos! 💪\n\nEm breve você receberá as orientações iniciais.\n\nQualquer dúvida, pode me chamar! 🙂',
    description: 'Mensagem de boas-vindas enviada após o cadastro do atleta',
    available_variables: ['{nome}'],
  },
  {
    template_key: 'payment_reminder',
    template_name: 'Lembrete de Pagamento',
    template_content: 'Olá {nome}! 💳\n\nEste é um lembrete amigável sobre seu pagamento:\n\n📅 Vencimento: {data_vencimento}\n💰 Valor: R$ {valor}\n\nCaso já tenha realizado o pagamento, por favor desconsidere esta mensagem.\n\nQualquer dúvida, estou à disposição! 🙂',
    description: 'Mensagem de lembrete de pagamento próximo ao vencimento',
    available_variables: ['{nome}', '{data_vencimento}', '{valor}'],
  },
];

export function useMessageTemplates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['message-templates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', user?.id)
        .order('template_key');

      if (error) throw error;
      return data as MessageTemplate[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSaveMessageTemplate() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Partial<MessageTemplate> & { template_key: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('message_templates')
        .upsert(
          {
            template_key: template.template_key,
            template_name: template.template_name || '',
            template_content: template.template_content || '',
            description: template.description || null,
            available_variables: template.available_variables || null,
            user_id: user.id,
          },
          { onConflict: 'user_id,template_key' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    },
  });
}

export function useInitializeDefaultTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Check existing templates
      const { data: existing } = await supabase
        .from('message_templates')
        .select('template_key')
        .eq('user_id', user.id);

      const existingKeys = new Set(existing?.map(t => t.template_key) || []);

      // Insert only missing templates
      const templatesToInsert = DEFAULT_TEMPLATES
        .filter(t => !existingKeys.has(t.template_key))
        .map(t => ({
          template_key: t.template_key,
          template_name: t.template_name,
          template_content: t.template_content,
          description: t.description,
          available_variables: t.available_variables,
          user_id: user.id,
        }));

      if (templatesToInsert.length > 0) {
        const { error } = await supabase
          .from('message_templates')
          .insert(templatesToInsert);

        if (error) throw error;
      }

      return templatesToInsert.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    },
  });
}

// Helper to get template by key with fallback to default
export function getTemplateContent(
  templates: MessageTemplate[] | undefined,
  key: string
): string {
  const template = templates?.find(t => t.template_key === key);
  if (template) return template.template_content;

  const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.template_key === key);
  return defaultTemplate?.template_content || '';
}
