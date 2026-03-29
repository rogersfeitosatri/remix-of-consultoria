import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface WhatsAppBroadcast {
  id: string;
  user_id: string;
  internal_title: string;
  body: string;
  media_url: string | null;
  media_type: string | null;
  send_type: string;
  scheduled_at: string | null;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface BroadcastRecipient {
  id: string;
  broadcast_id: string;
  client_id: string | null;
  contact_id: string | null;
  phone: string;
  recipient_name: string | null;
  status: string;
  provider_response: Record<string, unknown> | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface WhatsAppContact {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string;
  tags: string[];
  source: string | null;
  created_at: string;
}

// ---- Broadcasts ----

export function useBroadcasts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['whatsapp-broadcasts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('whatsapp_broadcasts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppBroadcast[];
    },
    enabled: !!user?.id,
  });
}

export function useBroadcastRecipients(broadcastId: string | null) {
  return useQuery({
    queryKey: ['broadcast-recipients', broadcastId],
    queryFn: async () => {
      if (!broadcastId) return [];
      const { data, error } = await supabase
        .from('whatsapp_broadcast_recipients')
        .select('*')
        .eq('broadcast_id', broadcastId)
        .order('created_at');
      if (error) throw error;
      return data as BroadcastRecipient[];
    },
    enabled: !!broadcastId,
  });
}

export function useCreateBroadcast() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      internal_title: string;
      body: string;
      media_url?: string | null;
      media_type?: string | null;
      send_type: 'immediate' | 'scheduled';
      scheduled_at?: string | null;
      is_recurring?: boolean;
      recurrence_type?: string;
      recurrence_days?: number[];
      recurrence_time?: string;
      recurrence_end_date?: string;
      recipients: Array<{
        client_id?: string | null;
        contact_id?: string | null;
        phone: string;
        recipient_name?: string | null;
      }>;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Create broadcast
      const { data: broadcast, error: bErr } = await supabase
        .from('whatsapp_broadcasts')
        .insert({
          user_id: user.id,
          internal_title: params.internal_title,
          body: params.body,
          media_url: params.media_url || null,
          media_type: params.media_type || null,
          send_type: params.send_type,
          scheduled_at: params.scheduled_at || null,
          status: params.send_type === 'immediate' ? 'sending' : 'scheduled',
          total_recipients: params.recipients.length,
        })
        .select()
        .single();

      if (bErr) throw bErr;

      // Insert recipients
      const recipientRows = params.recipients.map((r, i) => ({
        broadcast_id: broadcast.id,
        client_id: r.client_id || null,
        contact_id: r.contact_id || null,
        phone: r.phone,
        recipient_name: r.recipient_name || null,
        status: 'queued',
        idempotency_key: `${broadcast.id}-${i}`,
      }));

      const { error: rErr } = await supabase
        .from('whatsapp_broadcast_recipients')
        .insert(recipientRows);

      if (rErr) throw rErr;

      // If immediate, trigger sending
      if (params.send_type === 'immediate') {
        supabase.functions.invoke('send-broadcast', {
          body: { broadcastId: broadcast.id },
        }).catch(console.error);
      }

      return broadcast;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-broadcasts'] });
      toast.success('Mensagem criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating broadcast:', error);
      toast.error('Erro ao criar mensagem');
    },
  });
}

export function useCancelBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (broadcastId: string) => {
      const { error } = await supabase
        .from('whatsapp_broadcasts')
        .update({ status: 'cancelled' })
        .eq('id', broadcastId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-broadcasts'] });
      toast.success('Envio cancelado');
    },
  });
}

// ---- Contacts ----

export function useWhatsAppContacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['whatsapp-contacts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppContact[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateContact() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { full_name?: string; phone: string; tags?: string[]; source?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('whatsapp_contacts')
        .insert({ ...params, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
      toast.success('Contato adicionado');
    },
    onError: () => toast.error('Erro ao adicionar contato'),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .delete()
        .eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-contacts'] });
      toast.success('Contato removido');
    },
  });
}

// ---- Checkin Schedules ----

export interface AthleteCheckinSchedule {
  id: string;
  user_id: string;
  client_id: string;
  checkin_form_id: string;
  start_date: string;
  frequency_type: string;
  weekly_days: number[];
  send_time: string;
  timezone: string;
  due_in_hours: number | null;
  due_at: string | null;
  is_active: boolean;
  last_dispatched_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useAthleteCheckinSchedules(clientId: string | undefined) {
  return useQuery({
    queryKey: ['athlete-checkin-schedules', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('athlete_checkin_schedules')
        .select(`
          *,
          checkin_forms:checkin_form_id (id, title, is_active)
        `)
        .eq('client_id', clientId)
        .order('created_at');
      if (error) throw error;
      return data as (AthleteCheckinSchedule & { checkin_forms: { id: string; title: string; is_active: boolean } })[];
    },
    enabled: !!clientId,
  });
}

export function useSaveCheckinSchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id?: string;
      client_id: string;
      checkin_form_id: string;
      start_date: string;
      frequency_type: string;
      weekly_days: number[];
      send_time: string;
      due_in_hours?: number | null;
      is_active: boolean;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      if (params.id) {
        const { error } = await supabase
          .from('athlete_checkin_schedules')
          .update({
            checkin_form_id: params.checkin_form_id,
            start_date: params.start_date,
            frequency_type: params.frequency_type,
            weekly_days: params.weekly_days,
            send_time: params.send_time,
            due_in_hours: params.due_in_hours ?? 48,
            is_active: params.is_active,
          })
          .eq('id', params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('athlete_checkin_schedules')
          .insert({
            user_id: user.id,
            client_id: params.client_id,
            checkin_form_id: params.checkin_form_id,
            start_date: params.start_date,
            frequency_type: params.frequency_type,
            weekly_days: params.weekly_days,
            send_time: params.send_time,
            due_in_hours: params.due_in_hours ?? 48,
            is_active: params.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-checkin-schedules'] });
      toast.success('Agendamento salvo');
    },
    onError: (err: any) => {
      if (err?.message?.includes('duplicate')) {
        toast.error('Este formulário já está agendado para este atleta');
      } else {
        toast.error('Erro ao salvar agendamento');
      }
    },
  });
}

export function useDeleteCheckinSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('athlete_checkin_schedules')
        .delete()
        .eq('id', scheduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-checkin-schedules'] });
      toast.success('Agendamento removido');
    },
  });
}
