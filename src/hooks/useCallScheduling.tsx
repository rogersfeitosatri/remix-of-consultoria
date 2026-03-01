import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface WeeklySlot {
  day: number; // 0=Sun..6=Sat
  start: string; // "09:00"
  end: string; // "12:00"
}

export interface CallSchedulingLink {
  id: string;
  user_id: string;
  strategic_call_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  timezone: string;
  slot_duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_advance_hours: number;
  max_advance_days: number;
  daily_limit: number | null;
  slot_capacity: number;
  allow_multiple_per_lead: boolean;
  require_manual_confirmation: boolean;
  weekly_availability: WeeklySlot[];
  blocked_dates: string[];
  extra_dates: any[];
  confirmation_template: string | null;
  reminder_24h_template: string | null;
  reminder_2h_template: string | null;
  reminder_15m_template: string | null;
  cancellation_template: string | null;
  meeting_link: string | null;
  send_reminder_24h: boolean;
  send_reminder_2h: boolean;
  send_reminder_15m: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallBooking {
  id: string;
  scheduling_link_id: string;
  strategic_call_id: string | null;
  strategic_call_response_id: string | null;
  user_id: string;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
  status: string;
  meeting_link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Admin: list all scheduling links
export function useCallSchedulingLinks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['call-scheduling-links', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_scheduling_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CallSchedulingLink[];
    },
    enabled: !!user?.id,
  });
}

// Admin: get single scheduling link
export function useCallSchedulingLink(id: string | undefined) {
  return useQuery({
    queryKey: ['call-scheduling-link', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_scheduling_links')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as CallSchedulingLink;
    },
    enabled: !!id,
  });
}

// Public: get scheduling link by slug
export function useCallSchedulingLinkBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['call-scheduling-link-slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_scheduling_links')
        .select('*')
        .eq('slug', slug!)
        .eq('status', 'active')
        .single();
      if (error) throw error;
      return data as unknown as CallSchedulingLink;
    },
    enabled: !!slug,
  });
}

// Admin: create scheduling link
export function useCreateCallSchedulingLink() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; slug: string; strategic_call_id?: string }) => {
      const defaultAvailability: WeeklySlot[] = [
        { day: 1, start: '09:00', end: '12:00' },
        { day: 1, start: '14:00', end: '18:00' },
        { day: 2, start: '09:00', end: '12:00' },
        { day: 2, start: '14:00', end: '18:00' },
        { day: 3, start: '09:00', end: '12:00' },
        { day: 3, start: '14:00', end: '18:00' },
        { day: 4, start: '09:00', end: '12:00' },
        { day: 4, start: '14:00', end: '18:00' },
        { day: 5, start: '09:00', end: '12:00' },
        { day: 5, start: '14:00', end: '18:00' },
      ];
      const { data, error } = await supabase
        .from('call_scheduling_links')
        .insert({
          user_id: user!.id,
          title: input.title,
          slug: input.slug,
          strategic_call_id: input.strategic_call_id || null,
          weekly_availability: defaultAvailability,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call-scheduling-links'] });
      toast.success('Link de agendamento criado!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// Admin: update scheduling link
export function useUpdateCallSchedulingLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CallSchedulingLink> & { id: string }) => {
      const { error } = await supabase
        .from('call_scheduling_links')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['call-scheduling-links'] });
      qc.invalidateQueries({ queryKey: ['call-scheduling-link', vars.id] });
      toast.success('Link atualizado!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// Admin: list bookings for a scheduling link
export function useCallBookings(schedulingLinkId: string | undefined) {
  return useQuery({
    queryKey: ['call-bookings', schedulingLinkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_bookings')
        .select('*')
        .eq('scheduling_link_id', schedulingLinkId!)
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });
      if (error) throw error;
      return data as unknown as CallBooking[];
    },
    enabled: !!schedulingLinkId,
  });
}

// Admin: list ALL bookings
export function useAllCallBookings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['all-call-bookings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_bookings')
        .select('*, call_scheduling_links(title, slug)')
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });
      if (error) throw error;
      return data as unknown as (CallBooking & { call_scheduling_links: { title: string; slug: string } })[];
    },
    enabled: !!user?.id,
  });
}

// Public: get available slots for a date
export function useCallAvailableSlots(schedulingLinkId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['call-available-slots', schedulingLinkId, date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_call_available_slots', {
        p_scheduling_link_id: schedulingLinkId!,
        p_date: date!,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!schedulingLinkId && !!date,
    staleTime: 30_000,
  });
}

// Public: create booking (atomic)
export function useCreateCallBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      scheduling_link_id: string;
      booking_date: string;
      booking_time: string;
      lead_name?: string;
      lead_email?: string;
      lead_phone?: string;
      strategic_call_response_id?: string;
    }) => {
      const { data, error } = await supabase.rpc('create_call_booking', {
        p_scheduling_link_id: input.scheduling_link_id,
        p_booking_date: input.booking_date,
        p_booking_time: input.booking_time,
        p_lead_name: input.lead_name || null,
        p_lead_email: input.lead_email || null,
        p_lead_phone: input.lead_phone || null,
        p_strategic_call_response_id: input.strategic_call_response_id || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call-available-slots'] });
      qc.invalidateQueries({ queryKey: ['call-bookings'] });
      qc.invalidateQueries({ queryKey: ['all-call-bookings'] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// Admin: update booking status
export function useUpdateCallBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CallBooking> & { id: string }) => {
      const { error } = await supabase
        .from('call_bookings')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call-bookings'] });
      qc.invalidateQueries({ queryKey: ['all-call-bookings'] });
      toast.success('Reserva atualizada!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}
