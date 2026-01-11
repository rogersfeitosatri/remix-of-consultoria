import { Calendar, Clock, CalendarCheck, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isSameMonth, startOfWeek, endOfWeek, isWithinInterval, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NextConsultBannerProps {
  clientId: string;
}

/**
 * Unified banner for "Próxima Consulta" - works for both new and continuation clients
 * Shows next consultation window and appropriate CTA
 */
export function NextConsultBanner({ clientId }: NextConsultBannerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['athlete-next-consult-banner', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      // Get client info
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, has_agenda_access, has_consultations, plan_type, user_id, onboarding_type')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      
      const hasConsultAccess = client?.has_agenda_access || client?.has_consultations || client?.plan_type === 'premium';
      if (!hasConsultAccess) {
        return { showBanner: false, reason: 'no_access' };
      }

      // Get consultation schedules for this client (ordered by date)
      const { data: schedules, error: scheduleError } = await supabase
        .from('consultation_schedules')
        .select('id, scheduled_date, send_link_date, status')
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: true });

      if (scheduleError) throw scheduleError;

      // Get booking link for this client
      const { data: bookingLink, error: linkError } = await supabase
        .from('booking_links')
        .select('token, active')
        .eq('client_id', clientId)
        .eq('active', true)
        .maybeSingle();

      if (linkError) throw linkError;

      // Check if there are any upcoming appointments
      const { data: appointments, error: aptError } = await supabase
        .from('appointments')
        .select('id, appointment_date, appointment_time, status')
        .eq('client_id', clientId)
        .in('status', ['scheduled', 'confirmed'])
        .gte('appointment_date', format(new Date(), 'yyyy-MM-dd'))
        .order('appointment_date', { ascending: true });

      if (aptError) throw aptError;

      // Check if Google Calendar is connected
      const { data: calendarConnection } = await supabase
        .from('google_calendar_connections')
        .select('is_connected')
        .eq('user_id', client.user_id)
        .maybeSingle();

      // Get automation settings (send time)
      const { data: automationSettings } = await supabase
        .from('consult_automation_settings')
        .select('send_time, timezone')
        .eq('user_id', client.user_id)
        .maybeSingle();

      const now = new Date();
      
      // Filter future schedules (where scheduled_date is in the future or current week)
      const futureSchedules = (schedules || []).filter(s => {
        const scheduleDate = parseISO(s.scheduled_date);
        const weekStart = startOfWeek(scheduleDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(scheduleDate, { weekStartsOn: 1 });
        // Include if we're currently in this week OR if the week hasn't started yet
        return !isBefore(weekEnd, now);
      });

      // If there's a scheduled appointment, find the next one
      const nextAppointment = (appointments || []).find(apt => 
        parseISO(apt.appointment_date) >= now
      );

      // Find the next pending/link_sent schedule (one that doesn't have a scheduled appointment)
      const nextPendingSchedule = futureSchedules.find(s => 
        s.status === 'pending' || s.status === 'sent' || s.status === 'link_sent'
      );

      return {
        showBanner: futureSchedules.length > 0 || !!nextAppointment,
        onboardingType: client?.onboarding_type,
        schedules: futureSchedules,
        bookingToken: bookingLink?.token,
        nextAppointment,
        nextPendingSchedule,
        isCalendarConnected: calendarConnection?.is_connected ?? false,
        sendTime: (automationSettings?.send_time || '07:00:00').slice(0, 5),
      };
    },
    enabled: !!clientId,
  });

  if (isLoading || !data?.showBanner) return null;

  const { schedules, bookingToken, nextAppointment, nextPendingSchedule, isCalendarConnected } = data;

  // Format week range with month crossing logic
  const formatWeekRange = (dateStr: string) => {
    const date = parseISO(dateStr);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    
    if (isSameMonth(weekStart, weekEnd)) {
      // Same month: "1 a 7 de fevereiro"
      return `${format(weekStart, 'd', { locale: ptBR })} a ${format(weekEnd, 'd \'de\' MMMM', { locale: ptBR })}`;
    }
    // Crosses month: "29 jan a 4 fev"
    return `${format(weekStart, 'd \'de\' MMM', { locale: ptBR })} a ${format(weekEnd, 'd \'de\' MMM', { locale: ptBR })}`;
  };

  // Check if we're within the current scheduling window
  const isWithinCurrentWindow = (dateStr: string) => {
    const date = parseISO(dateStr);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    const now = new Date();
    return isWithinInterval(now, { start: weekStart, end: weekEnd });
  };

  // Determine what to show
  if (nextAppointment) {
    // Has a scheduled appointment - show it
    return (
      <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 border-0 mb-6 shadow-lg">
        <CardContent className="relative py-6 px-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-black/20 text-white border-0 backdrop-blur-sm font-bold">
                ✅ CONSULTA AGENDADA
              </Badge>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-black/20 p-4 backdrop-blur-sm">
                  <CalendarCheck className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    {format(parseISO(nextAppointment.appointment_date), "dd 'de' MMMM", { locale: ptBR })}
                  </h3>
                  <p className="text-white/80 text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    às {nextAppointment.appointment_time.substring(0, 5)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No scheduled appointment - show next window
  const nextWindow = nextPendingSchedule || (schedules && schedules[0]);
  
  if (!nextWindow) {
    // No schedules - show "em configuração" message
    return (
      <Card className="relative overflow-hidden bg-gray-800 border-gray-700 mb-6">
        <CardContent className="relative py-6 px-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-gray-700 p-3">
              <Calendar className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-1">Próxima Consulta</h3>
              <p className="text-gray-400 text-sm">
                Cronograma de consultas em configuração. Em breve aparecerá aqui.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const nextWindowIsActive = isWithinCurrentWindow(nextWindow.scheduled_date);
  const linkSent = nextWindow.status === 'sent' || nextWindow.status === 'link_sent';
  const canSchedule = linkSent || nextWindowIsActive;

  // Get send link date info
  const sendLinkDate = parseISO(nextWindow.send_link_date);
  const sendLinkMonday = startOfWeek(sendLinkDate, { weekStartsOn: 1 });

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-[hsl(43,74%,49%)] via-[hsl(43,74%,45%)] to-[hsl(43,74%,35%)] border-0 mb-6 shadow-lg">
      <CardContent className="relative py-6 px-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-black/20 text-white border-0 backdrop-blur-sm font-bold">
              📅 PRÓXIMA CONSULTA
            </Badge>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-black/20 p-4 backdrop-blur-sm">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-black mb-1">
                  Semana: {formatWeekRange(nextWindow.scheduled_date)}
                </h3>
                <p className="text-black/80 text-sm">
                  {canSchedule ? (
                    <>O link para agendar sua consulta já está disponível!</>
                  ) : (
                    <>O link para agendar será enviado na segunda-feira {format(sendLinkMonday, "dd/MM", { locale: ptBR })} às 07:00.</>
                  )}
                </p>
              </div>
            </div>
            
            {canSchedule && bookingToken ? (
              <Button
                asChild
                size="lg"
                className="bg-black hover:bg-gray-900 text-[hsl(43,74%,49%)] font-bold whitespace-nowrap shadow-xl hover:scale-105 transition-transform"
              >
                <a href={`/booking/${bookingToken}`}>
                  <Calendar className="h-5 w-5 mr-2" />
                  Agendar Consulta
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-black/70 bg-black/10 px-4 py-2 rounded-lg">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Aguardar link</span>
              </div>
            )}
          </div>

          {!isCalendarConnected && canSchedule && (
            <div className="mt-2 pt-4 border-t border-black/20 flex items-center gap-2 text-black/80 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Aguardando configuração do calendário pelo assessor.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
