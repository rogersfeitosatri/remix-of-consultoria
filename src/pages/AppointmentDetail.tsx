import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useRescheduleAppointment, useCancelAppointment } from '@/hooks/useConsultations';
import { useSchedulingSettings, useSchedulingBlocks, useAppointmentsByDate } from '@/hooks/useScheduling';
import { useTimeBlocks } from '@/hooks/useTimeBlocks';
import { toast } from 'sonner';
import { format, parseISO, setHours, setMinutes, isBefore, startOfDay, addDays, addMinutes, isSameDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Video, 
  ExternalLink, 
  Edit2, 
  X, 
  Save, 
  Loader2, 
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Appointment {
  id: string;
  client_id: string;
  user_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  notes_admin: string | null;
  google_calendar_event_id: string | null;
  google_meet_link: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
  client: {
    name: string;
    email: string | null;
    phone: string | null;
  };
}

export default function AppointmentDetail() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [notesAdmin, setNotesAdmin] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  // Reschedule state
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newTime, setNewTime] = useState<string>('');
  
  // Cancel state
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  // Reprocess state
  const [isReprocessing, setIsReprocessing] = useState(false);
  
  const rescheduleAppointment = useRescheduleAppointment();
  const cancelAppointment = useCancelAppointment();
  
  // Fetch scheduling settings and time blocks (same as PublicBooking)
  const { data: schedulingSettings } = useSchedulingSettings();
  const { data: timeBlocks = [] } = useTimeBlocks(schedulingSettings?.id);
  const { data: blocks = [] } = useSchedulingBlocks(schedulingSettings?.user_id);
  
  // Get appointments for the selected new date (for conflict checking)
  const { data: existingAppointments = [] } = useAppointmentsByDate(
    schedulingSettings?.user_id || '',
    newDate ? format(newDate, 'yyyy-MM-dd') : ''
  );
  
  // Fetch appointment details
  const { data: appointment, isLoading, refetch } = useQuery({
    queryKey: ['appointment-detail', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          client:clients(name, email, phone)
        `)
        .eq('id', appointmentId)
        .maybeSingle();
      
      if (error) throw error;
      return data as Appointment | null;
    },
    enabled: !!appointmentId,
  });
  
  useEffect(() => {
    if (appointment?.notes_admin) {
      setNotesAdmin(appointment.notes_admin);
    }
  }, [appointment]);
  
  // Buffer minutes from settings
  const bufferMinutes = (schedulingSettings as any)?.buffer_minutes || 15;
  const slotDuration = schedulingSettings?.slot_duration_minutes || 30;
  
  // Generate available time slots for reschedule - SAME LOGIC AS PublicBooking
  const availableSlots = useMemo(() => {
    if (!schedulingSettings || !newDate) return [];
    
    const slots: string[] = [];
    const dayOfWeek = getDay(newDate);
    const dateStr = format(newDate, 'yyyy-MM-dd');
    
    // Check for full day blocks first
    const fullDayBlock = blocks.find(
      b => b.block_date === dateStr && b.block_type === 'full_day'
    );
    if (fullDayBlock) return [];
    
    // Get time blocks for this day - ONLY USE TIME BLOCKS
    const dayTimeBlocks = timeBlocks.filter(tb => tb.day_of_week === dayOfWeek);
    
    // If no time blocks for this day, no slots available
    if (dayTimeBlocks.length === 0) {
      return [];
    }
    
    // Calculate slot step with buffer (same as PublicBooking)
    const slotStep = slotDuration + bufferMinutes;
    
    // Generate slots ONLY from configured time blocks
    dayTimeBlocks.forEach(tb => {
      const [startHour, startMin] = tb.start_time.substring(0, 5).split(':').map(Number);
      const [endHour, endMin] = tb.end_time.substring(0, 5).split(':').map(Number);
      
      let currentTime = new Date(newDate);
      currentTime.setHours(startHour, startMin, 0, 0);
      
      const endTime = new Date(newDate);
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
        // EXCLUDE the current appointment being rescheduled from conflict check
        const isBooked = existingAppointments.some(a => {
          if (!a.appointment_time) return false;
          if (a.id === appointmentId) return false; // Don't block the slot if it's the same appointment
          
          const aptTime = a.appointment_time.substring(0, 5);
          const [aptHour, aptMin] = aptTime.split(':').map(Number);
          
          // Create appointment start and end times with buffer
          const aptStart = new Date(newDate);
          aptStart.setHours(aptHour, aptMin, 0, 0);
          
          // Block from (aptStart - buffer) to (aptEnd + buffer)
          const aptDuration = a.duration_minutes || slotDuration;
          const blockStart = addMinutes(aptStart, -bufferMinutes);
          const blockEnd = addMinutes(aptStart, aptDuration + bufferMinutes);
          
          // Check if this slot falls within the blocked range
          const slotStart = new Date(newDate);
          slotStart.setHours(parseInt(timeStr.split(':')[0]), parseInt(timeStr.split(':')[1]), 0, 0);
          const slotEnd = addMinutes(slotStart, slotDuration);
          
          // Slot conflicts if it overlaps with blocked range
          return slotStart < blockEnd && slotEnd > blockStart;
        });
        
        // Check if slot is in the past (for today)
        const isPast = isSameDay(newDate, new Date()) && isBefore(currentTime, new Date());
        
        if (!isBlocked && !isBooked && !isPast) {
          slots.push(timeStr);
        }
        
        // Use slot step (duration + buffer) for next slot
        currentTime = addMinutes(currentTime, slotStep);
      }
    });
    
    // Sort and remove duplicates
    return [...new Set(slots)].sort();
  }, [schedulingSettings, newDate, blocks, existingAppointments, timeBlocks, bufferMinutes, slotDuration, appointmentId]);
  const handleSaveNotes = async () => {
    if (!appointmentId) return;
    
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ notes_admin: notesAdmin })
        .eq('id', appointmentId);
      
      if (error) throw error;
      
      toast.success('Notas salvas com sucesso');
      setIsEditing(false);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar notas');
    } finally {
      setIsSavingNotes(false);
    }
  };
  
  const handleReschedule = async () => {
    if (!appointmentId || !newDate || !newTime) {
      toast.error('Selecione data e horário');
      return;
    }
    
    try {
      await rescheduleAppointment.mutateAsync({
        appointmentId,
        newDate: format(newDate, 'yyyy-MM-dd'),
        newTime: newTime + ':00',
        notifyClient: true,
      });
      
      toast.success('Consulta remarcada com sucesso');
      setIsRescheduleOpen(false);
      setNewDate(undefined);
      setNewTime('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao remarcar consulta');
    }
  };
  
  const handleCancel = async () => {
    if (!appointmentId) return;
    
    try {
      await cancelAppointment.mutateAsync({
        appointmentId,
        notifyClient: true,
        reason: cancelReason,
      });
      
      toast.success('Consulta cancelada');
      setIsCancelOpen(false);
      setCancelReason('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar consulta');
    }
  };
  
  const handleReprocess = async () => {
    if (!appointmentId || !appointment) return;
    
    setIsReprocessing(true);
    try {
      // 1. Try to create Google Calendar event
      const { data: calendarData, error: calendarError } = await supabase.functions.invoke('create-calendar-event', {
        body: { appointmentId },
      });
      
      if (calendarError) {
        throw new Error('Erro ao criar evento: ' + calendarError.message);
      }
      
      if (!calendarData?.success) {
        throw new Error(calendarData?.error || 'Falha ao criar evento no Google Calendar');
      }
      
      const meetLink = calendarData.google_meet_link;
      
      // 2. Send WhatsApp with Meet link
      if (meetLink && appointment.client_id) {
        const formattedDate = format(parseISO(appointment.appointment_date), "dd 'de' MMMM", { locale: ptBR });
        const formattedTime = appointment.appointment_time.substring(0, 5);
        
        const message = `✅ *Consulta Confirmada!*\n\n📅 Data: ${formattedDate}\n⏰ Horário: ${formattedTime}\n\n🎥 Link da videochamada:\n${meetLink}\n\nAté lá!`;
        
        await supabase.functions.invoke('send-whatsapp', {
          body: {
            clientId: appointment.client_id,
            message,
          },
        });
      }
      
      toast.success('Evento criado e WhatsApp enviado com sucesso!');
      refetch();
      
    } catch (error: any) {
      console.error('Reprocess error:', error);
      toast.error(error.message || 'Erro ao reprocessar');
    } finally {
      setIsReprocessing(false);
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Confirmada</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Agendada</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelada</Badge>;
      case 'completed':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Concluída</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }
  
  if (!appointment) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Consulta não encontrada</p>
          <Button variant="outline" onClick={() => navigate('/calendar')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Calendário
          </Button>
        </div>
      </Layout>
    );
  }
  
  const appointmentDate = parseISO(appointment.appointment_date);
  const isPast = isBefore(appointmentDate, startOfDay(new Date()));
  const isCancelled = appointment.status === 'cancelled';
  const canModify = !isPast && !isCancelled;
  const hasMeetIssue = !appointment.google_meet_link && appointment.status !== 'cancelled';
  
  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/calendar')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Detalhes da Consulta</h1>
              <p className="text-sm text-muted-foreground">
                {format(appointmentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          {getStatusBadge(appointment.status)}
        </div>
        
        {/* Alert for missing Meet link */}
        {hasMeetIssue && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-500">Link do Meet não gerado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    O evento do Google Calendar e/ou link do Meet não foram criados. Clique em "Reprocessar" para tentar novamente.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleReprocess}
                  disabled={isReprocessing}
                  className="border-amber-500/50 text-amber-500 hover:bg-amber-500/20"
                >
                  {isReprocessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Reprocessar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Main Info */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Appointment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Informações do Agendamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Horário</p>
                  <p className="font-medium">{appointment.appointment_time.substring(0, 5)}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Duração</p>
                  <p className="font-medium">{appointment.duration_minutes} minutos</p>
                </div>
              </div>
              
              {appointment.google_meet_link ? (
                <div className="flex items-center gap-3">
                  <Video className="h-4 w-4 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Google Meet</p>
                    <a 
                      href={appointment.google_meet_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center gap-1"
                    >
                      Abrir reunião
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Video className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Google Meet</p>
                    <p className="text-amber-500 text-sm">Não gerado</p>
                  </div>
                  <XCircle className="h-4 w-4 text-amber-500" />
                </div>
              )}
              
              {appointment.google_calendar_event_id && (
                <div className="text-xs text-muted-foreground">
                  Event ID: {appointment.google_calendar_event_id.substring(0, 20)}...
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Dados do Atleta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{appointment.client.name}</p>
                </div>
              </div>
              
              {appointment.client.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <p className="font-medium">{appointment.client.email}</p>
                  </div>
                </div>
              )}
              
              {appointment.client.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{appointment.client.phone}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Notes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notas do Admin</CardTitle>
              {!isEditing && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Editar
                </Button>
              )}
            </div>
            <CardDescription>
              Anotações internas sobre esta consulta (não visíveis para o atleta)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  value={notesAdmin}
                  onChange={(e) => setNotesAdmin(e.target.value)}
                  placeholder="Adicione notas sobre esta consulta..."
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveNotes} disabled={isSavingNotes}>
                    {isSavingNotes ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsEditing(false);
                    setNotesAdmin(appointment.notes_admin || '');
                  }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground whitespace-pre-wrap">
                {appointment.notes_admin || 'Nenhuma nota adicionada.'}
              </p>
            )}
          </CardContent>
        </Card>
        
        {/* Actions */}
        {canModify && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {/* Reschedule Dialog */}
              <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Remarcar
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Remarcar Consulta</DialogTitle>
                    <DialogDescription>
                      Selecione a nova data e horário. O atleta será notificado automaticamente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nova Data</Label>
                      <Calendar
                        mode="single"
                        selected={newDate}
                        onSelect={setNewDate}
                        locale={ptBR}
                        disabled={(date) => isBefore(date, startOfDay(new Date()))}
                        className="rounded-md border mx-auto"
                      />
                    </div>
                    
                    {newDate && availableSlots.length > 0 && (
                      <div className="space-y-2">
                        <Label>Novo Horário</Label>
                        <Select value={newTime} onValueChange={setNewTime}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o horário" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSlots.map(slot => (
                              <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {newDate && availableSlots.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center">
                        Sem horários disponíveis nesta data
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRescheduleOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleReschedule} 
                      disabled={!newDate || !newTime || rescheduleAppointment.isPending}
                    >
                      {rescheduleAppointment.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : null}
                      Confirmar Remarcação
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Cancel Dialog */}
              <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <X className="h-4 w-4 mr-2" />
                    Cancelar Consulta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancelar Consulta</DialogTitle>
                    <DialogDescription>
                      Esta ação não pode ser desfeita. O atleta será notificado automaticamente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label>Motivo do cancelamento (opcional)</Label>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Ex: Reagendamento a pedido do atleta..."
                      className="mt-2"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCancelOpen(false)}>
                      Voltar
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleCancel}
                      disabled={cancelAppointment.isPending}
                    >
                      {cancelAppointment.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : null}
                      Confirmar Cancelamento
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Reprocess button (always visible for convenience) */}
              <Button 
                variant="outline" 
                onClick={handleReprocess}
                disabled={isReprocessing}
              >
                {isReprocessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Reprocessar Meet/WhatsApp
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
