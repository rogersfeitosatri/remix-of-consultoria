import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Calendar as CalendarIcon, Clock, CheckCircle2, Video, AlertCircle, Mail, RefreshCw, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  min_advance_value: number;
  min_advance_unit: 'hours' | 'days';
  max_advance_days: number;
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
  const [schedulingBlocks, setSchedulingBlocks] = useState<Array<{ block_date: string; block_type: string; start_time: string | null; end_time: string | null }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{ date: string; time: string; meetLink?: string; rescheduled?: boolean; cancelled?: boolean } | null>(null);

  // Existing appointments
  const [upcomingAppointments, setUpcomingAppointments] = useState<Array<{
    appointment_id: string;
    appointment_date: string;
    appointment_time: string;
    duration_minutes: number;
    status: string;
    google_meet_link: string | null;
    hours_until: number;
  }>>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [mode, setMode] = useState<'list' | 'book' | 'reschedule'>('list');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Load upcoming appointments after verification
  const fetchUpcoming = async () => {
    if (!token) return;
    setLoadingUpcoming(true);
    try {
      const { data, error } = await supabase.rpc('get_public_client_upcoming_appointments', { p_token: token });
      if (error) throw error;
      setUpcomingAppointments((data as any) || []);
    } catch (e) {
      console.error('upcoming fetch error', e);
    } finally {
      setLoadingUpcoming(false);
    }
  };

  useEffect(() => {
    if (isVerified) {
      fetchUpcoming();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified]);

  // Fetch scheduling settings when we have admin user id
  useEffect(() => {
    const fetchSettings = async () => {
      if (!adminUserId) return;
      
      const { data: rows } = await supabase
        .rpc('get_public_scheduling_settings_by_user', { p_user_id: adminUserId });
      const data = Array.isArray(rows) ? rows[0] : rows;
      
      if (data) {
        setSettings({
          ...data,
          working_days: Array.isArray(data.working_days) ? data.working_days : JSON.parse(data.working_days as string),
          buffer_minutes: data.buffer_minutes || 0,
          min_advance_value: (data as any).min_advance_value ?? 24,
          min_advance_unit: ((data as any).min_advance_unit ?? 'hours') as 'hours' | 'days',
          max_advance_days: (data as any).max_advance_days ?? 60,
        });
      }
    };
    
    fetchSettings();
  }, [adminUserId]);

  // Fetch existing appointments via secure RPC (minimal columns only)
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!adminUserId) return;

      const { data } = await supabase.rpc('get_public_appointment_slots', {
        p_user_id: adminUserId,
        p_from_date: format(new Date(), 'yyyy-MM-dd'),
      });

      setExistingAppointments((data as any) || []);
    };

    fetchAppointments();
  }, [adminUserId]);

  // Fetch scheduling blocks via secure RPC (no internal metadata exposed)
  useEffect(() => {
    const fetchBlocks = async () => {
      if (!adminUserId) return;
      const { data } = await supabase.rpc('get_public_scheduling_blocks', {
        p_user_id: adminUserId,
        p_from_date: format(new Date(), 'yyyy-MM-dd'),
      });
      setSchedulingBlocks((data as any) || []);
    };
    fetchBlocks();
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
      // Use new v2 function that returns all needed data (bypasses RLS completely)
      const { data, error } = await supabase
        .rpc('validate_booking_email_v2', { 
          p_token: token,
          p_email: emailInput.trim()
        });
      
      if (error) {
        console.error('Validation RPC error:', error);
        setVerificationError('Erro ao verificar acesso. Tente novamente.');
        setIsVerifying(false);
        return;
      }
      
      const result = data?.[0];
      
      if (!result || !result.valid) {
        setVerificationError(result?.error_message || 'Acesso não autorizado.');
        setIsVerifying(false);
        return;
      }

      // Anamnese check removed - athletes can book without completing anamnese
      // The anamnese can be filled later before the actual consultation
      
      // Success - set context
      setBookingContext({
        booking_link_id: '',
        client_id: result.client_id,
        client_name: result.client_name,
        admin_user_id: result.admin_user_id,
        usage_count: 0,
      });
      setClientEmail(emailInput.trim());
      setIsVerified(true);
      
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationError('Erro ao verificar acesso. Tente novamente.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Compute the earliest moment a booking is allowed (min advance)
  const minBookingMoment = useMemo(() => {
    if (!settings) return new Date();
    const now = new Date();
    // Always compute as a rolling window from "now" (X hours, or X*24 hours if unit is days)
    const hours = settings.min_advance_unit === 'days'
      ? settings.min_advance_value * 24
      : settings.min_advance_value;
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }, [settings]);

  // Calculate available dates based on availability rules and booking window
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    const maxDays = settings?.max_advance_days ?? 60;
    const minDay = startOfDay(minBookingMoment);

    const fullDayBlocked = new Set(
      schedulingBlocks.filter(b => b.block_type === 'full_day').map(b => b.block_date)
    );

    for (let i = 1; i <= maxDays; i++) {
      const date = addDays(today, i);
      // Skip dates before min advance window
      if (isBefore(date, minDay)) continue;
      const dayOfWeek = date.getDay();

      const dateStr = format(date, 'yyyy-MM-dd');
      if (fullDayBlocked.has(dateStr)) continue;

      const hasRule = availabilityRules.some(rule => rule.day_of_week === dayOfWeek);
      if (hasRule) {
        dates.push(date);
      }
    }

    return dates;
  }, [availabilityRules, settings, minBookingMoment, schedulingBlocks]);

  // Calculate available time slots for selected date (with buffer support)
  const availableSlots = useMemo(() => {
    if (!selectedDate || !settings) return [];
    
    const dayOfWeek = selectedDate.getDay();
    const rulesForDay = availabilityRules.filter(r => r.day_of_week === dayOfWeek);
    
    const slots: TimeSlot[] = [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Hard stop: full-day block
    const isFullDayBlocked = schedulingBlocks.some(
      b => b.block_date === dateStr && b.block_type === 'full_day'
    );
    if (isFullDayBlocked) return [];

    // Time-range blocks for this date
    const timeRangeBlocks = schedulingBlocks.filter(
      b => b.block_date === dateStr && b.block_type === 'time_range' && b.start_time && b.end_time
    );

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
        
        // Check if slot is in the past (for today) OR before min advance window
        const slotDateTime = parse(timeStr, 'HH:mm', selectedDate);
        const isPast = isSameDay(selectedDate, new Date()) && isBefore(slotDateTime, new Date());
        const isBeforeMinAdvance = isBefore(slotDateTime, minBookingMoment);

        // Check time-range blocks
        const isInBlockedRange = timeRangeBlocks.some(b => {
          const bs = (b.start_time || '').substring(0, 5);
          const be = (b.end_time || '').substring(0, 5);
          return timeStr >= bs && timeStr < be;
        });

        slots.push({
          time: timeStr,
          available: !isBooked && !isPast && !isBeforeMinAdvance && !isInBlockedRange,
        });
        
        // Use slot step (duration + buffer) for next slot
        current = new Date(current.getTime() + slotStep * 60000);
      }
    });
    
    // Only return slots that are actually available (hide past / before-min-advance / booked)
    return slots
      .filter(s => s.available)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, availabilityRules, existingAppointments, settings, minBookingMoment, schedulingBlocks]);

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime || !bookingContext || !settings) return;

    setIsSubmitting(true);
    const isReschedule = mode === 'reschedule' && reschedulingId;

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      let appointmentId: string;

      if (isReschedule) {
        const { data, error } = await supabase.rpc('reschedule_public_booking_appointment', {
          p_token: token,
          p_appointment_id: reschedulingId,
          p_date: dateStr,
          p_time: selectedTime,
        });
        if (error) throw error;
        appointmentId = (data as any)?.[0]?.appointment_id || reschedulingId;
      } else {
        const { data, error } = await supabase.rpc('create_public_booking_appointment', {
          p_token: token,
          p_date: dateStr,
          p_time: selectedTime,
        });
        if (error) throw error;
        appointmentId = (data as any)?.[0]?.appointment_id || (data as any);
      }

      // Try to create Google Calendar event
      let meetLink = null;
      try {
        const { data: calendarData } = await supabase.functions.invoke('create-calendar-event', {
          body: { appointmentId },
        });
        meetLink = calendarData?.google_meet_link;
      } catch (calendarError) {
        console.error('Calendar event creation failed:', calendarError);
      }

      // Send WhatsApp confirmation
      try {
        const formattedDate = format(selectedDate, "dd 'de' MMMM", { locale: ptBR });
        const header = isReschedule ? '🔄 Consulta remarcada!' : '✅ Consulta confirmada!';
        let message = `${header}\n\n📅 Data: ${formattedDate}\n⏰ Horário: ${selectedTime}`;
        if (meetLink) {
          message += `\n\n🎥 Link da videochamada:\n${meetLink}`;
        }
        message += '\n\nAté lá!';

        await supabase.functions.invoke('send-whatsapp', {
          body: { clientId: bookingContext.client_id, message },
        });
      } catch (whatsappError) {
        console.error('WhatsApp send failed:', whatsappError);
      }

      await supabase.from('consult_invite_logs').insert({
        client_id: bookingContext.client_id,
        channel: 'system',
        status: 'confirmed',
        message_type: isReschedule ? 'booking_rescheduled' : 'booking_confirmation',
      });

      setConfirmationData({
        date: format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR }),
        time: selectedTime,
        meetLink,
        rescheduled: !!isReschedule,
      });
      setIsConfirmed(true);
      toast.success(isReschedule ? 'Consulta remarcada com sucesso!' : 'Consulta agendada com sucesso!');

    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.message || 'Erro ao agendar consulta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAsCompleted = async () => {
    if (!cancellingId) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase.rpc('cancel_public_booking_as_completed', {
        p_token: token,
        p_appointment_id: cancellingId,
      });
      if (error) throw error;
      toast.success('Consulta marcada como realizada.');
      setConfirmationData({ date: '', time: '', cancelled: true });
      setIsConfirmed(true);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar.');
    } finally {
      setIsCancelling(false);
      setCancellingId(null);
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
                className="w-full bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground font-bold"
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
          
          <h2 className="text-2xl font-bold text-white mb-2">
            {confirmationData.cancelled ? 'Consulta finalizada' : confirmationData.rescheduled ? 'Consulta Remarcada!' : 'Consulta Agendada!'}
          </h2>
          <p className="text-gray-400 mb-8">
            {confirmationData.cancelled
              ? 'Sua consulta foi marcada como realizada.'
              : confirmationData.rescheduled
                ? 'Sua consulta foi remarcada com sucesso.'
                : 'Sua consulta foi confirmada com sucesso.'}
          </p>

          {!confirmationData.cancelled && (
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
          )}

          <p className="text-sm text-gray-500 mb-6">
            {confirmationData.cancelled
              ? 'Você pode entrar em contato com a equipe para reagendar quando puder.'
              : 'Você receberá uma confirmação por WhatsApp com todos os detalhes.'}
          </p>

          <Button
            onClick={() => window.location.href = '/atleta'}
            className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground font-bold"
          >
            Voltar à largada
          </Button>
        </main>
      </div>
    );
  }

  // Show upcoming appointments list (mode list, has appointments)
  if (mode === 'list' && (loadingUpcoming || upcomingAppointments.length > 0)) {
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

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Sua consulta agendada</h2>
            <p className="text-gray-400">
              Olá, <span className="text-[hsl(43,74%,49%)]">{bookingContext?.client_name}</span>! Veja sua consulta abaixo.
            </p>
          </div>

          {loadingUpcoming ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[hsl(43,74%,49%)]" />
            </div>
          ) : (
            upcomingAppointments.map((appt) => {
              const apptDate = parse(appt.appointment_date, 'yyyy-MM-dd', new Date());
              const apptTime = appt.appointment_time.substring(0, 5);
              const canReschedule = appt.hours_until > 6;
              return (
                <Card key={appt.appointment_id} className="bg-gray-900 border-[hsl(43,74%,49%)]/30 border-2">
                  <CardContent className="py-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                      <span className="text-white text-lg capitalize">
                        {format(apptDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                      <span className="text-white text-lg">{apptTime} ({appt.duration_minutes} min)</span>
                    </div>
                    {appt.google_meet_link && (
                      <div className="pt-3 border-t border-gray-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Video className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-gray-400">Link da videochamada</span>
                        </div>
                        <a
                          href={appt.google_meet_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                          Abrir Google Meet
                        </a>
                      </div>
                    )}

                    {!canReschedule && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-200">
                          Faltam menos de 6 horas para a consulta. Não é possível remarcar.
                          Caso não possa comparecer, marque a consulta como realizada — ela será contabilizada normalmente.
                        </p>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => {
                          setReschedulingId(appt.appointment_id);
                          setMode('reschedule');
                          setSelectedDate(undefined);
                          setSelectedTime(null);
                        }}
                        disabled={!canReschedule}
                        className="flex-1 bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground font-bold"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Remarcar consulta
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setCancellingId(appt.appointment_id)}
                        className="flex-1 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Não poderei comparecer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          <div className="text-center pt-2">
            <Button
              variant="ghost"
              onClick={() => { setMode('book'); setReschedulingId(null); }}
              className="text-gray-400 hover:text-white"
            >
              Agendar uma nova consulta adicional
            </Button>
          </div>
        </main>

        <AlertDialog open={!!cancellingId} onOpenChange={(open) => !open && setCancellingId(null)}>
          <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Não poderá comparecer?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Ao confirmar, a consulta será marcada como <strong className="text-white">realizada</strong> e contabilizada
                no seu plano. Esta ação não pode ser desfeita pelo link público.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
                Voltar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelAsCompleted}
                disabled={isCancelling}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
          <h2 className="text-2xl font-bold text-white mb-1">
            {mode === 'reschedule' ? 'Remarcar Consulta' : 'Agendar Consulta'}
          </h2>
          <p className="text-gray-400">
            Olá, <span className="text-[hsl(43,74%,49%)]">{bookingContext?.client_name}</span>!{' '}
            {mode === 'reschedule'
              ? 'Escolha a nova data e horário para sua consulta.'
              : 'Escolha o melhor horário para sua consulta.'}
          </p>
          {(mode === 'reschedule' || upcomingAppointments.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setMode('list'); setReschedulingId(null); setSelectedDate(undefined); setSelectedTime(null); }}
              className="mt-2 text-gray-400 hover:text-white px-0"
            >
              ← Voltar
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-[hsl(43,74%,49%)]" />
                Escolha a Data
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-4">
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
                className="rounded-md border border-gray-800 bg-gray-950/50 p-3 w-full"
                classNames={{
                  months: 'flex flex-col w-full',
                  month: 'space-y-3 w-full',
                  caption: 'flex justify-center pt-1 relative items-center',
                  caption_label: 'text-base font-semibold text-white capitalize',
                  nav_button: 'h-8 w-8 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-md inline-flex items-center justify-center',
                  table: 'w-full border-collapse',
                  head_row: 'flex w-full',
                  head_cell: 'text-gray-300 font-semibold uppercase text-[11px] tracking-wider flex-1 text-center py-2',
                  row: 'flex w-full mt-1',
                  cell: 'flex-1 aspect-square p-0.5 text-center',
                  day: 'h-full w-full rounded-md text-base font-medium text-white hover:bg-gray-800 transition-colors inline-flex items-center justify-center',
                  day_selected: 'bg-[hsl(43,74%,49%)] text-black hover:bg-[hsl(43,74%,49%)] font-bold ring-2 ring-[hsl(43,74%,60%)]',
                  day_today: 'border border-[hsl(43,74%,49%)] text-[hsl(43,74%,60%)] font-bold',
                  day_disabled: 'text-gray-700 opacity-40 hover:bg-transparent cursor-not-allowed',
                  day_outside: 'text-gray-700 opacity-30',
                }}
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
                          ? 'bg-[hsl(43,74%,49%)] text-primary-foreground hover:bg-[hsl(43,74%,40%)]'
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
                    className="bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-primary-foreground font-bold px-8"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {mode === 'reschedule' ? 'Remarcando...' : 'Agendando...'}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {mode === 'reschedule' ? 'Confirmar Remarcação' : 'Confirmar Agendamento'}
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