import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { 
  ConsultationSchedule, 
  Client, 
  useUpdateConsultationSchedule, 
  useDeleteConsultationSchedule,
  useAddConsultationSchedule,
  useClients
} from '@/hooks/useClients';
import { format, parseISO, isSameDay, getDay, nextMonday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, User, Send, Calendar as CalendarIcon, Trash2, Edit2, Plus, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

interface ConsultationCalendarProps {
  consultations: (ConsultationSchedule & { client_name: string })[];
  clients?: Client[];
}

export function ConsultationCalendar({ consultations, clients = [] }: ConsultationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [editingSchedule, setEditingSchedule] = useState<(ConsultationSchedule & { client_name: string }) | null>(null);
  const [newSendLinkDate, setNewSendLinkDate] = useState<Date | undefined>();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newScheduleDate, setNewScheduleDate] = useState<Date | undefined>();

  const updateSchedule = useUpdateConsultationSchedule();
  const deleteSchedule = useDeleteConsultationSchedule();
  const addSchedule = useAddConsultationSchedule();
  const { data: allClients } = useClients();

  // Filter only clients that have consultations
  const clientsWithConsultations = (allClients || []).filter(c => c.has_consultations && c.is_active);

  // Dates with scheduled consultations (excluding first consultation which is send_link_date === scheduled_date)
  const consultationDates = consultations
    .filter(c => c.send_link_date !== c.scheduled_date)
    .map(c => parseISO(c.scheduled_date));
  
  // Dates for sending links (only pending ones where send_link_date is different from scheduled_date)
  const sendLinkDates = consultations
    .filter(c => c.status === 'pending' && c.send_link_date !== c.scheduled_date)
    .map(c => parseISO(c.send_link_date));

  // First consultation dates from clients
  const firstConsultationDates = clients
    .filter(c => c.first_consultation_date && c.is_active)
    .map(c => parseISO(c.first_consultation_date!));

  // Items for selected date
  const consultationsOnSelectedDate = selectedDate 
    ? consultations.filter(c => 
        c.send_link_date !== c.scheduled_date && 
        isSameDay(parseISO(c.scheduled_date), selectedDate)
      )
    : [];

  const sendLinksOnSelectedDate = selectedDate
    ? consultations.filter(c => 
        c.status === 'pending' && 
        c.send_link_date !== c.scheduled_date &&
        isSameDay(parseISO(c.send_link_date), selectedDate)
      )
    : [];

  const firstConsultationsOnSelectedDate = selectedDate
    ? clients.filter(c => 
        c.first_consultation_date && 
        c.is_active &&
        isSameDay(parseISO(c.first_consultation_date), selectedDate)
      )
    : [];

  const hasConsultation = (date: Date) => consultationDates.some(d => isSameDay(d, date));
  const hasSendLink = (date: Date) => sendLinkDates.some(d => isSameDay(d, date));
  const hasFirstConsultation = (date: Date) => firstConsultationDates.some(d => isSameDay(d, date));

  const hasEvents = consultationsOnSelectedDate.length > 0 || 
                   sendLinksOnSelectedDate.length > 0 || 
                   firstConsultationsOnSelectedDate.length > 0;

  const handleEditSendLink = (schedule: ConsultationSchedule & { client_name: string }) => {
    setEditingSchedule(schedule);
    setNewSendLinkDate(parseISO(schedule.send_link_date));
  };

  const handleSaveEdit = async () => {
    if (!editingSchedule || !newSendLinkDate) return;
    
    try {
      await updateSchedule.mutateAsync({
        id: editingSchedule.id,
        send_link_date: format(newSendLinkDate, 'yyyy-MM-dd'),
      });
      toast.success('Data de envio de link atualizada');
      setEditingSchedule(null);
      setNewSendLinkDate(undefined);
    } catch (error) {
      toast.error('Erro ao atualizar data');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteSchedule.mutateAsync(id);
      toast.success('Tarefa removida');
    } catch (error) {
      toast.error('Erro ao remover tarefa');
    }
  };

  const handleMarkAsSent = async (id: string) => {
    try {
      await updateSchedule.mutateAsync({
        id,
        status: 'sent',
      });
      toast.success('Marcado como enviado');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleAddManualSchedule = async () => {
    if (!selectedClientId || !newScheduleDate) {
      toast.error('Selecione o atleta e a data');
      return;
    }

    // Ensure it's a Monday
    const dayOfWeek = getDay(newScheduleDate);
    if (dayOfWeek !== 1) {
      toast.error('A data deve ser uma segunda-feira');
      return;
    }

    try {
      await addSchedule.mutateAsync({
        client_id: selectedClientId,
        scheduled_date: format(newScheduleDate, 'yyyy-MM-dd'),
        send_link_date: format(newScheduleDate, 'yyyy-MM-dd'),
      });
      toast.success('Tarefa adicionada');
      setIsAddDialogOpen(false);
      setSelectedClientId('');
      setNewScheduleDate(undefined);
    } catch (error) {
      toast.error('Erro ao adicionar tarefa');
    }
  };

  // Event details component (reusable for mobile and desktop)
  const EventDetails = () => (
    <>
      {/* First consultations on selected date */}
      {firstConsultationsOnSelectedDate.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-emerald-500 uppercase mb-2 flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            1ª Consulta
          </h5>
          <div className="space-y-2">
            {firstConsultationsOnSelectedDate.map(client => (
              <div
                key={client.id}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/20"
              >
                <User className="h-4 w-4 text-emerald-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {client.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Primeira consulta do atleta
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send links on selected date */}
      {sendLinksOnSelectedDate.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-amber-500 uppercase mb-2 flex items-center gap-1">
            <Send className="h-3 w-3" />
            Enviar Link de Agendamento
          </h5>
          <div className="space-y-2">
            {sendLinksOnSelectedDate.map(consultation => (
              <div
                key={`link-${consultation.id}`}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-amber-500/10 border-amber-500/20"
              >
                <Send className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {consultation.client_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Consulta prevista: {format(parseISO(consultation.scheduled_date), "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                    onClick={() => handleMarkAsSent(consultation.id)}
                    title="Marcar como enviado"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Alterar data"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <div className="p-3">
                        <p className="text-sm font-medium mb-2">Mover para outra segunda-feira:</p>
                        <Calendar
                          mode="single"
                          selected={editingSchedule?.id === consultation.id ? newSendLinkDate : parseISO(consultation.send_link_date)}
                          onSelect={(date) => {
                            if (date && getDay(date) === 1) {
                              setEditingSchedule(consultation);
                              setNewSendLinkDate(date);
                            } else if (date) {
                              toast.error('Selecione uma segunda-feira');
                            }
                          }}
                          locale={ptBR}
                          className="rounded-md border pointer-events-auto"
                          modifiers={{
                            monday: (date) => getDay(date) === 1
                          }}
                          modifiersStyles={{
                            monday: { fontWeight: 'bold' }
                          }}
                        />
                        {editingSchedule?.id === consultation.id && newSendLinkDate && (
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" onClick={handleSaveEdit} className="flex-1">
                              Salvar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setEditingSchedule(null);
                                setNewSendLinkDate(undefined);
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteSchedule(consultation.id)}
                    title="Remover tarefa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consultations on selected date */}
      {consultationsOnSelectedDate.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-primary uppercase mb-2 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Consultas Agendadas
          </h5>
          <div className="space-y-2">
            {consultationsOnSelectedDate.map(consultation => (
              <div
                key={consultation.id}
                className={cn(
                  "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border",
                  consultation.status === 'completed' 
                    ? "bg-muted/50 border-muted" 
                    : "bg-primary/10 border-primary/20"
                )}
              >
                <User className="h-4 w-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {consultation.client_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {consultation.status === 'completed' ? 'Realizada' : 
                     consultation.status === 'sent' ? 'Link enviado' : 'Pendente'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasEvents && (
        <p className="text-sm text-muted-foreground">
          Nenhum evento agendado para esta data.
        </p>
      )}
    </>
  );

  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
              <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Calendário de Consultas
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Consultas agendadas e datas de envio de link</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Adicionar Tarefa</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Tarefa de Envio de Link</DialogTitle>
                <DialogDescription>
                  Adicione manualmente uma tarefa de envio de link para um atleta em uma segunda-feira.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Atleta</label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o atleta" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsWithConsultations.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Segunda-feira</label>
                  <Calendar
                    mode="single"
                    selected={newScheduleDate}
                    onSelect={(date) => {
                      if (date && getDay(date) === 1) {
                        setNewScheduleDate(date);
                      } else if (date) {
                        toast.error('Selecione uma segunda-feira');
                      }
                    }}
                    locale={ptBR}
                    className="rounded-md border pointer-events-auto mx-auto"
                    modifiers={{
                      monday: (date) => getDay(date) === 1
                    }}
                    modifiersStyles={{
                      monday: { fontWeight: 'bold' }
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddManualSchedule}>
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 lg:p-6">
        {/* Desktop Layout: Calendar + Side Panel */}
        <div className="hidden lg:flex lg:gap-6">
          {/* Left: Calendar */}
          <div className="flex flex-col">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className="rounded-md border border-border pointer-events-auto"
              components={{
                DayContent: ({ date }) => {
                  const isConsultation = hasConsultation(date);
                  const isSendLink = hasSendLink(date);
                  const isFirstConsultation = hasFirstConsultation(date);
                  const isMonday = getDay(date) === 1;

                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span>{date.getDate()}</span>
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                        {isFirstConsultation && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="1ª Consulta" />
                        )}
                        {isConsultation && !isFirstConsultation && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Consulta" />
                        )}
                        {isSendLink && isMonday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Enviar Link" />
                        )}
                      </div>
                    </div>
                  );
                },
              }}
            />
            
            {/* Legend below calendar on desktop */}
            <div className="mt-4">
              <h4 className="font-medium text-sm text-foreground mb-2">
                {selectedDate 
                  ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                  : 'Selecione uma data'}
              </h4>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="text-muted-foreground">1ª Consulta</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Consulta</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-muted-foreground">Enviar Link</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Athletes list (only shown when there are events) */}
          {hasEvents && (
            <div className="flex-1 min-w-0 border-l border-border pl-6">
              <h4 className="font-medium text-sm text-foreground mb-4">
                Atletas - {selectedDate && format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
              </h4>
              <EventDetails />
            </div>
          )}
        </div>

        {/* Mobile Layout: Stacked */}
        <div className="lg:hidden flex flex-col gap-4">
          <div className="overflow-x-auto">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className="rounded-md border border-border pointer-events-auto mx-auto"
              components={{
                DayContent: ({ date }) => {
                  const isConsultation = hasConsultation(date);
                  const isSendLink = hasSendLink(date);
                  const isFirstConsultation = hasFirstConsultation(date);
                  const isMonday = getDay(date) === 1;

                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span>{date.getDate()}</span>
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                        {isFirstConsultation && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="1ª Consulta" />
                        )}
                        {isConsultation && !isFirstConsultation && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Consulta" />
                        )}
                        {isSendLink && isMonday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Enviar Link" />
                        )}
                      </div>
                    </div>
                  );
                },
              }}
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-foreground mb-3">
              {selectedDate 
                ? format(selectedDate, "d 'de' MMMM", { locale: ptBR })
                : 'Selecione uma data'}
            </h4>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-muted-foreground">1ª Consulta</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <span className="text-muted-foreground">Consulta</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-muted-foreground">Enviar Link</span>
              </div>
            </div>

            <EventDetails />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}