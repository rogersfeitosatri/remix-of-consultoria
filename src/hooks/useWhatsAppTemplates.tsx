import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface WhatsAppTemplate {
  id: string;
  user_id: string;
  template_key: string;
  template_name: string;
  title: string | null;
  body: string;
  is_active: boolean;
  default_timing: string | null;
  variables: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface AthleteWhatsAppSettings {
  id: string;
  client_id: string;
  disabled_all: boolean;
  disabled_template_keys: string[];
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessageLog {
  id: string;
  user_id: string;
  client_id: string | null;
  appointment_id: string | null;
  message_type: string;
  template_key: string | null;
  to_phone: string;
  payload_preview: string | null;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  clients?: {
    name: string;
    email: string | null;
  } | null;
  appointments?: {
    appointment_date: string;
    appointment_time: string;
  } | null;
}

export interface WhatsAppScheduledMessage {
  id: string;
  user_id: string;
  client_id: string;
  template_key: string;
  context_data: Record<string, unknown>;
  scheduled_for: string;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  sent_at: string | null;
  error_message: string | null;
  appointment_id: string | null;
  scheduled_checkin_id: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string;
    phone: string | null;
  } | null;
}

// Default templates for initial setup
export const DEFAULT_WHATSAPP_TEMPLATES: Omit<WhatsAppTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    template_key: 'reminder_15m',
    template_name: 'Lembrete 15 minutos antes',
    title: '⏰ Lembrete de Consulta',
    body: `Olá {nome}!

Sua consulta é em 15 minutos:
📅 Data: {data}
🕒 Horário: {hora}

🎥 Link da reunião:
{link}

Até já! 🙂`,
    is_active: true,
    default_timing: '15 min antes',
    variables: ['nome', 'data', 'hora', 'link'],
  },
  {
    template_key: 'booking_confirmed',
    template_name: 'Confirmação de Agendamento',
    title: '✅ Consulta Confirmada',
    body: `Olá {nome}!

Sua consulta foi agendada com sucesso:
📅 Data: {data}
🕒 Horário: {hora}
🎥 Link: {meet_link}

Até lá! 🙂`,
    is_active: true,
    default_timing: 'Imediato',
    variables: ['nome', 'data', 'hora', 'meet_link'],
  },
  {
    template_key: 'weekly_booking_link',
    template_name: 'Link Semanal de Agendamento',
    title: '📅 Agende sua Consulta',
    body: `Olá {nome}!

Está na hora de agendar sua próxima consulta! 🎯

Escolha o melhor dia e horário:
🔗 {booking_link}

⏰ Este link é válido por 7 dias.

Qualquer dúvida, estou à disposição! 💪`,
    is_active: true,
    default_timing: 'Segunda 10:00',
    variables: ['nome', 'booking_link'],
  },
  {
    template_key: 'checkin_reminder',
    template_name: 'Lembrete de Check-in',
    title: '📋 Check-in Semanal',
    body: `Olá {nome}! 📋

É hora do seu check-in semanal! 

Responda o formulário para acompanharmos sua evolução:
{link_checkin}

Seu código de acesso é: {codigo_acesso}

Qualquer dúvida, estou por aqui! 💪`,
    is_active: true,
    default_timing: 'Conforme agendado',
    variables: ['nome', 'link_checkin', 'codigo_acesso'],
  },
];

export function useWhatsAppTemplates() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['whatsapp-templates', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('template_key');
      
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
    enabled: !!user?.id,
  });
}

export function useInitializeWhatsAppTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      // Check if templates already exist
      const { data: existing } = await supabase
        .from('whatsapp_templates')
        .select('template_key')
        .eq('user_id', user.id);

      const existingKeys = new Set(existing?.map(t => t.template_key) || []);
      
      // Insert missing templates
      const toInsert = DEFAULT_WHATSAPP_TEMPLATES
        .filter(t => !existingKeys.has(t.template_key))
        .map(t => ({
          ...t,
          user_id: user.id,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .insert(toInsert);
        
        if (error) throw error;
      }

      return toInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      if (count > 0) {
        toast.success(`${count} template(s) criado(s) com sucesso`);
      }
    },
    onError: (error) => {
      console.error('Error initializing templates:', error);
      toast.error('Erro ao criar templates');
    },
  });
}

export function useSaveWhatsAppTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: { 
      id: string; 
      title?: string | null;
      body?: string; 
      is_active?: boolean; 
      template_name?: string; 
      default_timing?: string | null 
    }) => {
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({
          template_name: template.template_name,
          title: template.title,
          body: template.body,
          is_active: template.is_active,
          default_timing: template.default_timing,
        })
        .eq('id', template.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Template salvo com sucesso');
    },
    onError: (error) => {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template');
    },
  });
}

export function useWhatsAppMessageLogs(limit = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['whatsapp-logs', user?.id, limit],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_message_logs')
        .select(`
          *,
          clients(name, email),
          appointments(appointment_date, appointment_time)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as WhatsAppMessageLog[];
    },
    enabled: !!user?.id,
  });
}

export function useAthleteWhatsAppSettings(clientId?: string) {
  return useQuery({
    queryKey: ['athlete-whatsapp-settings', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const { data, error } = await supabase
        .from('athlete_whatsapp_settings')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      
      if (error) throw error;
      return data as AthleteWhatsAppSettings | null;
    },
    enabled: !!clientId,
  });
}

export function useSaveAthleteWhatsAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: { client_id: string; disabled_all: boolean; disabled_template_keys: string[] }) => {
      const { data: existing } = await supabase
        .from('athlete_whatsapp_settings')
        .select('id')
        .eq('client_id', settings.client_id)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('athlete_whatsapp_settings')
          .update({
            disabled_all: settings.disabled_all,
            disabled_template_keys: settings.disabled_template_keys,
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('athlete_whatsapp_settings')
          .insert(settings);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-whatsapp-settings'] });
      toast.success('Configurações salvas');
    },
    onError: (error) => {
      console.error('Error saving athlete settings:', error);
      toast.error('Erro ao salvar configurações');
    },
  });
}

export function useScheduledMessages() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['scheduled-messages', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // First, get scheduled messages from the new table
      const { data: scheduledMessages, error: scheduledError } = await supabase
        .from('whatsapp_scheduled_messages')
        .select(`
          *,
          clients(name, phone)
        `)
        .eq('user_id', user.id)
        .in('status', ['scheduled', 'sent', 'failed'])
        .order('scheduled_for', { ascending: true });

      if (scheduledError) {
        console.error('Error fetching scheduled messages:', scheduledError);
      }

      // Also get upcoming appointments that will generate reminders
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      const { data: upcomingAppointments, error: aptError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          google_meet_link,
          reminder_15m_sent_at,
          status,
          clients(id, name, phone, email)
        `)
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('appointment_date', todayStr)
        .order('appointment_date')
        .order('appointment_time');

      if (aptError) throw aptError;

      // Get templates for display
      const { data: templates } = await supabase
        .from('whatsapp_templates')
        .select('template_key, title, template_name')
        .eq('user_id', user.id);

      const templateMap = new Map(templates?.map(t => [t.template_key, t]) || []);

      // Transform appointments to scheduled message format
      const appointmentMessages = (upcomingAppointments || []).map(apt => {
        const client = apt.clients as unknown as { id: string; name: string; phone: string; email: string } | null;
        const aptDateTime = new Date(`${apt.appointment_date}T${apt.appointment_time}`);
        const reminderTime = new Date(aptDateTime.getTime() - 15 * 60 * 1000);
        const template = templateMap.get('reminder_15m');
        
        let status: 'scheduled' | 'sent' | 'failed' | 'pending_meet' = 'scheduled';
        if (apt.reminder_15m_sent_at) {
          status = 'sent';
        } else if (!apt.google_meet_link) {
          status = 'pending_meet';
        } else if (reminderTime < now) {
          status = 'scheduled'; // Will be processed by cron
        }

        return {
          id: `apt-${apt.id}`,
          type: 'reminder_15m',
          template_key: 'reminder_15m',
          template_title: template?.title || '⏰ Lembrete de Consulta',
          template_name: template?.template_name || 'Lembrete 15 min',
          scheduled_for: reminderTime.toISOString(),
          client_name: client?.name || 'Unknown',
          client_phone: client?.phone || 'N/A',
          client_email: client?.email || null,
          appointment_date: apt.appointment_date,
          appointment_time: apt.appointment_time,
          has_meet_link: !!apt.google_meet_link,
          status,
          context_data: {
            appointment_id: apt.id,
            meet_link: apt.google_meet_link,
          },
        };
      });

      // Transform scheduled messages from new table
      const scheduledFromTable = (scheduledMessages || []).map(msg => {
        const client = msg.clients as unknown as { name: string; phone: string | null } | null;
        const template = templateMap.get(msg.template_key);
        const contextData = msg.context_data as Record<string, unknown>;
        
        return {
          id: msg.id,
          type: msg.template_key,
          template_key: msg.template_key,
          template_title: template?.title || msg.template_key,
          template_name: template?.template_name || msg.template_key,
          scheduled_for: msg.scheduled_for,
          client_name: client?.name || 'Unknown',
          client_phone: client?.phone || 'N/A',
          client_email: null,
          appointment_date: contextData?.appointment_date as string || null,
          appointment_time: contextData?.appointment_time as string || null,
          has_meet_link: !!contextData?.meet_link,
          status: msg.status as 'scheduled' | 'sent' | 'failed' | 'pending_meet',
          context_data: contextData,
        };
      });

      // Combine and deduplicate (prefer new table records)
      const existingIds = new Set(scheduledFromTable.map(m => m.context_data?.appointment_id));
      const filteredAppointments = appointmentMessages.filter(
        m => !existingIds.has(m.context_data.appointment_id)
      );

      return [...scheduledFromTable, ...filteredAppointments].sort((a, b) => 
        new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
      );
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
  });
}

// Helper function to render a template with variables
// Supports both {var} and {{var}} syntax for compatibility
export function renderTemplate(
  template: { title?: string | null; body?: string | null },
  variables: Record<string, string | undefined>
): { title: string; body: string } {
  let title = template.title || '';
  let body = template.body || '';

  // Normalize variable names for compatibility
  const normalizedVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    normalizedVars[key] = value || '';
    // Also map link_checkin <-> checkin_link for compatibility
    if (key === 'checkin_link') {
      normalizedVars['link_checkin'] = value || '';
    }
    if (key === 'link_checkin') {
      normalizedVars['checkin_link'] = value || '';
    }
  }

  for (const [key, value] of Object.entries(normalizedVars)) {
    // Support both {var} and {{var}} syntax
    const singleBrace = new RegExp(`\\{${key}\\}`, 'g');
    const doubleBrace = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    title = title.replace(singleBrace, value).replace(doubleBrace, value);
    body = body.replace(singleBrace, value).replace(doubleBrace, value);
  }

  // Log warning for any remaining unsubstituted variables
  const remainingVars = [...(title.match(/\{+[^}]+\}+/g) || []), ...(body.match(/\{+[^}]+\}+/g) || [])];
  if (remainingVars.length > 0) {
    console.warn('Template has unsubstituted variables:', remainingVars);
  }

  return { title, body };
}

// Get template label for display
export function getTemplateLabel(key: string): string {
  switch (key) {
    case 'reminder_15m': return 'Lembrete 15 min antes';
    case 'booking_confirmed': return 'Confirmação de Agendamento';
    case 'weekly_booking_link': return 'Link Semanal de Agendamento';
    case 'checkin_reminder': return 'Lembrete de Check-in';
    default: return key;
  }
}