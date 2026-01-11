import { Calendar, CalendarCheck, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isSameMonth, startOfWeek, endOfWeek, isWithinInterval, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NextConsultInfoProps {
  clientId: string;
}

/**
 * Simple informational component showing next consultation window
 * Displayed inside "Início" tab, below "Bem-vindo ao seu painel"
 * Non-clickable, purely informational
 */
export function NextConsultInfo({ clientId }: NextConsultInfoProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['athlete-next-consult-info', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      // Get client info
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, has_agenda_access, has_consultations, plan_type, user_id')
        .eq('id', clientId)
        .single();

      if (clientError) throw clientError;
      
      const hasConsultAccess = client?.has_agenda_access || client?.has_consultations || client?.plan_type === 'premium';
      if (!hasConsultAccess) {
        return { showInfo: false };
      }

      // Get consultation schedules for this client (ordered by date)
      const { data: schedules, error: scheduleError } = await supabase
        .from('consultation_schedules')
        .select('id, scheduled_date, send_link_date, status')
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: true });

      if (scheduleError) throw scheduleError;

      // Check if there are any upcoming appointments
      const { data: appointments, error: aptError } = await supabase
        .from('appointments')
        .select('id, appointment_date, appointment_time, status')
        .eq('client_id', clientId)
        .in('status', ['scheduled', 'confirmed'])
        .gte('appointment_date', format(new Date(), 'yyyy-MM-dd'))
        .order('appointment_date', { ascending: true });

      if (aptError) throw aptError;

      const now = new Date();
      
      // Filter future schedules
      const futureSchedules = (schedules || []).filter(s => {
        const scheduleDate = parseISO(s.scheduled_date);
        const weekEnd = endOfWeek(scheduleDate, { weekStartsOn: 1 });
        return !isBefore(weekEnd, now);
      });

      // Find the next appointment
      const nextAppointment = (appointments || []).find(apt => 
        parseISO(apt.appointment_date) >= now
      );

      // Find the next pending schedule
      const nextPendingSchedule = futureSchedules.find(s => 
        s.status === 'pending' || s.status === 'sent' || s.status === 'link_sent'
      );

      return {
        showInfo: futureSchedules.length > 0 || !!nextAppointment,
        nextAppointment,
        nextPendingSchedule,
        firstSchedule: futureSchedules[0] || null,
      };
    },
    enabled: !!clientId,
  });

  if (isLoading || !data?.showInfo) return null;

  const { nextAppointment, nextPendingSchedule, firstSchedule } = data;

  // Format week range
  const formatWeekRange = (dateStr: string) => {
    const date = parseISO(dateStr);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    
    if (isSameMonth(weekStart, weekEnd)) {
      return `${format(weekStart, 'dd/MM', { locale: ptBR })} e ${format(weekEnd, 'dd/MM', { locale: ptBR })}`;
    }
    return `${format(weekStart, 'dd/MM', { locale: ptBR })} e ${format(weekEnd, 'dd/MM', { locale: ptBR })}`;
  };

  // If there's a scheduled appointment
  if (nextAppointment) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-emerald-500/20 p-2">
            <CalendarCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-400 mb-0.5">
              ✅ Próxima consulta com o Rogers
            </p>
            <p className="text-white font-semibold">
              {format(parseISO(nextAppointment.appointment_date), "dd 'de' MMMM", { locale: ptBR })} às {nextAppointment.appointment_time.substring(0, 5)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Nesse encontro vamos alinhar ajustes do plano, rotina e próximos passos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show next window
  const nextWindow = nextPendingSchedule || firstSchedule;
  
  if (!nextWindow) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-gray-800/50 border border-gray-700">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-gray-700 p-2">
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-300 mb-0.5">
              📅 Próxima consulta com o Rogers
            </p>
            <p className="text-gray-400 text-sm">
              Cronograma de consultas em configuração.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 rounded-xl bg-[hsl(43,74%,49%)]/10 border border-[hsl(43,74%,49%)]/20">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-full bg-[hsl(43,74%,49%)]/20 p-2">
          <Calendar className="h-5 w-5 text-[hsl(43,74%,49%)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[hsl(43,74%,49%)] mb-0.5">
            📅 Próxima consulta com o Rogers
          </p>
          <p className="text-white">
            Seu próximo encontro está previsto entre {formatWeekRange(nextWindow.scheduled_date)}.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Nesse encontro vamos alinhar ajustes do plano, rotina e próximos passos.
          </p>
        </div>
      </div>
    </div>
  );
}
