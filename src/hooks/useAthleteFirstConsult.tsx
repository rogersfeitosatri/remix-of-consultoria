import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if athlete has first consultation pending for their current plan
 * Returns the booking link if available
 */
export function useAthleteFirstConsultStatus(clientId: string | undefined) {
  return useQuery({
    queryKey: ['athlete-first-consult-status', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      // Get client info including has_agenda_access and has_consultations
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, has_agenda_access, has_consultations, plan_type, user_id, start_date')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      
      // If client doesn't have agenda access or consultations, no first consult card
      const hasConsultAccess = client?.has_agenda_access || client?.has_consultations || client?.plan_type === 'premium';
      if (!hasConsultAccess) {
        return { showCard: false, reason: 'no_access' };
      }

      // Check if there's any confirmed appointment for this client in the current plan cycle
      const { data: appointments, error: aptError } = await supabase
        .from('appointments')
        .select('id, appointment_date, status')
        .eq('client_id', clientId)
        .in('status', ['scheduled', 'confirmed', 'completed'])
        .gte('appointment_date', client.start_date)
        .order('appointment_date', { ascending: true })
        .limit(1);

      if (aptError) throw aptError;

      // If there's already an appointment for this plan cycle, don't show card
      if (appointments && appointments.length > 0) {
        return { 
          showCard: false, 
          reason: 'has_appointment',
          firstAppointment: appointments[0]
        };
      }

      // Get or create booking link for this client
      let bookingLink = null;
      
      const { data: existingLink, error: linkError } = await supabase
        .from('booking_links')
        .select('id, token, active')
        .eq('client_id', clientId)
        .eq('active', true)
        .maybeSingle();

      if (linkError) throw linkError;

      if (existingLink) {
        bookingLink = existingLink;
      } else {
        // Create a new booking link if none exists
        const { data: newLink, error: createError } = await supabase
          .from('booking_links')
          .insert({ client_id: clientId })
          .select('id, token, active')
          .single();

        if (createError) throw createError;
        bookingLink = newLink;
      }

      // Check if Google Calendar is connected for the admin
      const { data: calendarConnection, error: calError } = await supabase
        .from('google_calendar_connections')
        .select('is_connected')
        .eq('user_id', client.user_id)
        .maybeSingle();

      if (calError) throw calError;

      return {
        showCard: true,
        bookingToken: bookingLink?.token,
        isCalendarConnected: calendarConnection?.is_connected ?? false,
      };
    },
    enabled: !!clientId,
  });
}
