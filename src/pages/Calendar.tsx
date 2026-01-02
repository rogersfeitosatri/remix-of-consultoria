import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  ConsultationSchedule,
  Client,
  useUpdateConsultationSchedule,
  useDeleteConsultationSchedule,
  useAddConsultationSchedule,
  useClients,
  useConsultationSchedules,
} from '@/hooks/useClients';
import { format, parseISO, isSameDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, User, Send, Calendar as CalendarIcon, Trash2, Edit2, Plus, Check, Loader2 } from 'lucide-react';
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

export default function CalendarPage() {
  const { data: allClients = [], isLoading: clientsLoading } = useClients();
  const { data: consultations = [], isLoading: consultationsLoading } = useConsultationSchedules();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [editingSchedule, setEditingSchedule] = useState<(ConsultationSchedule & { client_name: string }) | null>(null);
  const [newSendLinkDate, setNewSendLinkDate] = useState<Date | undefined>();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newScheduleDate, setNewScheduleDate] = useState<Date | undefined>();

  const updateSchedule = useUpdateConsultationSchedule();
  const deleteSchedule = useDeleteConsultationSchedule();
  const addSchedule = useAddConsultationSchedule();

  const activeClients = allClients.filter(c => c.is_active);
  const clientsWithConsultations = allClients.filter(c => c.has_consultations && c.is_active);

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    allClients.forEach(c => map.set(c.id, c));
    return map;
  }, [allClients]);

  const isFirstConsultationRow = (s: ConsultationSchedule) => {
    const first = clientsById.get(s.client_id)?.first_consultation_date;
    return !!first && s.scheduled_date === first && s.send_link_date === first;
  };

  const isSendLinkOnlyTaskRow = (s: ConsultationSchedule) => {
    return s.scheduled_date === s.send_link_date && !isFirstConsultationRow(s);
  };

  const isConsultationEventRow = (s: ConsultationSchedule) => {
    return s.scheduled_date !== s.send_link_date;
  };

  const isSendLinkEventRow = (s: ConsultationSchedule) => {
    return !isFirstConsultationRow(s) && (s.scheduled_date !== s.send_link_date || isSendLinkOnlyTaskRow(s));
  };

  const consultationDates = consultations
    .filter(isConsultationEventRow)
    .map(c => parseISO(c.scheduled_date));

  const sendLinkDates = consultations
    .filter(c => c.status === 'pending' && isSendLinkEventRow(c))
    .map(c => parseISO(c.send_link_date));

  const firstConsultationDates = activeClients
    .filter(c => c.first_consultation_date)
    .map(c => parseISO(c.first_consultation_date!));

  const consultationsOnSelectedDate = selectedDate
    ? consultations.filter(c => isConsultationEventRow(c) && isSameDay(parseISO(c.scheduled_date), selectedDate))
    : [];

  const sendLinksOnSelectedDate = selectedDate
    ? consultations.filter(c => c.status === 'pending' && isSendLinkEventRow(c) && isSameDay(parseISO(c.send_link_date), selectedDate))
    : [];

  const firstConsultationsOnSelectedDate = selectedDate
    ? activeClients.filter(c => c.first_consultation_date && isSameDay(parseISO(c.first_consultation_date), selectedDate))
    : [];

  const hasConsultation = (date: Date) => consultationDates.some(d => isSameDay(d, date));
  const hasSendLink = (date: Date) => sendLinkDates.some(d => isSameDay(d, date));
  const hasFirstConsultation = (date: Date) => firstConsultationDates.some(d => isSameDay(d, date));

  const hasEvents =
    consultationsOnSelectedDate.length > 0 ||
    sendLinksOnSelectedDate.length > 0 ||
    firstConsultationsOnSelectedDate.length > 0;

  const handleMarkAsSent = async (id: string) => {
    try {
      await updateSchedule.mutateAsync({ id, status: 'sent' });
      toast.success('Marcado como enviado');
    } catch (error) {
      toast.error('Erro ao atualizar status');
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

  const handleAddManualSchedule = async () => {
    if (!selectedClientId || !newScheduleDate) {
      toast.error('Selecione o atleta e a data');
      return;
    }

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

  const isLoading = clientsLoading || consultationsLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Calendário de Consultas
            </h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
              Consultas agendadas e datas de envio de link
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Adicionar Tarefa
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

        {/* Main content - Full screen layout */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Calendar - Takes more space */}
          <div className="lg:col-span-2 glass-card rounded-xl p-4 sm:p-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className="rounded-md border-0 w-full pointer-events-auto [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full [&_.rdp-head_th]:text-center [&_.rdp-cell]:text-center [&_.rdp-head_th]:w-auto [&_.rdp-cell]:w-auto [&_button]:h-12 [&_button]:w-12 sm:[&_button]:h-14 sm:[&_button]:w-14 [&_.rdp-caption]:text-lg sm:[&_.rdp-caption]:text-xl"
              modifiers={{
                hasConsultation: hasConsultation,
                hasSendLink: hasSendLink,
                hasFirstConsultation: hasFirstConsultation,
              }}
              modifiersStyles={{
                hasConsultation: {
                  backgroundColor: 'hsl(var(--primary) / 0.15)',
                  borderRadius: '9999px',
                },
                hasSendLink: {
                  border: '2px solid hsl(var(--warning))',
                  borderRadius: '9999px',
                },
                hasFirstConsultation: {
                  backgroundColor: 'hsl(var(--success) / 0.15)',
                  borderRadius: '9999px',
                },
              }}
            />
            
            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-primary/15 border-2 border-primary/30" />
                <span className="text-muted-foreground">Consulta</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-warning" />
                <span className="text-muted-foreground">Enviar Link</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-success/15 border-2 border-success/30" />
                <span className="text-muted-foreground">1ª Consulta</span>
              </div>
            </div>
          </div>

          {/* Events panel */}
          <div className="lg:col-span-1 glass-card rounded-xl p-4 sm:p-6 max-h-[600px] overflow-y-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {selectedDate ? format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Selecione uma data'}
            </h3>
            
            {/* First consultations */}
            {firstConsultationsOnSelectedDate.length > 0 && (
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-success uppercase mb-2 flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  1ª Consulta
                </h5>
                <div className="space-y-2">
                  {firstConsultationsOnSelectedDate.map(client => (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-success/10 border-success/20"
                    >
                      <User className="h-4 w-4 text-success" />
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

            {/* Send links */}
            {sendLinksOnSelectedDate.length > 0 && (
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-warning uppercase mb-2 flex items-center gap-1">
                  <Send className="h-3 w-3" />
                  Enviar Link de Agendamento
                </h5>
                <div className="space-y-2">
                  {sendLinksOnSelectedDate.map(consultation => (
                    <div
                      key={`link-${consultation.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-warning/10 border-warning/20"
                    >
                      <Send className="h-4 w-4 text-warning flex-shrink-0" />
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
                          className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
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

            {/* Consultations */}
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
                        "flex items-center gap-3 p-3 rounded-lg border",
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
          </div>
        </div>
      </div>
    </Layout>
  );
}
