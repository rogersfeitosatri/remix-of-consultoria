import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Types
export interface BookingLink {
  id: string;
  client_id: string;
  active: boolean;
  token: string;
  created_at: string;
  updated_at: string;
  last_sent_at: string | null;
  usage_count: number;
  expires_at: string | null;
  client?: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface ConsultationScheduleRule {
  client_id: string;
  cadence_weeks: number;
  next_invite_date: string | null;
  is_enabled: boolean;
  last_appointment_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultAutomationSettings {
  id: string;
  user_id: string;
  send_day_of_week: number;
  send_time: string;
  timezone: string;
  message_template_booking: string;
  message_template_confirmation: string;
  is_enabled: boolean;
}

export interface AvailabilityRule {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  is_enabled: boolean;
}

export interface GoogleCalendarConnection {
  id: string;
  user_id: string;
  calendar_id: string | null;
  service_account_email: string | null;
  service_account_key_encrypted: string | null;
  is_connected: boolean;
  last_sync_at: string | null;
}

export interface ConsultInviteLog {
  id: string;
  client_id: string;
  sent_at: string;
  channel: string;
  status: string;
  message_type: string;
  error_message: string | null;
}

// Hook: Booking Links
export function useBookingLinks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['booking-links', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_links')
        .select(`
          *,
          client:clients(name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (BookingLink & { client: { name: string; email: string; phone: string } })[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

// Interface for safe public booking context (returned by RPC)
interface PublicBookingContext {
  booking_link_id: string;
  client_id: string;
  client_name: string;
  admin_user_id: string;
  usage_count: number;
}

export function useBookingLinkByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['booking-link-token', token],
    queryFn: async () => {
      if (!token) return null;

      console.log('[useBookingLinkByToken] Fetching with token via RPC:', token);
      
      // Use secure RPC to fetch booking context (avoids RLS issues)
      const { data, error } = await supabase
        .rpc('get_public_booking_context', { p_token: token });

      console.log('[useBookingLinkByToken] RPC result:', { data, error });
      
      if (error) throw error;
      if (!data || data.length === 0) return null;
      
      const ctx = data[0] as PublicBookingContext;
      
      // Return in expected format
      return {
        id: ctx.booking_link_id,
        client_id: ctx.client_id,
        token,
        usage_count: ctx.usage_count,
        active: true,
        client: {
          id: ctx.client_id,
          name: ctx.client_name,
          user_id: ctx.admin_user_id,
        },
      };
    },
    enabled: !!token,
  });
}

export function useCreateBookingLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase
        .from('booking_links')
        .insert({ client_id: clientId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-links'] });
    },
  });
}

export function useToggleBookingLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('booking_links')
        .update({ active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-links'] });
    },
  });
}

// Hook: Consultation Schedule Rules
export function useConsultationRules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['consultation-rules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultation_schedule_rules')
        .select(`
          *,
          client:clients(name, email, plan_type, has_agenda_access)
        `);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

export function useUpsertConsultationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<ConsultationScheduleRule> & { client_id: string }) => {
      const { error } = await supabase
        .from('consultation_schedule_rules')
        .upsert(data, { onConflict: 'client_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-rules'] });
    },
  });
}

// Hook: Automation Settings
export function useConsultAutomationSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['consult-automation-settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consult_automation_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      return data as ConsultAutomationSettings | null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSaveConsultAutomationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<ConsultAutomationSettings>) => {
      const { error } = await supabase
        .from('consult_automation_settings')
        .upsert({ ...data, user_id: user?.id }, { onConflict: 'user_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consult-automation-settings'] });
    },
  });
}

// Hook: Availability Rules
export function useAvailabilityRules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['availability-rules', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // First try to get from scheduling_time_blocks (new system)
      const { data: settings } = await supabase
        .from('scheduling_settings')
        .select('id, slot_duration_minutes, buffer_minutes')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settings) {
        const { data: timeBlocks, error: blocksError } = await supabase
          .from('scheduling_time_blocks')
          .select('*')
          .eq('settings_id', settings.id)
          .order('day_of_week')
          .order('start_time');

        if (!blocksError && timeBlocks && timeBlocks.length > 0) {
          // Convert time blocks to availability rules format
          // slot_minutes = consultation duration + buffer between appointments
          const totalSlotMinutes = (settings.slot_duration_minutes || 30) + (settings.buffer_minutes || 15);
          return timeBlocks.map(block => ({
            id: block.id,
            user_id: user.id,
            day_of_week: block.day_of_week,
            start_time: block.start_time,
            end_time: block.end_time,
            slot_minutes: totalSlotMinutes,
            is_enabled: true,
            created_at: block.created_at,
            updated_at: block.created_at,
          })) as AvailabilityRule[];
        }
      }

      // Fallback to old availability_rules table
      const { data, error } = await supabase
        .from('availability_rules')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_enabled', true)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;
      return data as AvailabilityRule[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAvailabilityRulesByAdmin(adminUserId: string | undefined) {
  return useQuery({
    queryKey: ['availability-rules-admin', adminUserId],
    queryFn: async () => {
      if (!adminUserId) return [];

      // First try to get from scheduling_time_blocks (new system)
      const { data: settings } = await supabase
        .from('scheduling_settings')
        .select('id, slot_duration_minutes')
        .eq('user_id', adminUserId)
        .maybeSingle();

      if (settings) {
        const { data: timeBlocks, error: blocksError } = await supabase
          .from('scheduling_time_blocks')
          .select('*')
          .eq('settings_id', settings.id)
          .order('day_of_week')
          .order('start_time');

        if (!blocksError && timeBlocks && timeBlocks.length > 0) {
          // Convert time blocks to availability rules format
          return timeBlocks.map(block => ({
            id: block.id,
            user_id: adminUserId,
            day_of_week: block.day_of_week,
            start_time: block.start_time,
            end_time: block.end_time,
            slot_minutes: settings.slot_duration_minutes || 30,
            is_enabled: true,
          })) as AvailabilityRule[];
        }
      }

      // Fallback to old availability_rules table
      const { data, error } = await supabase
        .from('availability_rules')
        .select('*')
        .eq('user_id', adminUserId)
        .eq('is_enabled', true)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;
      return data as AvailabilityRule[];
    },
    enabled: !!adminUserId,
  });
}

export function useSaveAvailabilityRule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<AvailabilityRule, 'id' | 'user_id'> & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('availability_rules')
          .update(data)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('availability_rules')
          .insert({ ...data, user_id: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-rules'] });
    },
  });
}

export function useDeleteAvailabilityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('availability_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-rules'] });
    },
  });
}

// Hook: Google Calendar Connection
export function useGoogleCalendarConnection() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['google-calendar-connection', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_calendar_connections')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      return data as GoogleCalendarConnection | null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSaveGoogleCalendarConnection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<GoogleCalendarConnection>) => {
      const { error } = await supabase
        .from('google_calendar_connections')
        .upsert({ ...data, user_id: user?.id }, { onConflict: 'user_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] });
    },
  });
}

// Hook: Consult Invite Logs
export function useConsultInviteLogs(clientId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['consult-invite-logs', clientId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('consult_invite_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConsultInviteLog[];
    },
    enabled: !!user,
  });
}

// Hook: Premium Clients (with agenda access)
export function usePremiumClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['premium-clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          booking_link:booking_links(id, token, active, last_sent_at),
          consultation_rule:consultation_schedule_rules(*)
        `)
        .or('plan_type.eq.premium,has_agenda_access.eq.true')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

// Hook: Appointments with Google Calendar info
export function useConsultationAppointments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['consultation-appointments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          client:clients(name, email, phone)
        `)
        .eq('user_id', user!.id)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 30, // 30 seconds - more responsive
  });
}

export function useCreateAppointmentWithMeet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      client_id: string;
      appointment_date: string;
      appointment_time: string;
      duration_minutes: number;
      notes?: string;
      user_id: string;
    }) => {
      // Create the appointment
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          ...data,
          status: 'confirmed',
          timezone: 'America/Fortaleza',
        })
        .select()
        .single();

      if (error) throw error;

      // Call edge function to create Google Calendar event
      try {
        const { data: meetData } = await supabase.functions.invoke('create-calendar-event', {
          body: { appointmentId: appointment.id },
        });

        if (meetData?.google_meet_link) {
          // Update appointment with Meet link
          await supabase
            .from('appointments')
            .update({
              google_meet_link: meetData.google_meet_link,
              google_calendar_event_id: meetData.event_id,
            })
            .eq('id', appointment.id);
        }
      } catch (calendarError) {
        console.error('Failed to create Google Calendar event:', calendarError);
        // Don't fail the appointment creation if calendar fails
      }

      return appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      appointmentId, 
      notifyClient = true, 
      reason 
    }: { 
      appointmentId: string; 
      notifyClient?: boolean; 
      reason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('cancel-calendar-event', {
        body: { appointmentId, notifyClient, reason },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao cancelar');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      appointmentId, 
      newDate, 
      newTime, 
      notifyClient = true 
    }: { 
      appointmentId: string; 
      newDate: string; 
      newTime: string; 
      notifyClient?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('reschedule-appointment', {
        body: { appointmentId, newDate, newTime, notifyClient },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao remarcar');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useCheckCancellationAllowed() {
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data: appointment, error } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time')
        .eq('id', appointmentId)
        .single();

      if (error) throw error;

      const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
      const now = new Date();
      const hoursUntil = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      return {
        allowed: hoursUntil >= 24,
        hoursRemaining: Math.round(hoursUntil),
        message: hoursUntil < 24 
          ? `Não é possível cancelar/remarcar com menos de 24h de antecedência. Faltam ${Math.round(hoursUntil)} horas.`
          : 'Permitido cancelar/remarcar',
      };
    },
  });
}

// Hook: Send booking invite
export function useSendBookingInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, bookingToken }: { clientId: string; bookingToken: string }) => {
      // Use send-booking-link function which uses the correct domain (rogersfeitosa.com.br)
      // and fetches template from database
      const { data, error } = await supabase.functions.invoke('send-booking-link', {
        body: {
          clientId,
          messageType: 'booking_invite',
        },
      });

      if (error) throw error;

      // Log the invite
      await supabase.from('consult_invite_logs').insert({
        client_id: clientId,
        channel: 'whatsapp',
        status: 'sent',
        message_type: 'booking_invite',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-links'] });
      queryClient.invalidateQueries({ queryKey: ['consult-invite-logs'] });
      queryClient.invalidateQueries({ queryKey: ['client-booking-link'] });
    },
  });
}
