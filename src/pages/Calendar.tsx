import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DayAgendaPanel } from '@/components/calendar/DayAgendaPanel';
import { LinkScheduleEditDialog } from '@/components/calendar/LinkScheduleEditDialog';
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
import { useConsultationAppointments } from '@/hooks/useConsultations';
import { useWeeklyLinkLogs } from '@/hooks/useWeeklyLinkLogs';
import { format, parseISO, isSameDay, getDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, User, Send, ChevronLeft, ChevronRight, Trash2, Edit2, Plus, Check, Loader2, Search, CalendarCheck2, Phone, Mail, ExternalLink, History, LayoutList, Shield, AlertCircle, XCircle, BellOff, Activity } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConsultationHistoryView } from '@/components/scheduling/ConsultationHistoryView';
import { ManualBookingDialog } from '@/components/scheduling/ManualBookingDialog';
import { WeeklyPipelineView } from '@/components/scheduling/WeeklyPipelineView';
import { PeriodicityControlView } from '@/components/scheduling/PeriodicityControlView';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { data: allClients = [], isLoading: clientsLoading } = useClients();
  const { data: consultations = [], isLoading: consultationsLoading } = useConsultationSchedules();
  const { data: appointments = [] } = useConsultationAppointments();
  const [activeTab, setActiveTab] = useState('pipeline');
  const [selectedAgendaDay, setSelectedAgendaDay] = useState<Date>(new Date());
  const [linkDialogDay, setLinkDialogDay] = useState<Date | null>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [newScheduleDate, setNewScheduleDate] = useState<Date | undefined>();
  const [editingSchedule, setEditingSchedule] = useState<(ConsultationSchedule & { client_name: string }) | null>(null);
  const [newSendLinkDate, setNewSendLinkDate] = useState<Date | undefined>();
  const [isSending, setIsSending] = useState(false);

  const updateSchedule = useUpdateConsultationSchedule();
  const deleteSchedule = useDeleteConsultationSchedule();
  const addSchedule = useAddConsultationSchedule();

  // Logs WhatsApp para enriquecer o calendário (range = mês visível ± 1 semana)
  const monthRangeStart = useMemo(() => startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }).toISOString(), [currentMonth]);
  const monthRangeEnd = useMemo(() => endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }).toISOString(), [currentMonth]);
  const { data: linkLogs = [] } = useWeeklyLinkLogs(monthRangeStart, monthRangeEnd);

  const activeClients = allClients.filter(c => c.is_active);
  const clientsWithConsultations = allClients.filter(c => c.has_consultations && c.is_active);

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    allClients.forEach(c => map.set(c.id, c));
    return map;
  }, [allClients]);

  const getConsultationNumber = (schedule: ConsultationSchedule): { current: number; total: number } | null => {
    const client = clientsById.get(schedule.client_id);
    if (!client || !client.consultation_count) return null;
    const clientConsultations = consultations
      .filter(c => c.client_id === schedule.client_id)
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
    const index = clientConsultations.findIndex(c => c.id === schedule.id);
    if (index === -1) return null;
    return { current: index + 1, total: client.consultation_count };
  };

  const isFirstConsultationRow = (s: ConsultationSchedule) => {
    const first = clientsById.get(s.client_id)?.first_consultation_date;
    return !!first && s.scheduled_date === first && s.send_link_date === first;
  };

  const isSendLinkEventRow = (s: ConsultationSchedule) => {
    return !isFirstConsultationRow(s) && s.status === 'pending';
  };

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group calendar days into weeks (each row of 7)
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  // Index logs by day (yyyy-MM-dd) for fast lookup
  const logsByDay = useMemo(() => {
    const map = new Map<string, { success: number; failed: number; logs: typeof linkLogs }>();
    linkLogs.forEach(log => {
      const key = format(parseISO(log.created_at), 'yyyy-MM-dd');
      const entry = map.get(key) || { success: 0, failed: 0, logs: [] };
      if (log.status === 'success' || log.status === 'sent') entry.success += 1;
      else entry.failed += 1;
      entry.logs.push(log);
      map.set(key, entry);
    });
    return map;
  }, [linkLogs]);

  // Compute weekly stats for each week (sent vs scheduled-to-send)
  const getWeekStats = (week: Date[]) => {
    let sent = 0;
    let pending = 0;
    let appts = 0;
    week.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      const log = logsByDay.get(key);
      if (log) sent += log.success;
      consultations.forEach(c => {
        if (isSendLinkEventRow(c) && c.send_link_date === key) pending += 1;
      });
      (appointments || []).forEach(a => {
        if ((a.status === 'scheduled' || a.status === 'confirmed') && a.appointment_date === key) appts += 1;
      });
    });
    return { sent, pending, appts };
  };

  const getEventsForDate = (date: Date) => {
    const events: { type: 'first' | 'sendLink' | 'appointment'; schedule?: ConsultationSchedule & { client_name: string }; client?: Client; appointment?: typeof appointments[0] }[] = [];

    activeClients
      .filter(c => {
        if (!c.first_consultation_date) return false;
        if (!isSameDay(parseISO(c.first_consultation_date), date)) return false;
        const hasAppointment = (appointments || []).some(
          apt => apt.client_id === c.id && apt.appointment_date === format(date, 'yyyy-MM-dd')
        );
        return !hasAppointment;
      })
      .forEach(client => {
        events.push({ type: 'first', client });
      });

    (appointments || [])
      .filter(apt =>
        (apt.status === 'scheduled' || apt.status === 'confirmed') &&
        apt.appointment_date === format(date, 'yyyy-MM-dd')
      )
      .forEach(apt => {
        events.push({ type: 'appointment', appointment: apt });
      });

    consultations
      .filter(c => isSendLinkEventRow(c) && isSameDay(parseISO(c.send_link_date), date))
      .forEach(schedule => {
        events.push({ type: 'sendLink', schedule });
      });

    return events;
  };

  const handleSendBookingLink = async (id: string) => {
    try {
      setIsSending(true);
      toast.loading('Enviando link de agendamento...');
      const { error } = await supabase.functions.invoke('send-booking-link', {
        body: { consultationScheduleId: id },
      });
      toast.dismiss();
      if (error) throw error;
      toast.success('Link de agendamento enviado via WhatsApp!');
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Erro ao enviar link. Configure o agendamento primeiro.');
    } finally {
      setIsSending(false);
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
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                <span className="truncate">Calendário de Consultas</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Acompanhe o pipeline de envios, agendamentos e consultas
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 sm:overflow-visible">
              <Button asChild size="sm" variant="outline" className="gap-1 shrink-0">
                <Link to="/scheduling/audit">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Auditoria</span>
                  <span className="sm:hidden text-xs">Audit</span>
                </Link>
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Tarefa</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Tarefa de Envio</DialogTitle>
                    <DialogDescription>
                      Adicione uma tarefa de envio de link para um atleta.
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
                      <label className="text-sm font-medium">Data de envio</label>
                      <Calendar
                        mode="single"
                        selected={newScheduleDate}
                        onSelect={setNewScheduleDate}
                        locale={ptBR}
                        className="rounded-md border pointer-events-auto mx-auto"
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
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setIsManualBookingOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Agendar</span>
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 h-auto sm:max-w-2xl gap-0.5 sm:gap-1">
              <TabsTrigger value="pipeline" className="flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 px-1 sm:px-3 text-[10px] sm:text-sm">
                <LayoutList className="h-4 w-4" />
                <span>Pipeline</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 px-1 sm:px-3 text-[10px] sm:text-sm">
                <CalendarDays className="h-4 w-4" />
                <span>Mensal</span>
              </TabsTrigger>
              <TabsTrigger value="periodicity" className="flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 px-1 sm:px-3 text-[10px] sm:text-sm">
                <Activity className="h-4 w-4" />
                <span>Frequência</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 px-1 sm:px-3 text-[10px] sm:text-sm">
                <History className="h-4 w-4" />
                <span>Histórico</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab: Pipeline (NEW DEFAULT) */}
            <TabsContent value="pipeline" className="mt-4">
              <WeeklyPipelineView
                consultations={consultations}
                clients={allClients}
                appointments={appointments}
                onSendLink={handleSendBookingLink}
                onMarkAsSent={handleMarkAsSent}
                isSending={isSending}
              />
            </TabsContent>

            {/* Tab: Periodicity Control */}
            <TabsContent value="periodicity" className="mt-4">
              <PeriodicityControlView />
            </TabsContent>

            {/* Tab: Calendar View */}
            <TabsContent value="calendar" className="mt-4">
              <Card className="border-border bg-card">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
                    <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Visão Mensal
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Consultas agendadas, tarefas de envio e primeiras consultas
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-4 lg:p-6">
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setCurrentMonth(new Date());
                          setSelectedAgendaDay(new Date());
                        }}
                      >
                        Hoje
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mb-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500" />
                      <span className="text-muted-foreground">Consulta Agendada</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-primary/20 border border-primary" />
                      <span className="text-muted-foreground">1ª Consulta</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500" />
                      <span className="text-muted-foreground">Enviar Link</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span className="text-muted-foreground">Link enviado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-3 w-3 text-destructive" />
                      <span className="text-muted-foreground">Falha no envio</span>
                    </div>
                  </div>

                  {/* Calendar Grid with weekly summary column */}
                  <TooltipProvider delayDuration={150}>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[1fr_64px] bg-muted/50">
                      <div className="grid grid-cols-7">
                        {weekDays.map(day => (
                          <div key={day} className="p-2 text-center text-xs font-semibold text-foreground border-b border-border">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="p-2 text-center text-[10px] font-semibold text-foreground border-b border-l border-border uppercase tracking-wide">
                        Semana
                      </div>
                    </div>
                    {calendarWeeks.map((week, weekIdx) => {
                      const stats = getWeekStats(week);
                      return (
                        <div key={`week-${weekIdx}`} className="grid grid-cols-[1fr_64px]">
                          <div className="grid grid-cols-7">
                            {week.map((day, index) => {
                              const events = getEventsForDate(day);
                              const isCurrentMonth = isSameMonth(day, currentMonth);
                              const isToday = isSameDay(day, new Date());
                              const dayKey = format(day, 'yyyy-MM-dd');
                              const dayLogs = logsByDay.get(dayKey);
                              const isMonday = getDay(day) === 1;

                              return (
                                <div
                                  key={day.toISOString()}
                                  onClick={() => {
                                    setSelectedAgendaDay(day);
                                    const dayEvents = getEventsForDate(day);
                                    const hasLinks = dayEvents.some(e => e.type === 'sendLink');
                                    if (hasLinks) setLinkDialogDay(day);
                                  }}
                                  className={cn(
                                    "min-h-[100px] sm:min-h-[120px] p-1 sm:p-2 border-b border-r border-border relative cursor-pointer hover:bg-muted/50 transition-colors",
                                    !isCurrentMonth && "bg-muted/30",
                                    isToday && "bg-primary/5",
                                    isMonday && isCurrentMonth && "bg-amber-500/5",
                                    isSameDay(day, selectedAgendaDay) && "ring-2 ring-primary ring-inset",
                                    index === 0 && "border-l-0",
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className={cn(
                                      "text-sm font-medium",
                                      !isCurrentMonth && "text-muted-foreground/50",
                                      isToday && "text-primary font-bold"
                                    )}>
                                      {format(day, 'd')}
                                    </div>
                                    {dayLogs && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                            {dayLogs.success > 0 && (
                                              <span className="flex items-center text-[10px] text-emerald-600 font-semibold">
                                                <Check className="h-3 w-3" />{dayLogs.success}
                                              </span>
                                            )}
                                            {dayLogs.failed > 0 && (
                                              <span className="flex items-center text-[10px] text-destructive font-semibold">
                                                <XCircle className="h-3 w-3" />{dayLogs.failed}
                                              </span>
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                          <div className="space-y-1 text-xs">
                                            <p className="font-semibold">Envios em {format(day, 'dd/MM')}</p>
                                            <p>✅ {dayLogs.success} enviado{dayLogs.success !== 1 ? 's' : ''}</p>
                                            {dayLogs.failed > 0 && <p>❌ {dayLogs.failed} falha{dayLogs.failed !== 1 ? 's' : ''}</p>}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                            <div className="space-y-1 overflow-y-auto max-h-[70px] sm:max-h-[85px]">
                              {events.map((event) => {
                                if (event.type === 'appointment' && event.appointment) {
                                  const apt = event.appointment;
                                  const clientName = typeof apt.client?.name === 'string' ? apt.client.name : 'Cliente';
                                  return (
                                    <Popover key={`apt-${apt.id}`}>
                                      <PopoverTrigger asChild>
                                        <div className="text-[10px] sm:text-xs p-1 rounded bg-emerald-500/20 border border-emerald-500/30 text-foreground truncate cursor-pointer hover:bg-emerald-500/30 transition-colors">
                                          <CalendarCheck2 className="h-2.5 w-2.5 inline mr-0.5" />
                                          {apt.appointment_time?.substring(0, 5)} {clientName}
                                        </div>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-72 p-3" align="start">
                                        <div className="space-y-3">
                                          <div>
                                            <p className="font-medium text-sm">{clientName}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {format(parseISO(apt.appointment_date), "dd/MM/yyyy")} • {apt.appointment_time?.substring(0, 5)}
                                            </p>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                                              <Link to={`/appointments/${apt.id}`}>Detalhes</Link>
                                            </Button>
                                            <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                                              <Link to={`/clients?search=${encodeURIComponent(clientName)}`}>Ver atleta</Link>
                                            </Button>
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  );
                                }

                                if (event.type === 'first' && event.client) {
                                  return (
                                    <div
                                      key={`first-${event.client.id}`}
                                      className="text-[10px] sm:text-xs p-1 rounded bg-primary/20 border border-primary/30 text-foreground truncate"
                                      title={`1ª Consulta: ${event.client.name}`}
                                    >
                                      <span className="hidden sm:inline">1ª </span>
                                      {event.client.name}
                                    </div>
                                  );
                                }

                                if (event.type === 'sendLink' && event.schedule) {
                                  const consultNum = getConsultationNumber(event.schedule);
                                  return (
                                    <div
                                      key={`link-${event.schedule.id}`}
                                      className="text-[10px] sm:text-xs p-1 rounded bg-amber-500/20 border border-amber-500/30 text-foreground truncate"
                                      title={`Enviar Link: ${event.schedule.client_name}`}
                                    >
                                      <Send className="h-2.5 w-2.5 inline mr-0.5" />
                                      <span className="hidden sm:inline">
                                        {event.schedule.client_name}
                                        {consultNum && ` ${consultNum.current}/${consultNum.total}`}
                                      </span>
                                      <span className="sm:hidden">{event.schedule.client_name.split(' ')[0]}</span>
                                    </div>
                                  );
                                }

                                return null;
                              })}
                            </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Weekly summary sidebar cell */}
                          <div className="border-b border-l border-border bg-muted/20 p-1.5 flex flex-col items-center justify-center text-[10px] gap-0.5">
                            {stats.sent > 0 && (
                              <span className="flex items-center gap-0.5 text-emerald-600 font-semibold" title={`${stats.sent} link(s) enviado(s)`}>
                                <Check className="h-3 w-3" />{stats.sent}
                              </span>
                            )}
                            {stats.pending > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-600 font-semibold" title={`${stats.pending} envio(s) pendente(s)`}>
                                <Send className="h-3 w-3" />{stats.pending}
                              </span>
                            )}
                            {stats.appts > 0 && (
                              <span className="flex items-center gap-0.5 text-primary font-semibold" title={`${stats.appts} consulta(s)`}>
                                <CalendarCheck2 className="h-3 w-3" />{stats.appts}
                              </span>
                            )}
                            {stats.sent === 0 && stats.pending === 0 && stats.appts === 0 && (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
              {/* Day Agenda Panel - visible on calendar tab */}
              {activeTab === 'calendar' && (
                <div className="mt-4">
                  <DayAgendaPanel
                    date={selectedAgendaDay}
                    appointments={appointments}
                    scheduledLinks={consultations}
                    onOpenLinkDialog={() => {
                      const dayEvents = getEventsForDate(selectedAgendaDay);
                      const hasLinks = dayEvents.some(e => e.type === 'sendLink');
                      if (hasLinks) {
                        setLinkDialogDay(selectedAgendaDay);
                      }
                    }}
                  />
                </div>
              )}

              {/* Link Schedule Edit Dialog */}
              <LinkScheduleEditDialog
                open={!!linkDialogDay}
                onOpenChange={(open) => !open && setLinkDialogDay(null)}
                selectedDate={linkDialogDay}
                schedules={consultations}
                allSchedules={consultations}
                clients={allClients}
              />
            </TabsContent>

            {/* Tab: History */}
            <TabsContent value="history" className="mt-4">
              <ConsultationHistoryView
                consultations={consultations}
                clients={allClients}
              />
            </TabsContent>
          </Tabs>

          <ManualBookingDialog
            open={isManualBookingOpen}
            onOpenChange={setIsManualBookingOpen}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['appointments'] });
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
