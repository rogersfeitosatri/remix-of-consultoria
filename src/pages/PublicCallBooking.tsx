import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { useCallSchedulingLinkBySlug, useCallAvailableSlots, useCreateCallBooking } from '@/hooks/useCallScheduling';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, isBefore, isAfter, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Phase = 'landing' | 'calendar' | 'contact' | 'done';

export default function PublicCallBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { data: link, isLoading } = useCallSchedulingLinkBySlug(slug);

  const [phase, setPhase] = useState<Phase>('landing');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 });
  });

  const { data: slots = [], isLoading: slotsLoading } = useCallAvailableSlots(link?.id, selectedDate || undefined);
  const createBooking = useCreateCallBooking();

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const maxDate = useMemo(() => {
    if (!link) return addMonths(new Date(), 2);
    return addDays(new Date(), link.max_advance_days);
  }, [link]);

  const availableSlots = useMemo(() => {
    return slots.filter((s: any) => s.available);
  }, [slots]);

  const handleSelectDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setSelectedTime('');
  };

  const handleBook = async () => {
    if (!link || !selectedDate || !selectedTime || !name.trim()) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    try {
      const bookingId = await createBooking.mutateAsync({
        scheduling_link_id: link.id,
        booking_date: selectedDate,
        booking_time: selectedTime,
        lead_name: name,
        lead_email: email || undefined,
        lead_phone: phone || undefined,
      });
      // Fire-and-forget confirmation WhatsApp
      if (phone && bookingId) {
        supabase.functions.invoke('send-call-booking-reminders', {
          body: { mode: 'confirmation', bookingId },
        }).catch(() => {});
      }
      setPhase('done');
    } catch {
      // error is handled by the hook
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!link) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-lg">Página não encontrada ou inativa.</p></div>;
  }

  // DONE
  if (phase === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Agendamento confirmado!</h2>
          <p className="text-muted-foreground">
            Sua call foi agendada para <strong>{selectedDate}</strong> às <strong>{selectedTime?.slice(0, 5)}</strong>.
            {link.meeting_link && <> O link da videochamada será enviado em breve.</>}
          </p>
        </div>
      </div>
    );
  }

  // CONTACT INFO
  if (phase === 'contact') {
    const progress = 75;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="w-full max-w-xl mx-auto px-4 pt-6">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">3 / 3</p>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-xl space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Seus dados</h2>
            <p className="text-sm text-muted-foreground">
              Agendando para {selectedDate} às {selectedTime?.slice(0, 5)}
            </p>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setPhase('calendar')}>Voltar</Button>
              <Button onClick={handleBook} disabled={createBooking.isPending || !name.trim()} className="flex-1">
                {createBooking.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Agendamento'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CALENDAR
  if (phase === 'calendar') {
    const progress = 50;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="w-full max-w-2xl mx-auto px-4 pt-6">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">2 / 3</p>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl space-y-6">
            <h2 className="text-xl font-semibold text-foreground">Escolha data e horário</h2>
            <p className="text-sm text-muted-foreground">Timezone: {link.timezone}</p>

            {/* Week navigation */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(prev => addDays(prev, -7))} disabled={isBefore(addDays(weekStart, -1), new Date())}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-sm font-medium">
                {format(weekDays[0], "dd MMM", { locale: ptBR })} — {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setWeekStart(prev => addDays(prev, 7))} disabled={isAfter(addDays(weekStart, 7), maxDate)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Day buttons */}
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isPast = isBefore(day, new Date()) && dateStr !== format(new Date(), 'yyyy-MM-dd');
                const isFuture = isAfter(day, maxDate);
                const isSelected = selectedDate === dateStr;
                return (
                  <Button
                    key={dateStr}
                    variant={isSelected ? 'default' : 'outline'}
                    className="flex flex-col h-16 text-xs"
                    disabled={isPast || isFuture}
                    onClick={() => handleSelectDate(day)}
                  >
                    <span>{format(day, 'EEE', { locale: ptBR })}</span>
                    <span className="text-lg font-bold">{format(day, 'd')}</span>
                  </Button>
                );
              })}
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horários disponíveis em {format(new Date(selectedDate + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                </h3>
                {slotsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nenhum horário disponível nesta data.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {availableSlots.map((s: any) => {
                      const time = typeof s.slot_time === 'string' ? s.slot_time : '';
                      const display = time.slice(0, 5);
                      return (
                        <Button
                          key={time}
                          variant={selectedTime === time ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedTime(time)}
                        >
                          {display}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setPhase('landing'); setSelectedDate(''); setSelectedTime(''); }}>Voltar</Button>
              <Button onClick={() => setPhase('contact')} disabled={!selectedDate || !selectedTime} className="flex-1">
                Próximo
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LANDING
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8 py-12">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="h-8 w-8 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">{link.title}</h1>
        </div>
        {link.description && (
          <div className="text-foreground/80 whitespace-pre-line text-base sm:text-lg leading-relaxed">{link.description}</div>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {link.slot_duration_minutes} min</span>
          <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {link.timezone}</span>
        </div>
        <Button onClick={() => setPhase('calendar')} size="lg" className="text-lg px-8 py-6">
          Agendar agora
        </Button>
      </div>
    </div>
  );
}
