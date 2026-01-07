import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import {
  ConsultationSchedule,
  Client,
  useUpdateConsultationSchedule,
  useDeleteConsultationSchedule,
  useAddConsultationSchedule,
  useClients,
  useConsultationSchedules,
} from '@/hooks/useClients';
import { format, parseISO, isSameDay, getDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, User, Send, ChevronLeft, ChevronRight, Trash2, Edit2, Plus, Check, Loader2, Search } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CalendarPage() {
  const { data: allClients = [], isLoading: clientsLoading } = useClients();
  const { data: consultations = [], isLoading: consultationsLoading } = useConsultationSchedules();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newScheduleDate, setNewScheduleDate] = useState<Date | undefined>();
  const [editingSchedule, setEditingSchedule] = useState<(ConsultationSchedule & { client_name: string }) | null>(null);
  const [newSendLinkDate, setNewSendLinkDate] = useState<Date | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

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

  // Calculate consultation number for each schedule
  const getConsultationNumber = (schedule: ConsultationSchedule): { current: number; total: number } | null => {
    const client = clientsById.get(schedule.client_id);
    if (!client || !client.consultation_count) return null;

    // Get all consultations for this client ordered by date
    const clientConsultations = consultations
      .filter(c => c.client_id === schedule.client_id)
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

    const index = clientConsultations.findIndex(c => c.id === schedule.id);
    if (index === -1) return null;

    return {
      current: index + 1,
      total: client.consultation_count
    };
  };

  // Check if row is first consultation
  const isFirstConsultationRow = (s: ConsultationSchedule) => {
    const first = clientsById.get(s.client_id)?.first_consultation_date;
    return !!first && s.scheduled_date === first && s.send_link_date === first;
  };

  // Check if row is a send link task (not first consultation)
  const isSendLinkEventRow = (s: ConsultationSchedule) => {
    return !isFirstConsultationRow(s) && s.status === 'pending';
  };

  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const events: { type: 'first' | 'sendLink'; schedule?: ConsultationSchedule & { client_name: string }; client?: Client }[] = [];

    // First consultations from clients
    activeClients
      .filter(c => c.first_consultation_date && isSameDay(parseISO(c.first_consultation_date), date))
      .forEach(client => {
        events.push({ type: 'first', client });
      });

    // Send link tasks (pending only) - using send_link_date
    consultations
      .filter(c => isSendLinkEventRow(c) && isSameDay(parseISO(c.send_link_date), date))
      .forEach(schedule => {
        events.push({ type: 'sendLink', schedule });
      });

    return events;
  };

  const handleSendBookingLink = async (id: string) => {
    try {
      toast.loading('Enviando link de agendamento...');
      const { error } = await supabase.functions.invoke('send-booking-link', {
        body: { consultationScheduleId: id },
      });
      toast.dismiss();
      if (error) throw error;
      toast.success('Link de agendamento enviado via WhatsApp!');
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Erro ao enviar link. Configure o agendamento primeiro.');
    }
  };

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

  // Search filter for athletes
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results: { client: Client; schedules: (ConsultationSchedule & { client_name: string })[] }[] = [];
    
    activeClients
      .filter(c => c.name.toLowerCase().includes(query))
      .forEach(client => {
        const clientSchedules = consultations.filter(s => s.client_id === client.id);
        results.push({ client, schedules: clientSchedules });
      });
    
    return results;
  }, [searchQuery, activeClients, consultations]);

  const isLoading = clientsLoading || consultationsLoading;
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
        <Card className="border-border bg-card">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
                  <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Calendário de Consultas
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Tarefas de envio de link e primeiras consultas
                </CardDescription>
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
          <CardContent className="p-2 sm:p-4 lg:p-6">
            {/* Search */}
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar atleta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchQuery.trim() && (
              <div className="mb-6 p-4 rounded-lg border border-border bg-muted/50">
                <h4 className="text-sm font-semibold mb-3">Resultados da busca</h4>
                {searchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum atleta encontrado.</p>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map(({ client, schedules }) => (
                      <div key={client.id} className="p-3 rounded-lg bg-background border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-medium">{client.name}</span>
                        </div>
                        {client.first_consultation_date && (
                          <p className="text-xs text-muted-foreground mb-1">
                            1ª Consulta: {format(parseISO(client.first_consultation_date), "dd/MM/yyyy")}
                          </p>
                        )}
                        {schedules.length > 0 ? (
                          <div className="space-y-1 mt-2">
                            <p className="text-xs font-medium text-muted-foreground">Tarefas:</p>
                            {schedules.map(schedule => {
                              const consultNum = getConsultationNumber(schedule);
                              return (
                                <div key={schedule.id} className="text-xs flex items-center gap-2 p-1.5 rounded bg-muted">
                                  <Send className="h-3 w-3 text-warning" />
                                  <span>
                                    Enviar Link - {format(parseISO(schedule.send_link_date), "dd/MM/yyyy")}
                                    {consultNum && ` (${consultNum.current}/${consultNum.total})`}
                                  </span>
                                  <span className={cn(
                                    "ml-auto px-1.5 py-0.5 rounded text-[10px]",
                                    schedule.status === 'sent' ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                                  )}>
                                    {schedule.status === 'sent' ? 'Enviado' : 'Pendente'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Nenhuma tarefa cadastrada.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h3 className="text-lg font-semibold text-foreground capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500" />
                <span className="text-muted-foreground">1ª Consulta</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500" />
                <span className="text-muted-foreground">Enviar Link</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Week days header */}
              <div className="grid grid-cols-7 bg-muted/50">
                {weekDays.map(day => (
                  <div
                    key={day}
                    className="p-2 text-center text-xs font-semibold text-foreground border-b border-border"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const events = getEventsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[100px] sm:min-h-[120px] p-1 sm:p-2 border-b border-r border-border relative",
                        !isCurrentMonth && "bg-muted/30",
                        isToday && "bg-primary/5",
                        index % 7 === 0 && "border-l-0",
                        index < 7 && "border-t-0"
                      )}
                    >
                      {/* Day number */}
                      <div className={cn(
                        "text-sm font-medium mb-1",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isToday && "text-primary font-bold"
                      )}>
                        {format(day, 'd')}
                      </div>

                      {/* Events */}
                      <div className="space-y-1 overflow-y-auto max-h-[70px] sm:max-h-[85px]">
                        {events.map((event, eventIndex) => {
                          if (event.type === 'first' && event.client) {
                            return (
                              <div
                                key={`first-${event.client.id}`}
                                className="text-[10px] sm:text-xs p-1 rounded bg-emerald-500/20 border border-emerald-500/30 text-foreground truncate"
                                title={`1ª Consulta: ${event.client.name}`}
                              >
                                <span className="hidden sm:inline">1ª </span>
                                {event.client.name}
                              </div>
                            );
                          }

                          if (event.type === 'sendLink' && event.schedule) {
                            const consultNum = getConsultationNumber(event.schedule);
                            const displayName = consultNum 
                              ? `${event.schedule.client_name} - ${consultNum.current}/${consultNum.total}`
                              : event.schedule.client_name;

                            return (
                              <Popover key={`link-${event.schedule.id}`}>
                                <PopoverTrigger asChild>
                                  <div
                                    className="text-[10px] sm:text-xs p-1 rounded bg-amber-500/20 border border-amber-500/30 text-foreground truncate cursor-pointer hover:bg-amber-500/30 transition-colors"
                                    title={`Enviar Link: ${displayName}`}
                                  >
                                    <Send className="h-2.5 w-2.5 inline mr-0.5 sm:mr-1" />
                                    <span className="hidden sm:inline">{displayName}</span>
                                    <span className="sm:hidden">{event.schedule.client_name.split(' ')[0]}</span>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-3" align="start">
                                  <div className="space-y-3">
                                    <div>
                                      <p className="font-medium text-sm">{displayName}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Enviar link: {format(parseISO(event.schedule.send_link_date), "dd/MM/yyyy")}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                                        onClick={() => handleMarkAsSent(event.schedule!.id)}
                                      >
                                        <Check className="h-3.5 w-3.5 mr-1" />
                                        Enviado
                                      </Button>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button size="sm" variant="outline">
                                            <Edit2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-3" align="start">
                                          <p className="text-sm font-medium mb-2">Mover para outra segunda-feira:</p>
                                          <Calendar
                                            mode="single"
                                            selected={editingSchedule?.id === event.schedule!.id ? newSendLinkDate : parseISO(event.schedule!.send_link_date)}
                                            onSelect={(date) => {
                                              if (date && getDay(date) === 1) {
                                                setEditingSchedule(event.schedule!);
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
                                          {editingSchedule?.id === event.schedule!.id && newSendLinkDate && (
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
                                        </PopoverContent>
                                      </Popover>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteSchedule(event.schedule!.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          }

                          return null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
