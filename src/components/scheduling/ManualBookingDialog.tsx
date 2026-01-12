import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CalendarDays, Clock, Search, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClients } from '@/hooks/useClients';
import { useSchedulingSettings, useSchedulingBlocks, useAppointmentsByDate } from '@/hooks/useScheduling';
import { useTimeBlocks } from '@/hooks/useTimeBlocks';
import { toast } from 'sonner';
import { format, getDay, isBefore, isSameDay, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ManualBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ManualBookingDialog({ open, onOpenChange, onSuccess }: ManualBookingDialogProps) {
  const { user } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: settings } = useSchedulingSettings();
  const { data: blocks = [] } = useSchedulingBlocks();
  const { data: timeBlocks = [] } = useTimeBlocks(settings?.id);
  
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch appointments for selected date
  const { data: existingAppointments = [] } = useAppointmentsByDate(
    user?.id || '',
    selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''
  );
  
  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 10);
    const search = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.email?.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [clients, clientSearch]);
  
  const selectedClient = clients.find(c => c.id === selectedClientId);
  
  // Calculate buffer
  const bufferMinutes = (settings as any)?.buffer_minutes || 0;
  const slotStep = (settings?.slot_duration_minutes || 60) + bufferMinutes;
  
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

    // Check if there are specific time blocks for this day
    const dayTimeBlocks = timeBlocks.filter(tb => tb.day_of_week === dayOfWeek);
    
    // Define working periods
    const workingPeriods: { start: string; end: string }[] = [];
    
    if (dayTimeBlocks.length > 0) {
      dayTimeBlocks.forEach(tb => {
        workingPeriods.push({
          start: tb.start_time.substring(0, 5),
          end: tb.end_time.substring(0, 5),
        });
      });
    } else {
      workingPeriods.push({
        start: settings.working_hours_start.substring(0, 5),
        end: settings.working_hours_end.substring(0, 5),
      });
    }

    // Generate slots for each working period
    workingPeriods.forEach(period => {
      const [startHour, startMin] = period.start.split(':').map(Number);
      const [endHour, endMin] = period.end.split(':').map(Number);
      
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
          const aptDuration = a.duration_minutes || (settings?.slot_duration_minutes || 60);
          const blockStart = addMinutes(aptStart, -bufferMinutes);
          const blockEnd = addMinutes(aptStart, aptDuration + bufferMinutes);
          
          // Check if this slot falls within the blocked range
          const slotStart = new Date(selectedDate);
          slotStart.setHours(parseInt(timeStr.split(':')[0]), parseInt(timeStr.split(':')[1]), 0, 0);
          const slotEnd = addMinutes(slotStart, settings?.slot_duration_minutes || 60);
          
          // Slot conflicts if it overlaps with blocked range
          return slotStart < blockEnd && slotEnd > blockStart;
        });

        // Check if slot is in the past (for today)
        const isPast = isSameDay(selectedDate, new Date()) && isBefore(currentTime, new Date());

        if (!isBlocked && !isBooked && !isPast) {
          slots.push(timeStr);
        }

        currentTime = addMinutes(currentTime, slotStep);
      }
    });

    return [...new Set(slots)].sort();
  }, [settings, selectedDate, blocks, existingAppointments, timeBlocks, slotStep]);
  
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
  
  const handleSubmit = async () => {
    if (!selectedClientId || !selectedDate || !selectedTime || !user) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Create appointment
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          user_id: user.id,
          client_id: selectedClientId,
          appointment_date: dateStr,
          appointment_time: selectedTime + ':00',
          duration_minutes: settings?.slot_duration_minutes || 60,
          status: 'confirmed',
          timezone: 'America/Fortaleza',
        })
        .select()
        .single();
      
      if (appointmentError) throw appointmentError;
      
      // Create Google Calendar event with Meet
      let meetLink = null;
      let meetStatus = 'pending';
      try {
        const { data: calendarData } = await supabase.functions.invoke('create-calendar-event', {
          body: { appointmentId: appointment.id },
        });
        meetLink = calendarData?.google_meet_link;
        meetStatus = calendarData?.meet_status || 'pending';
      } catch (calendarError) {
        console.error('Calendar event creation failed:', calendarError);
        meetStatus = 'failed';
      }
      
      // Only send WhatsApp if Meet was successfully created
      if (sendWhatsApp && selectedClient && meetLink && meetStatus === 'created') {
        try {
          const formattedDate = format(selectedDate, "dd 'de' MMMM", { locale: ptBR });
          const message = `✅ Consulta agendada!\n\n📅 Data: ${formattedDate}\n⏰ Horário: ${selectedTime}\n\n🎥 Link da videochamada:\n${meetLink}\n\nAté lá!`;

          await supabase.functions.invoke('send-whatsapp', {
            body: {
              clientId: selectedClientId,
              message,
            },
          });
          toast.success('Consulta agendada e WhatsApp enviado!');
        } catch (whatsappError) {
          console.error('WhatsApp send failed:', whatsappError);
          toast.success('Consulta agendada! (WhatsApp falhou)');
        }
      } else if (sendWhatsApp && meetStatus === 'failed') {
        // Meet failed - warn admin to reprocess
        toast.warning('Consulta agendada, mas Meet não foi gerado. Reprocesse na tela de detalhes.');
      } else {
        toast.success('Consulta agendada com sucesso!');
      }
      onOpenChange(false);
      onSuccess?.();
      
      // Reset form
      setSelectedClientId('');
      setClientSearch('');
      setSelectedDate(undefined);
      setSelectedTime('');
      
    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.message || 'Erro ao agendar consulta');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Consulta Manualmente</DialogTitle>
          <DialogDescription>
            Crie um agendamento para um cliente existente
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Client Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Cliente
            </Label>
            
            {!selectedClient ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      Nenhum cliente encontrado
                    </p>
                  ) : (
                    filteredClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => setSelectedClientId(client.id)}
                        className="w-full px-4 py-3 text-left hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                      >
                        <p className="font-medium text-sm">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.email || 'Sem e-mail'}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-primary/5">
                <div>
                  <p className="font-medium">{selectedClient.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedClient.email || 'Sem e-mail'}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedClientId('')}>
                  Alterar
                </Button>
              </div>
            )}
          </div>
          
          {/* Date Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Data
            </Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setSelectedTime('');
              }}
              locale={ptBR}
              disabled={isDateDisabled}
              className="rounded-md border mx-auto"
            />
          </div>
          
          {/* Time Selection */}
          {selectedDate && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horário
              </Label>
              
              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Não há horários disponíveis nesta data
                </p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {availableSlots.map(time => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* WhatsApp option */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="sendWhatsApp" 
              checked={sendWhatsApp}
              onCheckedChange={(checked) => setSendWhatsApp(checked === true)}
            />
            <Label htmlFor="sendWhatsApp" className="text-sm cursor-pointer">
              Enviar confirmação por WhatsApp
            </Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedClientId || !selectedDate || !selectedTime}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              'Confirmar Agendamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}