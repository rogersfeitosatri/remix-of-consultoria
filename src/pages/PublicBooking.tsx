import { useState, useMemo } from 'react';
import logoRF from '@/assets/logo-rf.jpg';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { PersonStanding, CalendarDays, Clock, CheckCircle2, Loader2, AlertCircle, Info } from 'lucide-react';
import { useSchedulingSettingsBySlug, useSchedulingBlocks, useAppointmentsByDate, useCreateAppointment } from '@/hooks/useScheduling';
import { useTimeBlocksBySettingsSlug } from '@/hooks/useTimeBlocks';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, isBefore, isSameDay, getDay, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const { data: settings, isLoading: settingsLoading } = useSchedulingSettingsBySlug(slug);
  const { data: blocks = [] } = useSchedulingBlocks(settings?.user_id);
  const { data: timeBlocks = [] } = useTimeBlocksBySettingsSlug(slug);
  
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  
  const createAppointment = useCreateAppointment();

  // Fetch consultation schedule by token
  const { data: consultationSchedule } = useQuery({
    queryKey: ['consultation_schedule_by_token', token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .from('consultation_schedules')
        .select(`
          *,
          clients (id, name, email, phone, user_id)
        `)
        .eq('booking_token', token)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  // Get appointments for selected date
  const { data: existingAppointments = [] } = useAppointmentsByDate(
    settings?.user_id || '',
    selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''
  );

  // Buffer minutes from settings
  const bufferMinutes = (settings as any)?.buffer_minutes || 0;

  // Get days that have time blocks configured (source of truth)
  const configuredDays = useMemo(() => {
    if (!timeBlocks || timeBlocks.length === 0) {
      // Fallback to working_days from settings only if no time blocks exist
      return settings?.working_days || [];
    }
    // Extract unique days from time blocks - THIS is the source of truth
    return [...new Set(timeBlocks.map(tb => tb.day_of_week))];
  }, [timeBlocks, settings?.working_days]);

  // Check if any availability is configured
  const hasConfiguredAvailability = timeBlocks && timeBlocks.length > 0;

  // Generate available time slots - ONLY from time blocks (source of truth)
  const availableSlots = useMemo(() => {
    if (!settings || !selectedDate) return [];

    const slots: string[] = [];
    const dayOfWeek = getDay(selectedDate);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Check for full day blocks first
    const fullDayBlock = blocks.find(
      b => b.block_date === dateStr && b.block_type === 'full_day'
    );
    if (fullDayBlock) return [];

    // Get time blocks for this day - ONLY USE TIME BLOCKS, no fallback to working_hours
    const dayTimeBlocks = timeBlocks.filter(tb => tb.day_of_week === dayOfWeek);
    
    // If no time blocks for this day, no slots available
    if (dayTimeBlocks.length === 0) {
      return [];
    }

    // Calculate slot step with buffer
    const slotStep = settings.slot_duration_minutes + bufferMinutes;

    // Generate slots ONLY from configured time blocks
    dayTimeBlocks.forEach(tb => {
      const [startHour, startMin] = tb.start_time.substring(0, 5).split(':').map(Number);
      const [endHour, endMin] = tb.end_time.substring(0, 5).split(':').map(Number);
      
      let currentTime = new Date(selectedDate);
      currentTime.setHours(startHour, startMin, 0, 0);
      
      const endTime = new Date(selectedDate);
      endTime.setHours(endHour, endMin, 0, 0);

      while (isBefore(currentTime, endTime)) {
        const timeStr = format(currentTime, 'HH:mm');
        
        // Check if slot is blocked by time range
        const isBlocked = blocks.some(b => {
          if (b.block_date !== dateStr || b.block_type !== 'time_range') return false;
          const blockStart = b.start_time?.substring(0, 5);
          const blockEnd = b.end_time?.substring(0, 5);
          return timeStr >= blockStart! && timeStr < blockEnd!;
        });

        // Check if slot conflicts with existing appointments (considering duration + buffer)
        const isBooked = existingAppointments.some(a => {
          if (!a.appointment_time) return false;
          const aptTime = a.appointment_time.substring(0, 5);
          const [aptHour, aptMin] = aptTime.split(':').map(Number);
          
          // Create appointment start and end times with buffer
          const aptStart = new Date(selectedDate);
          aptStart.setHours(aptHour, aptMin, 0, 0);
          
          // Block from (aptStart - buffer) to (aptEnd + buffer)
          const aptDuration = a.duration_minutes || settings.slot_duration_minutes;
          const blockStart = addMinutes(aptStart, -bufferMinutes);
          const blockEnd = addMinutes(aptStart, aptDuration + bufferMinutes);
          
          // Check if this slot falls within the blocked range
          const slotStart = new Date(selectedDate);
          slotStart.setHours(parseInt(timeStr.split(':')[0]), parseInt(timeStr.split(':')[1]), 0, 0);
          const slotEnd = addMinutes(slotStart, settings.slot_duration_minutes);
          
          // Slot conflicts if it overlaps with blocked range
          return slotStart < blockEnd && slotEnd > blockStart;
        });

        // Check if slot is in the past (for today)
        const isPast = isSameDay(selectedDate, new Date()) && isBefore(currentTime, new Date());

        if (!isBlocked && !isBooked && !isPast) {
          slots.push(timeStr);
        }

        // Use slot step (duration + buffer) for next slot
        currentTime = addMinutes(currentTime, slotStep);
      }
    });

    // Sort and remove duplicates
    return [...new Set(slots)].sort();
  }, [settings, selectedDate, blocks, existingAppointments, timeBlocks, bufferMinutes]);
  

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTime || !consultationSchedule || !settings) {
      toast.error('Selecione data e horário');
      return;
    }

    setBooking(true);

    try {
      // Create appointment
      const result = await createAppointment.mutateAsync({
        user_id: settings.user_id,
        client_id: consultationSchedule.clients.id,
        consultation_schedule_id: consultationSchedule.id,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        appointment_time: selectedTime + ':00',
        duration_minutes: settings.slot_duration_minutes,
        status: 'confirmed',
        notes: null,
      });

      // Update consultation schedule status and time
      // Ensure time is in correct format (HH:mm:ss) for PostgreSQL time type
      const timeValue = selectedTime.includes(':') ? `${selectedTime}:00` : null;
      await supabase
        .from('consultation_schedules')
        .update({
          status: 'completed',
          scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
          scheduled_time: timeValue,
        })
        .eq('id', consultationSchedule.id);

      // Try to create Google Calendar event with Meet
      try {
        const { data: calendarResult, error: calendarError } = await supabase.functions.invoke('create-calendar-event', {
          body: { appointmentId: result.id }
        });
        
        if (calendarError) {
          console.error('Error creating calendar event:', calendarError);
        }
        
        const meetLink = calendarResult?.google_meet_link;
        const meetStatus = calendarResult?.meet_status;
        
        // Only send WhatsApp if Meet was successfully created
        if (meetLink && meetStatus === 'created') {
          const clientPhone = consultationSchedule.clients.phone;
          if (clientPhone) {
            const formattedDate = format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
            const message = `✅ *Consulta Confirmada!*\n\n📅 ${formattedDate}\n⏰ ${selectedTime}\n\n🔗 *Link da reunião:*\n${meetLink}\n\nAté breve!`;
            
            await supabase.functions.invoke('send-whatsapp', {
              body: {
                clientId: consultationSchedule.clients.id,
                message
              }
            });
          }
        } else if (meetStatus === 'failed') {
          // Meet failed - don't send WhatsApp, admin will be notified
          console.log('Meet creation failed - WhatsApp not sent, admin will reprocess');
        }
      } catch (calendarErr) {
        console.error('Calendar creation error:', calendarErr);
      }

      setConfirmed(true);
      toast.success('Consulta agendada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao agendar');
    } finally {
      setBooking(false);
    }
  };

  const isDateDisabled = (date: Date) => {
    if (!settings) return true;
    
    const dayOfWeek = getDay(date);
    
    // ONLY allow days that have time blocks configured - source of truth
    if (!configuredDays.includes(dayOfWeek)) return true;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const hasFullDayBlock = blocks.some(
      b => b.block_date === dateStr && b.block_type === 'full_day'
    );
    if (hasFullDayBlock) return true;
    
    if (isBefore(date, new Date()) && !isSameDay(date, new Date())) return true;
    
    return false;
  };

  // Debug info for admin (only shown if debug param present)
  const [searchParamsDebug] = useSearchParams();
  const showDebug = searchParamsDebug.get('debug') === 'true';
  
  const debugInfo = useMemo(() => {
    if (!showDebug || !settings) return null;
    
    const daysLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const configuredDaysLabels = configuredDays.map(d => daysLabels[d]).join(', ');
    
    const timeBlocksByDay: Record<number, string[]> = {};
    timeBlocks.forEach(tb => {
      if (!timeBlocksByDay[tb.day_of_week]) {
        timeBlocksByDay[tb.day_of_week] = [];
      }
      timeBlocksByDay[tb.day_of_week].push(`${tb.start_time.substring(0, 5)}-${tb.end_time.substring(0, 5)}`);
    });
    
    return {
      configuredDays: configuredDaysLabels,
      timeBlocksByDay,
      slotDuration: settings.slot_duration_minutes,
      buffer: bufferMinutes,
      timezone: 'America/Sao_Paulo',
      hasTimeBlocks: timeBlocks.length > 0,
      blocksCount: blocks.length,
    };
  }, [showDebug, settings, configuredDays, timeBlocks, bufferMinutes, blocks]);

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <PersonStanding className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Link não encontrado</h1>
        <p className="text-muted-foreground text-center">
          Este link de agendamento não existe ou foi desativado.
        </p>
      </div>
    );
  }

  // No availability configured
  if (!hasConfiguredAvailability) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-16 w-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Agendamento indisponível</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Os horários de atendimento ainda não foram configurados. Por favor, entre em contato para agendar sua consulta.
        </p>
      </div>
    );
  }

  if (!token || !consultationSchedule) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <PersonStanding className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Inválido</h1>
        <p className="text-muted-foreground text-center">
          Use o link de agendamento enviado para você via WhatsApp.
        </p>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-full bg-green-500/10 p-4 w-fit mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Consulta Agendada!</h1>
          <p className="text-muted-foreground mb-6">
            Sua consulta foi confirmada para:
          </p>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-lg font-semibold">
                  {format(selectedDate!, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-2xl font-bold text-primary">{selectedTime}</p>
              </div>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground mt-6">
            Você pode fechar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <img src={logoRF} alt="Rogers Feitosa" className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <h1 className="text-xl font-bold">Rogers Feitosa</h1>
            <p className="text-sm text-muted-foreground">Nutrição & Treinamento</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Olá, {consultationSchedule.clients.name}!</CardTitle>
            <CardDescription>
              Escolha o melhor dia e horário para sua consulta
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Debug Panel for Admin */}
        {showDebug && debugInfo && (
          <Collapsible className="mb-6">
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                    <Info className="h-4 w-4" />
                    Debug: Configuração carregada (clique para expandir)
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="text-xs space-y-2 font-mono">
                    <p><strong>Dias habilitados:</strong> {debugInfo.configuredDays || 'Nenhum'}</p>
                    <p><strong>Duração slot:</strong> {debugInfo.slotDuration} min</p>
                    <p><strong>Buffer:</strong> {debugInfo.buffer} min</p>
                    <p><strong>Timezone:</strong> {debugInfo.timezone}</p>
                    <p><strong>Time blocks configurados:</strong> {debugInfo.hasTimeBlocks ? 'Sim' : 'Não'}</p>
                    <p><strong>Bloqueios ativos:</strong> {debugInfo.blocksCount}</p>
                    <div className="mt-2">
                      <strong>Janelas por dia:</strong>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                        {JSON.stringify(debugInfo.timeBlocksByDay, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Date Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Selecione a Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setSelectedTime(undefined);
                }}
                locale={ptBR}
                disabled={isDateDisabled}
                className="rounded-md border mx-auto"
              />
            </CardContent>
          </Card>

          {/* Time Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Selecione o Horário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Selecione uma data primeiro
                </p>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Não há horários disponíveis nesta data
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map(time => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTime(time)}
                      className="w-full"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Confirm Button */}
        {selectedDate && selectedTime && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Agendamento selecionado:</p>
                  <p className="font-semibold">
                    {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
                  </p>
                </div>
                <Button
                  onClick={handleConfirmBooking}
                  disabled={booking}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {booking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Agendando...
                    </>
                  ) : (
                    'Confirmar Agendamento'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
