import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, Video, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBookingLinkByToken, useAvailabilityRulesByAdmin } from '@/hooks/useConsultations';
import { toast } from 'sonner';
import { format, addDays, parse, isBefore, startOfDay, isAfter, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import rogersProfile from '@/assets/rogers-profile.jpg';

interface TimeSlot {
  time: string;
  available: boolean;
}

export default function PublicBookingConsult() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const { data: bookingLink, isLoading: linkLoading, error: linkError } = useBookingLinkByToken(token);
  const adminUserId = bookingLink?.client?.user_id;
  const { data: availabilityRules = [], isLoading: rulesLoading, error: rulesError } = useAvailabilityRulesByAdmin(adminUserId);
  
  // Debug logs
  console.log('[PublicBookingConsult] token:', token);
  console.log('[PublicBookingConsult] bookingLink:', bookingLink);
  console.log('[PublicBookingConsult] adminUserId:', adminUserId);
  console.log('[PublicBookingConsult] availabilityRules:', availabilityRules);
  console.log('[PublicBookingConsult] rulesLoading:', rulesLoading, 'rulesError:', rulesError);
  console.log('[PublicBookingConsult] linkError:', linkError);
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{ date: string; time: string; meetLink?: string } | null>(null);

  // Fetch existing appointments to check availability
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!adminUserId) return;

      const { data } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time, duration_minutes, status')
        .eq('user_id', adminUserId)
        .in('status', ['scheduled', 'confirmed'])
        .gte('appointment_date', format(new Date(), 'yyyy-MM-dd'));

      setExistingAppointments(data || []);
    };

    fetchAppointments();
  }, [adminUserId]);

  // Calculate available dates based on availability rules
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    
    // Check next 60 days
    for (let i = 1; i <= 60; i++) {
      const date = addDays(today, i);
      const dayOfWeek = date.getDay();
      
      // Check if there's an availability rule for this day
      const hasRule = availabilityRules.some(rule => rule.day_of_week === dayOfWeek);
      if (hasRule) {
        dates.push(date);
      }
    }
    
    return dates;
  }, [availabilityRules]);

  // Calculate available time slots for selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    
    const dayOfWeek = selectedDate.getDay();
    const rulesForDay = availabilityRules.filter(r => r.day_of_week === dayOfWeek);
    
    const slots: TimeSlot[] = [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    rulesForDay.forEach(rule => {
      const [startHour, startMin] = rule.start_time.split(':').map(Number);
      const [endHour, endMin] = rule.end_time.split(':').map(Number);
      const slotMinutes = rule.slot_minutes;
      
      let current = setMinutes(setHours(selectedDate, startHour), startMin);
      const end = setMinutes(setHours(selectedDate, endHour), endMin);
      
      while (isBefore(current, end)) {
        const timeStr = format(current, 'HH:mm');
        
        // Check if this slot is already booked
        const isBooked = existingAppointments.some(apt => {
          if (apt.appointment_date !== dateStr) return false;
          
          const aptTime = apt.appointment_time.substring(0, 5);
          const aptStart = parse(aptTime, 'HH:mm', selectedDate);
          const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
          const slotTime = parse(timeStr, 'HH:mm', selectedDate);
          
          return slotTime >= aptStart && slotTime < aptEnd;
        });
        
        // Check if slot is in the past
        const slotDateTime = parse(timeStr, 'HH:mm', selectedDate);
        const isPast = isBefore(slotDateTime, new Date());
        
        slots.push({
          time: timeStr,
          available: !isBooked && !isPast,
        });
        
        current = new Date(current.getTime() + slotMinutes * 60000);
      }
    });
    
    return slots.sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, availabilityRules, existingAppointments]);

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !bookingLink) return;
    
    setIsSubmitting(true);
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Get slot duration from availability rules
      const dayOfWeek = selectedDate.getDay();
      const rule = availabilityRules.find(r => r.day_of_week === dayOfWeek);
      const duration = rule?.slot_minutes || 60;
      
      // Create appointment
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          client_id: bookingLink.client_id,
          user_id: bookingLink.client.user_id,
          appointment_date: dateStr,
          appointment_time: selectedTime + ':00',
          duration_minutes: duration,
          status: 'confirmed',
          timezone: 'America/Fortaleza',
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Update booking link usage count
      await supabase
        .from('booking_links')
        .update({ usage_count: (bookingLink.usage_count || 0) + 1 })
        .eq('id', bookingLink.id);

      // Update consultation schedule rules
      const nextInviteDate = format(addDays(selectedDate, 28), 'yyyy-MM-dd'); // 4 weeks default
      await supabase
        .from('consultation_schedule_rules')
        .upsert({
          client_id: bookingLink.client_id,
          last_appointment_at: new Date().toISOString(),
          next_invite_date: nextInviteDate,
        }, { onConflict: 'client_id' });

      // Try to create Google Calendar event
      let meetLink = null;
      try {
        const { data: calendarData } = await supabase.functions.invoke('create-calendar-event', {
          body: { appointmentId: appointment.id },
        });
        meetLink = calendarData?.google_meet_link;
      } catch (calendarError) {
        console.error('Calendar event creation failed:', calendarError);
      }

      // Send WhatsApp confirmation
      try {
        const formattedDate = format(selectedDate, "dd 'de' MMMM", { locale: ptBR });
        let message = `✅ Consulta confirmada!\n\n📅 Data: ${formattedDate}\n⏰ Horário: ${selectedTime}`;
        if (meetLink) {
          message += `\n\n🎥 Link da videochamada:\n${meetLink}`;
        }
        message += '\n\nAté lá!';

        await supabase.functions.invoke('send-whatsapp', {
          body: {
            clientId: bookingLink.client_id,
            message,
          },
        });
      } catch (whatsappError) {
        console.error('WhatsApp send failed:', whatsappError);
      }

      // Log the confirmation
      await supabase.from('consult_invite_logs').insert({
        client_id: bookingLink.client_id,
        channel: 'system',
        status: 'confirmed',
        message_type: 'booking_confirmation',
      });

      setConfirmationData({
        date: format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR }),
        time: selectedTime,
        meetLink,
      });
      setIsConfirmed(true);
      toast.success('Consulta agendada com sucesso!');

    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.message || 'Erro ao agendar consulta');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (linkLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(43,74%,49%)]" />
      </div>
    );
  }

  if (linkError || !bookingLink) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Link inválido</h1>
        <p className="text-gray-400 text-center">
          Este link de agendamento não existe ou expirou.
        </p>
      </div>
    );
  }

  if (isConfirmed && confirmationData) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-gray-800 bg-black">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-[hsl(43,74%,49%)]">
              <img src={rogersProfile} alt="Rogers Feitosa" className="w-full h-[200%] object-cover object-[center_15%]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">ROGERS FEITOSA</h1>
              <p className="text-xs text-gray-400">Nutrição e Treinamento</p>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="rounded-full bg-green-500/10 p-4 w-fit mx-auto mb-6">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Consulta Agendada!</h2>
          <p className="text-gray-400 mb-8">Sua consulta foi confirmada com sucesso.</p>

          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center justify-center gap-3">
                <CalendarIcon className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                <span className="text-white text-lg capitalize">{confirmationData.date}</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Clock className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                <span className="text-white text-lg">{confirmationData.time}</span>
              </div>
              {confirmationData.meetLink && (
                <div className="pt-4 border-t border-gray-800">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Video className="h-5 w-5 text-blue-400" />
                    <span className="text-gray-400">Link da videochamada</span>
                  </div>
                  <a
                    href={confirmationData.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
                  >
                    Abrir Google Meet
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-sm text-gray-500">
            Você receberá uma confirmação por WhatsApp com todos os detalhes.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full overflow-hidden border border-[hsl(43,74%,49%)]">
            <img src={rogersProfile} alt="Rogers Feitosa" className="w-full h-[200%] object-cover object-[center_15%]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">ROGERS FEITOSA</h1>
            <p className="text-xs text-gray-400">Nutrição e Treinamento</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Agendar Consulta</h2>
          <p className="text-gray-400">
            Olá, <span className="text-[hsl(43,74%,49%)]">{bookingLink.client.name}</span>! Escolha o melhor horário para sua consulta.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Calendar */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                Escolha a Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setSelectedTime(null);
                }}
                locale={ptBR}
                disabled={(date) => {
                  const isAvailable = availableDates.some(
                    d => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                  );
                  return !isAvailable;
                }}
                className="rounded-md border border-gray-800"
              />
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                Escolha o Horário
              </CardTitle>
              {selectedDate && (
                <CardDescription className="text-gray-400">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-gray-500 text-center py-8">
                  Selecione uma data primeiro
                </p>
              ) : availableSlots.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhum horário disponível nesta data
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={selectedTime === slot.time ? 'default' : 'outline'}
                      size="sm"
                      disabled={!slot.available}
                      onClick={() => setSelectedTime(slot.time)}
                      className={
                        selectedTime === slot.time
                          ? 'bg-[hsl(43,74%,49%)] text-black hover:bg-[hsl(43,74%,40%)]'
                          : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                      }
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Confirm Button */}
        {selectedDate && selectedTime && (
          <div className="mt-6">
            <Card className="bg-gray-900 border-[hsl(43,74%,49%)]/30 border-2">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-gray-400 text-sm">Consulta selecionada:</p>
                    <p className="text-white font-medium">
                      {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
                    </p>
                  </div>
                  <Button
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                    className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold px-8"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Agendando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirmar Agendamento
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
