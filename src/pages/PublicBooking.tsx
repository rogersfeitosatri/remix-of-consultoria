import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { PersonStanding, CalendarDays, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { useSchedulingSettingsBySlug, useSchedulingBlocks, useAppointmentsByDate, useCreateAppointment } from '@/hooks/useScheduling';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, addMinutes, isBefore, isAfter, isSameDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const { data: settings, isLoading: settingsLoading } = useSchedulingSettingsBySlug(slug);
  const { data: blocks = [] } = useSchedulingBlocks(settings?.user_id);
  
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

  // Generate available time slots
  const availableSlots = useMemo(() => {
    if (!settings || !selectedDate) return [];

    const slots: string[] = [];
    const dayOfWeek = getDay(selectedDate);
    
    // Check if this day is a working day
    if (!settings.working_days.includes(dayOfWeek)) {
      return [];
    }

    // Check for full day blocks
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const fullDayBlock = blocks.find(
      b => b.block_date === dateStr && b.block_type === 'full_day'
    );
    if (fullDayBlock) return [];

    // Parse working hours
    const [startHour, startMin] = settings.working_hours_start.split(':').map(Number);
    const [endHour, endMin] = settings.working_hours_end.split(':').map(Number);
    
    let currentTime = new Date(selectedDate);
    currentTime.setHours(startHour, startMin, 0, 0);
    
    const endTime = new Date(selectedDate);
    endTime.setHours(endHour, endMin, 0, 0);

    while (isBefore(currentTime, endTime)) {
      const timeStr = format(currentTime, 'HH:mm');
      const slotEnd = addMinutes(currentTime, settings.slot_duration_minutes);
      
      // Check if slot is blocked by time range
      const isBlocked = blocks.some(b => {
        if (b.block_date !== dateStr || b.block_type !== 'time_range') return false;
        const blockStart = b.start_time?.substring(0, 5);
        const blockEnd = b.end_time?.substring(0, 5);
        return timeStr >= blockStart! && timeStr < blockEnd!;
      });

      // Check if slot is already booked
      const isBooked = existingAppointments.some(a => {
        const aptTime = a.appointment_time?.substring(0, 5);
        return aptTime === timeStr;
      });

      // Check if slot is in the past (for today)
      const isPast = isSameDay(selectedDate, new Date()) && isBefore(currentTime, new Date());

      if (!isBlocked && !isBooked && !isPast) {
        slots.push(timeStr);
      }

      currentTime = addMinutes(currentTime, settings.slot_duration_minutes);
    }

    return slots;
  }, [settings, selectedDate, blocks, existingAppointments]);

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTime || !consultationSchedule || !settings) {
      toast.error('Selecione data e horário');
      return;
    }

    setBooking(true);

    try {
      // Create appointment
      await createAppointment.mutateAsync({
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
      await supabase
        .from('consultation_schedules')
        .update({
          status: 'completed',
          scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
          scheduled_time: selectedTime + ':00',
        })
        .eq('id', consultationSchedule.id);

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
    if (!settings.working_days.includes(dayOfWeek)) return true;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const hasFullDayBlock = blocks.some(
      b => b.block_date === dateStr && b.block_type === 'full_day'
    );
    if (hasFullDayBlock) return true;
    
    if (isBefore(date, new Date()) && !isSameDay(date, new Date())) return true;
    
    return false;
  };

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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <PersonStanding className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">RF Assessoria</h1>
            <p className="text-sm text-muted-foreground">Esportiva</p>
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
