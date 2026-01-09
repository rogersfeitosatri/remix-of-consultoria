import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, Video, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAvailabilityRulesByAdmin } from '@/hooks/useConsultations';
import { toast } from 'sonner';
import { format, addDays, parse, isBefore, startOfDay, setHours, setMinutes, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import rogersProfile from '@/assets/rogers-profile.jpg';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface BookingContext {
  booking_link_id: string;
  client_id: string;
  client_name: string;
  admin_user_id: string;
  usage_count: number;
}

interface SchedulingSettings {
  id: string;
  user_id: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  working_days: number[];
}

export default function PublicBookingConsult() {
  const { token } = useParams<{ token: string }>();
  
  // Email verification state
  const [emailInput, setEmailInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  
  // Booking context after verification
  const [bookingContext, setBookingContext] = useState<BookingContext | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [settings, setSettings] = useState<SchedulingSettings | null>(null);
  
  // Availability rules
  const adminUserId = bookingContext?.admin_user_id;
  const { data: availabilityRules = [], isLoading: rulesLoading } = useAvailabilityRulesByAdmin(adminUserId);
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{ date: string; time: string; meetLink?: string } | null>(null);

  // Fetch scheduling settings when we have admin user id
  useEffect(() => {
    const fetchSettings = async () => {
      if (!adminUserId) return;
      
      const { data } = await supabase
        .from('scheduling_settings')
        .select('id, user_id, slot_duration_minutes, buffer_minutes, working_days')
        .eq('user_id', adminUserId)
        .maybeSingle();
      
      if (data) {
        setSettings({
          ...data,
          working_days: Array.isArray(data.working_days) ? data.working_days : JSON.parse(data.working_days as string),
          buffer_minutes: data.buffer_minutes || 0,
        });
      }
    };
    
    fetchSettings();
  }, [adminUserId]);

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

  // Handle email verification
  const handleEmailVerification = async () => {
    if (!emailInput.trim()) {
      toast.error('Digite seu e-mail');
      return;
    }
    
    setIsVerifying(true);
    setVerificationError(null);
    
    try {
      // 1. Validate booking link via RPC
      const { data: contextData, error: contextError } = await supabase
        .rpc('get_public_booking_context', { p_token: token });
      
      if (contextError || !contextData || contextData.length === 0) {
        setVerificationError('Link inválido ou expirado.');
        setIsVerifying(false);
        return;
      }
      
      const ctx = contextData[0] as BookingContext;
      
      // 2. Validate that client email matches
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, email, name, eligible_for_booking, is_active')
        .eq('id', ctx.client_id)
        .maybeSingle();
      
      if (clientError || !clientData) {
        setVerificationError('Erro ao verificar acesso. Tente novamente.');
        setIsVerifying(false);
        return;
      }
      
      // Check if email matches
      if (clientData.email?.toLowerCase() !== emailInput.toLowerCase().trim()) {
        setVerificationError('E-mail não autorizado. Verifique se digitou corretamente.');
        setIsVerifying(false);
        return;
      }
      
      // Check if client is eligible
      if (!clientData.eligible_for_booking && !clientData.is_active) {
        setVerificationError('Acesso não autorizado. Entre em contato com o suporte.');
        setIsVerifying(false);
        return;
      }
      
      // Success - set context
      setBookingContext(ctx);
      setClientEmail(clientData.email);
      setIsVerified(true);
      
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationError('Erro ao verificar acesso. Tente novamente.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Calculate available dates based on availability rules
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    
    for (let i = 1; i <= 60; i++) {
      const date = addDays(today, i);
      const dayOfWeek = date.getDay();
      
      const hasRule = availabilityRules.some(rule => rule.day_of_week === dayOfWeek);
      if (hasRule) {
        dates.push(date);
      }
    }
    
    return dates;
  }, [availabilityRules]);

  // Calculate available time slots for selected date (with buffer support)
  const availableSlots = useMemo(() => {
    if (!selectedDate || !settings) return [];
    
    const dayOfWeek = selectedDate.getDay();
    const rulesForDay = availabilityRules.filter(r => r.day_of_week === dayOfWeek);
    
    const slots: TimeSlot[] = [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Calculate slot step (duration + buffer)
    const slotStep = settings.slot_duration_minutes + settings.buffer_minutes;
    
    rulesForDay.forEach(rule => {
      const [startHour, startMin] = rule.start_time.split(':').map(Number);
      const [endHour, endMin] = rule.end_time.split(':').map(Number);
      const slotMinutes = rule.slot_minutes || slotStep;
      
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
        
        // Check if slot is in the past (for today)
        const slotDateTime = parse(timeStr, 'HH:mm', selectedDate);
        const isPast = isSameDay(selectedDate, new Date()) && isBefore(slotDateTime, new Date());
        
        slots.push({
          time: timeStr,
          available: !isBooked && !isPast,
        });
        
        // Use slot step (duration + buffer) for next slot
        current = new Date(current.getTime() + slotStep * 60000);
      }
    });
    
    return slots.sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, availabilityRules, existingAppointments, settings]);

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !bookingContext || !settings) return;
    
    setIsSubmitting(true);
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Create appointment via secure RPC
      const { data: appointmentData, error: appointmentError } = await supabase
        .rpc('create_public_booking_appointment', {
          p_token: token,
          p_date: dateStr,
          p_time: selectedTime,
        });

      if (appointmentError) throw appointmentError;
      
      const appointment = { id: appointmentData?.[0]?.appointment_id || appointmentData };

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
            clientId: bookingContext.client_id,
            message,
          },
        });
      } catch (whatsappError) {
        console.error('WhatsApp send failed:', whatsappError);
      }

      // Log the confirmation
      await supabase.from('consult_invite_logs').insert({
        client_id: bookingContext.client_id,
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

  // Not verified yet - show email gate
  if (!isVerified) {
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

        <main className="max-w-md mx-auto px-4 py-12">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-[hsl(43,74%,49%)]/10 flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-[hsl(43,74%,49%)]" />
              </div>
              <CardTitle className="text-white text-xl">Confirme seu acesso</CardTitle>
              <CardDescription className="text-gray-400">
                Digite seu e-mail para verificar seu acesso ao agendamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailVerification()}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  disabled={isVerifying}
                />
              </div>
              
              {verificationError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{verificationError}</p>
                </div>
              )}
              
              <Button
                onClick={handleEmailVerification}
                disabled={isVerifying || !emailInput.trim()}
                className="w-full bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Loading availability rules
  if (rulesLoading || !settings) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(43,74%,49%)]" />
      </div>
    );
  }

  // Confirmed - show success
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

  // Booking form
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

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Agendar Consulta</h2>
          <p className="text-gray-400">
            Olá, <span className="text-[hsl(43,74%,49%)]">{bookingContext?.client_name}</span>! Escolha o melhor horário para sua consulta.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
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