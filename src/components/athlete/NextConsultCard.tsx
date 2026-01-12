import { Calendar, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isSameMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NextConsultCardProps {
  clientId: string;
}

interface ConsultationWindow {
  id: string;
  scheduled_date: string;
  send_link_date: string;
  status: string;
  booking_token?: string | null;
}

export function NextConsultCard({ clientId }: NextConsultCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['athlete-consultation-windows', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      // Get client info including onboarding_type and last_consultation_index
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, has_agenda_access, has_consultations, plan_type, user_id, onboarding_type, last_consultation_index')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      
      // Only show for continuation clients with consultations
      const hasConsultAccess = client?.has_agenda_access || client?.has_consultations || client?.plan_type === 'premium';
      if (!hasConsultAccess) {
        return { showCard: false, reason: 'no_access' };
      }

      // Get consultation schedules for this client
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

      // Check if there are any appointments already scheduled
      const { data: appointments, error: aptError } = await supabase
        .from('appointments')
        .select('id, appointment_date, status')
        .eq('client_id', clientId)
        .in('status', ['scheduled', 'confirmed'])
        .order('appointment_date', { ascending: true });

      if (aptError) throw aptError;

      const now = new Date();
      const futureSchedules = (schedules || []).filter(s => {
        const scheduleDate = parseISO(s.scheduled_date);
        return scheduleDate >= now;
      });

      return {
        showCard: futureSchedules.length > 0,
        onboardingType: client?.onboarding_type,
        lastConsultationIndex: client?.last_consultation_index || 0,
        schedules: futureSchedules,
        bookingToken: bookingLink?.token,
        hasScheduledAppointment: (appointments || []).length > 0,
        nextAppointment: appointments?.[0],
      };
    },
    enabled: !!clientId,
  });

  if (isLoading || !data?.showCard) return null;

  const { schedules, lastConsultationIndex } = data;
  
  // For continuation clients, the consultation number starts from lastConsultationIndex + 1
  // For new clients (lastConsultationIndex = 0), it starts from 1
  const getConsultationNumber = (index: number) => {
    return (lastConsultationIndex || 0) + index + 1;
  };

  const formatWeekRange = (dateStr: string) => {
    const date = parseISO(dateStr);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    
    if (isSameMonth(weekStart, weekEnd)) {
      return `${format(weekStart, 'd', { locale: ptBR })} a ${format(weekEnd, 'd \'de\' MMMM', { locale: ptBR })}`;
    }
    return `${format(weekStart, 'd \'de\' MMM', { locale: ptBR })} a ${format(weekEnd, 'd \'de\' MMM', { locale: ptBR })}`;
  };

  // This component now only shows the list of remaining consultations
  // The main "next consultation" info is shown by NextConsultBanner
  if (!schedules || schedules.length <= 1) return null;

  return (
    <div className="mb-6">
      {/* Remaining Consultations List */}
      {schedules.length > 1 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[hsl(43,74%,49%)]" />
              Consultas do seu plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {schedules.map((schedule, index) => (
                <div 
                  key={schedule.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 
                      ? 'bg-[hsl(43,74%,49%)]/10 border border-[hsl(43,74%,49%)]/30' 
                      : 'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2 ${
                      index === 0 ? 'bg-[hsl(43,74%,49%)]/20' : 'bg-gray-700'
                    }`}>
                      <Calendar className={`h-4 w-4 ${
                        index === 0 ? 'text-[hsl(43,74%,49%)]' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <p className={`font-medium ${
                        index === 0 ? 'text-[hsl(43,74%,49%)]' : 'text-white'
                      }`}>
                        {formatWeekRange(schedule.scheduled_date)}
                      </p>
                      <p className="text-xs text-gray-400">
                        Consulta {getConsultationNumber(index)}
                      </p>
                    </div>
                  </div>
                  {index === 0 && (
                    <Badge className="bg-[hsl(43,74%,49%)]/20 text-[hsl(43,74%,49%)] border-[hsl(43,74%,49%)]/30">
                      Próxima
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
