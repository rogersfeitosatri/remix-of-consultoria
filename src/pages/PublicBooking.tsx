import { useState, useMemo } from 'react';
import logoRF from '@/assets/logo-rf.jpg';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PersonStanding, CalendarDays, Clock, CheckCircle2, Loader2, AlertCircle, Info, User, Mail, Phone } from 'lucide-react';
import { useSchedulingSettingsBySlug, useCreateAppointment } from '@/hooks/useScheduling';
import { useAvailabilityRulesByAdmin } from '@/hooks/useConsultations';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes, isBefore, isSameDay, getDay, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  // Athlete consult-schedule flow (legacy)
  const token = searchParams.get('token');
  // Unified athlete booking flow: ?bt={booking_links.token}
  const bookingToken = searchParams.get('bt');

  const { data: settings, isLoading: settingsLoading } = useSchedulingSettingsBySlug(slug);
  const { data: blocks = [] } = useQuery({
    queryKey: ['public_scheduling_blocks', settings?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_scheduling_blocks', {
        p_user_id: settings!.user_id,
        p_from_date: format(new Date(), 'yyyy-MM-dd'),
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!settings?.user_id,
    staleTime: 1000 * 60 * 3,
  });
  // Availability rules (same source as the WhatsApp booking flow). Falls back
  // to scheduling_time_blocks internally when availability_rules is empty.
  const { data: availabilityRules = [], isLoading: rulesLoading, isFetching: rulesFetching } = useAvailabilityRulesByAdmin(settings?.user_id);

  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Public lead form state (used when no token / bt)
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');

  const createAppointment = useCreateAppointment();

  // Fetch consultation schedule by token (legacy /agendar/:slug?token=...)
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

  // Get appointments for selected date via secure public RPC (minimal columns)
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const { data: existingAppointments = [] } = useQuery({
    queryKey: ['public_appointments_by_date', settings?.user_id, selectedDateStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_appointment_slots', {
        p_user_id: settings!.user_id,
        p_from_date: selectedDateStr,
        p_to_date: selectedDateStr,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!settings?.user_id && !!selectedDateStr,
    staleTime: 1000 * 60 * 2,
  });

  // Buffer minutes from settings
  const bufferMinutes = (settings as any)?.buffer_minutes || 0;

  // Booking window (admin-configurable visibility for athletes/leads)
  const minAdvanceValue = (settings as any)?.min_advance_value ?? 0;
  const minAdvanceUnit = ((settings as any)?.min_advance_unit ?? 'hours') as 'hours' | 'days';
  const maxAdvanceDays = (settings as any)?.max_advance_days ?? null;

  const minBookableDateTime = useMemo(() => {
    const now = new Date();
    if (!minAdvanceValue || minAdvanceValue <= 0) return now;
    if (minAdvanceUnit === 'days') {
      return startOfDay(addDays(now, minAdvanceValue));
    }
    return addMinutes(now, minAdvanceValue * 60);
  }, [minAdvanceValue, minAdvanceUnit]);

  const maxBookableDate = useMemo(() => {
    if (!maxAdvanceDays || maxAdvanceDays <= 0) return null;
    return startOfDay(addDays(new Date(), maxAdvanceDays));
  }, [maxAdvanceDays]);

  // Days where the admin has availability rules configured (source of truth)
  const configuredDays = useMemo(() => {
    if (!availabilityRules || availabilityRules.length === 0) {
      return settings?.working_days || [];
    }
    return [...new Set(availabilityRules.map((r: any) => r.day_of_week))];
  }, [availabilityRules, settings?.working_days]);

  const hasConfiguredAvailability = availabilityRules && availabilityRules.length > 0;

  // Generate available time slots from availability_rules (same source as
  // the WhatsApp athlete flow). This guarantees a single source of truth.
  const availableSlots = useMemo(() => {
    if (!settings || !selectedDate) return [];

    const slots: string[] = [];
    const dayOfWeek = getDay(selectedDate);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Full-day block guard
    const fullDayBlock = blocks.find(
      b => b.block_date === dateStr && b.block_type === 'full_day'
    );
    if (fullDayBlock) return [];

    const rulesForDay = availabilityRules.filter((r: any) => r.day_of_week === dayOfWeek);
    if (rulesForDay.length === 0) return [];

    // Slot step = duration + buffer
    const slotStep = settings.slot_duration_minutes + bufferMinutes;

    rulesForDay.forEach((rule: any) => {
      const [startHour, startMin] = String(rule.start_time).substring(0, 5).split(':').map(Number);
      const [endHour, endMin] = String(rule.end_time).substring(0, 5).split(':').map(Number);

      let currentTime = new Date(selectedDate);
      currentTime.setHours(startHour, startMin, 0, 0);

      const endTime = new Date(selectedDate);
      endTime.setHours(endHour, endMin, 0, 0);

      while (isBefore(currentTime, endTime)) {
        const timeStr = format(currentTime, 'HH:mm');

        // Time-range block guard
        const isBlocked = blocks.some(b => {
          if (b.block_date !== dateStr || b.block_type !== 'time_range') return false;
          const blockStart = b.start_time?.substring(0, 5);
          const blockEnd = b.end_time?.substring(0, 5);
          return timeStr >= blockStart! && timeStr < blockEnd!;
        });

        // Conflict with existing appointment (considering duration + buffer)
        const isBooked = existingAppointments.some(a => {
          if (!a.appointment_time) return false;
          if (a.appointment_date && a.appointment_date !== dateStr) return false;
          const aptTime = a.appointment_time.substring(0, 5);
          const [aptHour, aptMin] = aptTime.split(':').map(Number);

          const aptStart = new Date(selectedDate);
          aptStart.setHours(aptHour, aptMin, 0, 0);

          const aptDuration = a.duration_minutes || settings.slot_duration_minutes;
          const blockStart = addMinutes(aptStart, -bufferMinutes);
          const blockEnd = addMinutes(aptStart, aptDuration + bufferMinutes);

          const slotStart = new Date(selectedDate);
          slotStart.setHours(parseInt(timeStr.split(':')[0]), parseInt(timeStr.split(':')[1]), 0, 0);
          const slotEnd = addMinutes(slotStart, settings.slot_duration_minutes);

          return slotStart < blockEnd && slotEnd > blockStart;
        });

        // Past or before min-advance window
        const isPast = isSameDay(selectedDate, new Date()) && isBefore(currentTime, new Date());
        const isBeforeMinAdvance = isBefore(currentTime, minBookableDateTime);

        if (!isBlocked && !isBooked && !isPast && !isBeforeMinAdvance) {
          slots.push(timeStr);
        }

        currentTime = addMinutes(currentTime, slotStep);
      }
    });

    return [...new Set(slots)].sort();
  }, [settings, selectedDate, blocks, existingAppointments, availabilityRules, bufferMinutes, minBookableDateTime]);

  

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

      // Try to create Google Calendar event with Meet (best-effort)
      let meetLink: string | null = null;
      try {
        const { data: calendarResult, error: calendarError } = await supabase.functions.invoke('create-calendar-event', {
          body: { appointmentId: result.id }
        });
        if (calendarError) console.error('Error creating calendar event:', calendarError);
        meetLink = calendarResult?.google_meet_link || null;
      } catch (calendarErr) {
        console.error('Calendar creation error:', calendarErr);
      }

      // ALWAYS send confirmation WhatsApp — with or without Meet link.
      // Ausência do Meet não pode bloquear a confirmação do agendamento (bug histórico).
      try {
        const clientPhone = consultationSchedule.clients.phone;
        if (clientPhone) {
          const formattedDate = format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
          const linkBlock = meetLink
            ? `\n\n🔗 *Link da reunião:*\n${meetLink}`
            : `\n\n_O link da reunião será enviado assim que gerado._`;
          const message = `✅ *Consulta Confirmada!*\n\n📅 ${formattedDate}\n⏰ ${selectedTime}${linkBlock}\n\nAté breve!`;
          await supabase.functions.invoke('send-whatsapp', {
            body: { clientId: consultationSchedule.clients.id, message },
          });
        }
      } catch (waErr) {
        console.error('WhatsApp confirmation send error:', waErr);
      }

      setConfirmed(true);
      toast.success('Consulta agendada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao agendar');
    } finally {
      setBooking(false);
    }
  };

  // Unified athlete-token flow (?bt={booking_links.token})
  // Uses the SAME RPC as the legacy /booking/{token} page so behavior matches.
  const handleBookingTokenBooking = async () => {
    if (!selectedDate || !selectedTime || !bookingToken) {
      toast.error('Selecione data e horário');
      return;
    }

    setBooking(true);
    try {
      const { data, error } = await supabase.rpc('create_public_booking_appointment', {
        p_token: bookingToken,
        p_date: format(selectedDate, 'yyyy-MM-dd'),
        p_time: selectedTime + ':00',
      });
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const appointmentId = result?.appointment_id || result;

      if (appointmentId) {
        try {
          await supabase.functions.invoke('create-calendar-event', {
            body: { appointmentId },
          });
        } catch (calErr) {
          console.error('Calendar creation error:', calErr);
        }
      }

      setConfirmed(true);
      toast.success('Consulta agendada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao agendar');
    } finally {
      setBooking(false);
    }
  };

  const handlePublicLeadBooking = async () => {
    if (!selectedDate || !selectedTime || !slug) {
      toast.error('Selecione data e horário');
      return;
    }
    if (!leadName.trim() || leadName.trim().length < 2) {
      toast.error('Informe seu nome completo');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(leadEmail.trim())) {
      toast.error('Informe um e-mail válido');
      return;
    }

    setBooking(true);
    try {
      const { data, error } = await supabase.rpc('create_public_lead_appointment', {
        p_slug: slug,
        p_date: format(selectedDate, 'yyyy-MM-dd'),
        p_time: selectedTime + ':00',
        p_name: leadName.trim(),
        p_email: leadEmail.trim(),
        p_phone: leadPhone.trim() || null,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const appointmentId = result?.appointment_id;

      // Best-effort Google Meet creation (non-blocking)
      if (appointmentId) {
        try {
          await supabase.functions.invoke('create-calendar-event', {
            body: { appointmentId },
          });
        } catch (calErr) {
          console.error('Calendar creation error:', calErr);
        }
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

    // Enforce min advance window (days unit hides earlier dates entirely;
    // hours unit handled at slot level, but if same-day fully past min, hide it too)
    const dayStart = startOfDay(date);
    if (minAdvanceUnit === 'days' && minAdvanceValue > 0) {
      if (isBefore(dayStart, startOfDay(minBookableDateTime))) return true;
    }

    // Enforce max advance window
    if (maxBookableDate && isBefore(maxBookableDate, dayStart)) return true;

    return false;
  };

  // Debug info for admin (only shown if debug param present)
  const [searchParamsDebug] = useSearchParams();
  const showDebug = searchParamsDebug.get('debug') === 'true';
  
  const debugInfo = useMemo(() => {
    if (!showDebug || !settings) return null;
    
    const daysLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const configuredDaysLabels = configuredDays.map(d => daysLabels[d]).join(', ');
    
    const blocksByDay: Record<number, string[]> = {};
    availabilityRules.forEach((r: any) => {
      if (!blocksByDay[r.day_of_week]) blocksByDay[r.day_of_week] = [];
      blocksByDay[r.day_of_week].push(
        `${String(r.start_time).substring(0, 5)}-${String(r.end_time).substring(0, 5)}`
      );
    });

    return {
      configuredDays: configuredDaysLabels,
      timeBlocksByDay: blocksByDay,
      slotDuration: settings.slot_duration_minutes,
      buffer: bufferMinutes,
      timezone: 'America/Sao_Paulo',
      hasTimeBlocks: availabilityRules.length > 0,
      blocksCount: blocks.length,
    };
  }, [showDebug, settings, configuredDays, availabilityRules, bufferMinutes, blocks]);

  if (settingsLoading || (settings?.user_id && (rulesLoading || rulesFetching))) {
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

  // Only block when the legacy ?token= was provided but didn't resolve.
  // (The new ?bt= path does its validation server-side via the RPC.)
  if (token && !consultationSchedule) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <PersonStanding className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Link inválido ou expirado</h1>
        <p className="text-muted-foreground text-center">
          Este link de agendamento expirou. Entre em contato para receber um novo.
        </p>
      </div>
    );
  }

  // Three modes:
  // - token       → legacy consultation_schedule flow
  // - bookingToken → unified athlete-token flow (?bt=)
  // - neither     → public lead flow
  const isAthleteTokenFlow = !!bookingToken;
  const isLegacyTokenFlow = !!token && !!consultationSchedule;
  const isPublicLeadFlow = !isAthleteTokenFlow && !isLegacyTokenFlow;

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
            <h1 className="text-xl font-bold text-foreground">Rogers Feitosa</h1>
            <p className="text-sm text-muted-foreground">Nutrição & Treinamento</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {isLegacyTokenFlow ? `Olá, ${consultationSchedule!.clients.name}!` : 'Agende sua consulta'}
            </CardTitle>
            <CardDescription>
              {isPublicLeadFlow
                ? 'Escolha o melhor dia e horário e preencha seus dados para confirmar.'
                : 'Escolha o melhor dia e horário para sua consulta.'}
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

        {/* Lead form (public flow only) + Confirm Button */}
        {selectedDate && selectedTime && (
          <Card className="mt-6">
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Agendamento selecionado:</p>
                <p className="font-semibold">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
                </p>
              </div>

              {isPublicLeadFlow && (
                <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
                  <div className="sm:col-span-2">
                    <Label htmlFor="lead-name" className="flex items-center gap-1.5 text-sm">
                      <User className="h-3.5 w-3.5" /> Nome completo *
                    </Label>
                    <Input
                      id="lead-name"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Seu nome"
                      autoComplete="name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead-email" className="flex items-center gap-1.5 text-sm">
                      <Mail className="h-3.5 w-3.5" /> E-mail *
                    </Label>
                    <Input
                      id="lead-email"
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="voce@email.com"
                      autoComplete="email"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lead-phone" className="flex items-center gap-1.5 text-sm">
                      <Phone className="h-3.5 w-3.5" /> WhatsApp (opcional)
                    </Label>
                    <Input
                      id="lead-phone"
                      type="tel"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="+55 99 99999-9999"
                      autoComplete="tel"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={
                    isAthleteTokenFlow
                      ? handleBookingTokenBooking
                      : isPublicLeadFlow
                        ? handlePublicLeadBooking
                        : handleConfirmBooking
                  }
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
