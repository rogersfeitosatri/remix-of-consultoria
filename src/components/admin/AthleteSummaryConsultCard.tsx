import { useState } from 'react';
import { differenceInDays, parseISO, format, isPast, isToday, addMonths, addWeeks, nextMonday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CalendarCheck, Clock, Video, Calendar, Edit2, Save, X, 
  ListTodo, CheckCircle2, Send, Link2, AlertTriangle, ChevronDown, ChevronUp,
  Plus, Trash2, RefreshCw, Pencil, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { useConsultationStats } from '@/hooks/useAthleteSummary';
import { Client } from '@/hooks/useClients';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface AthleteSummaryConsultCardProps {
  client: Client;
  adminNotesShort: string | null;
  onSaveNotes: (notes: string | null) => void;
  isSaving?: boolean;
}

interface AppointmentRow {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  google_meet_link: string | null;
  notes_admin: string | null;
}

interface ScheduleRow {
  id: string;
  scheduled_date: string;
  send_link_date: string;
  status: string;
  scheduled_time: string | null;
}

export function AthleteSummaryConsultCard({ 
  client, 
  adminNotesShort, 
  onSaveNotes,
  isSaving 
}: AthleteSummaryConsultCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: stats, isLoading } = useConsultationStats(client.id);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(adminNotesShort || '');
  const [showHistory, setShowHistory] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [showAddConsult, setShowAddConsult] = useState(false);
  const [newConsultDate, setNewConsultDate] = useState('');
  const [isSendingLink, setIsSendingLink] = useState<string | null>(null);

  // All appointments for this athlete
  const { data: appointments = [] } = useQuery({
    queryKey: ['athlete-appointments', client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, appointment_date, appointment_time, status, google_meet_link, notes_admin')
        .eq('client_id', client.id)
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      return (data || []) as AppointmentRow[];
    },
  });

  // Consultation schedules (link pipeline)
  const { data: schedules = [] } = useQuery({
    queryKey: ['athlete-consultation-schedules', client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultation_schedules')
        .select('id, scheduled_date, send_link_date, status, scheduled_time')
        .eq('client_id', client.id)
        .order('send_link_date', { ascending: true });
      if (error) throw error;
      return (data || []) as ScheduleRow[];
    },
  });

  // Pending tasks count
  const { data: pendingTasksCount = 0 } = useQuery({
    queryKey: ['athlete-pending-tasks', client.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .in('status', ['pending', 'in_progress']);
      if (error) throw error;
      return count || 0;
    },
  });

  // Meal plan status
  const { data: mealPlanStatus } = useQuery({
    queryKey: ['athlete-meal-plan-status', client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plan_status')
        .select('status, sent_at')
        .eq('client_id', client.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Mutations for pipeline management
  const updateScheduleDateMutation = useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: string }) => {
      const { error } = await supabase
        .from('consultation_schedules')
        .update({ send_link_date: newDate, scheduled_date: newDate, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules', client.id] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      setEditingScheduleId(null);
      toast.success('Data atualizada');
    },
    onError: () => toast.error('Erro ao atualizar data'),
  });

  const addConsultationMutation = useMutation({
    mutationFn: async (sendLinkDate: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('consultation_schedules')
        .insert({
          client_id: client.id,
          user_id: user.id,
          scheduled_date: sendLinkDate,
          send_link_date: sendLinkDate,
          status: 'pending',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules', client.id] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      setShowAddConsult(false);
      setNewConsultDate('');
      toast.success('Consulta adicionada à pipeline');
    },
    onError: () => toast.error('Erro ao adicionar consulta'),
  });

  const removeConsultationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consultation_schedules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules', client.id] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      toast.success('Consulta removida');
    },
    onError: () => toast.error('Erro ao remover consulta'),
  });

  const handleResendLink = async (scheduleId: string) => {
    try {
      setIsSendingLink(scheduleId);
      toast.loading('Enviando link...');
      const { error } = await supabase.functions.invoke('send-booking-link', {
        body: { consultationScheduleId: scheduleId },
      });
      toast.dismiss();
      if (error) throw error;
      toast.success('Link de agendamento enviado!');
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules', client.id] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Erro ao enviar link');
    } finally {
      setIsSendingLink(null);
    }
  };

  const today = new Date();
  const completedAppointments = appointments.filter(a => a.status === 'completed');
  const upcomingAppointments = appointments.filter(a => 
    ['scheduled', 'confirmed'].includes(a.status) && !isPast(parseISO(a.appointment_date))
  );
  const nextAppointment = upcomingAppointments.length > 0 
    ? upcomingAppointments[upcomingAppointments.length - 1] 
    : null;

  // Pipeline: future/pending schedules
  const pendingSchedules = schedules.filter(s => ['pending', 'sent', 'link_sent'].includes(s.status));
  const scheduledSchedules = schedules.filter(s => s.status === 'scheduled');
  const completedSchedules = schedules.filter(s => s.status === 'completed');

  // Last completed consultation date (from appointments)
  const lastCompletedAppointment = completedAppointments.length > 0 ? completedAppointments[0] : null;
  const lastConsultDate = lastCompletedAppointment?.appointment_date || stats?.lastCompletedAt || null;

  // Next send link date from pipeline
  const nextPendingSchedule = pendingSchedules.length > 0 ? pendingSchedules[0] : null;

  // Determine consultation frequency label
  const frequencyLabel = client.consultation_frequency === 'six_weeks' 
    ? 'a cada 6 semanas' 
    : client.consultation_frequency === 'monthly' 
      ? 'mensal' 
      : 'única';
  
  const daysSinceLastConsult = lastConsultDate
    ? differenceInDays(today, parseISO(lastConsultDate))
    : null;
  const daysUntilNextSend = nextPendingSchedule
    ? differenceInDays(parseISO(nextPendingSchedule.send_link_date), today)
    : null;

  const handleSave = () => {
    onSaveNotes(notes.trim() || null);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setNotes(adminNotesShort || '');
    setIsEditing(false);
  };

  const getScheduleStatusBadge = (status: string, sendDate: string) => {
    const sendDateParsed = parseISO(sendDate);
    const isOverdue = isPast(sendDateParsed) && !isToday(sendDateParsed) && status === 'pending';

    switch (status) {
      case 'completed':
        return <Badge className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Realizada</Badge>;
      case 'scheduled':
        return <Badge className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">Agendada</Badge>;
      case 'sent':
      case 'link_sent':
        return <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">Link Enviado</Badge>;
      case 'pending':
        if (isOverdue) {
          return <Badge className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20">Atrasado</Badge>;
        }
        return <Badge variant="secondary" className="text-[10px]">Pendente</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };
  
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Consultas & Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Consultas & Tarefas
          </CardTitle>
          <div className="flex gap-1.5">
            {pendingTasksCount > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <ListTodo className="h-3 w-3" />
                {pendingTasksCount}
              </Badge>
            )}
            {client.has_consultations && client.consultation_count > 0 && (
              <Badge variant="outline" className="text-xs">
                {completedAppointments.length}/{client.consultation_count}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Última
            </p>
            <p className="text-sm font-medium">
              {lastConsultDate
                ? format(parseISO(lastConsultDate), "dd/MM/yy", { locale: ptBR })
                : '—'}
            </p>
            {daysSinceLastConsult !== null && (
              <p className="text-xs text-muted-foreground">há {daysSinceLastConsult}d</p>
            )}
          </div>
          
          <div className="p-2.5 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              <Send className="h-3 w-3" /> Próx. envio
            </p>
            <p className="text-sm font-medium">
              {nextPendingSchedule
                ? format(parseISO(nextPendingSchedule.send_link_date), "dd/MM/yy", { locale: ptBR })
                : '—'}
            </p>
            {daysUntilNextSend !== null && daysUntilNextSend >= 0 && (
              <p className="text-xs text-muted-foreground">em {daysUntilNextSend}d</p>
            )}
            {daysUntilNextSend !== null && daysUntilNextSend < 0 && (
              <p className="text-xs text-destructive">atrasado {Math.abs(daysUntilNextSend)}d</p>
            )}
          </div>
        </div>

        {/* Google Meet for next appointment */}
        {nextAppointment?.google_meet_link && (
          <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs" asChild>
            <a href={nextAppointment.google_meet_link} target="_blank" rel="noopener noreferrer">
              <Video className="h-3 w-3" />
              Abrir Google Meet
            </a>
          </Button>
        )}

        {/* Pipeline de Links (Scheduled Consultations) */}
        {client.has_consultations && (
          <Collapsible open={showPipeline} onOpenChange={setShowPipeline}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs px-2.5">
                <span className="flex items-center gap-1.5">
                  <Send className="h-3 w-3 text-primary" />
                  Pipeline de Consultas
                  {schedules.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      {completedSchedules.length}/{schedules.length}
                    </Badge>
                  )}
                </span>
                {showPipeline ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5">
              {/* Plan context */}
              <div className="p-2 rounded-md bg-muted/30 border border-border mb-2 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{client.consultation_count}</span> consulta{client.consultation_count > 1 ? 's' : ''} no plano ({frequencyLabel})
                </p>
                {completedSchedules.length > 0 && (
                  <p className="mt-0.5">
                    ✅ {completedSchedules.length} realizada{completedSchedules.length > 1 ? 's' : ''} · 
                    {pendingSchedules.length > 0 
                      ? ` 📅 ${pendingSchedules.length} pendente${pendingSchedules.length > 1 ? 's' : ''}` 
                      : ' Todas concluídas'}
                  </p>
                )}
              </div>

              {schedules.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-md">
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                  <p>Nenhum cronograma gerado.</p>
                  <p className="text-[10px] mt-0.5">Edite o cadastro do atleta para gerar o pipeline.</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-[260px] overflow-y-auto">
                  {schedules.map((schedule, index) => {
                    const isEditingThis = editingScheduleId === schedule.id;
                    const canManage = ['pending', 'sent', 'link_sent'].includes(schedule.status);
                    const canResend = ['pending', 'sent', 'link_sent'].includes(schedule.status);

                    return (
                      <div 
                        key={schedule.id}
                        className={cn(
                          "p-2 rounded-md text-xs border",
                          schedule.status === 'completed' && "bg-emerald-500/5 border-emerald-500/20",
                          schedule.status === 'scheduled' && "bg-blue-500/5 border-blue-500/20",
                          ['sent', 'link_sent'].includes(schedule.status) && "bg-amber-500/5 border-amber-500/20",
                          schedule.status === 'pending' && isPast(parseISO(schedule.send_link_date)) && !isToday(parseISO(schedule.send_link_date))
                            ? "bg-red-500/5 border-red-500/20"
                            : schedule.status === 'pending' && "bg-muted/30 border-border",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-muted-foreground font-mono w-4 text-center shrink-0">{index + 1}</span>
                            {isEditingThis ? (
                              <div className="flex items-center gap-1 flex-1">
                                <Input
                                  type="date"
                                  value={editDate}
                                  onChange={e => setEditDate(e.target.value)}
                                  className="h-6 text-xs w-[120px]"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => {
                                    if (editDate) updateScheduleDateMutation.mutate({ id: schedule.id, newDate: editDate });
                                  }}
                                  disabled={updateScheduleDateMutation.isPending}
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => setEditingScheduleId(null)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {schedule.status === 'completed' 
                                    ? format(parseISO(schedule.scheduled_date), "dd/MM/yy")
                                    : `Envio: ${format(parseISO(schedule.send_link_date), "dd/MM/yy")}`
                                  }
                                </p>
                                {schedule.scheduled_time && (
                                  <p className="text-muted-foreground text-[10px]">{schedule.scheduled_time.slice(0, 5)}</p>
                                )}
                                {schedule.status === 'pending' && !isPast(parseISO(schedule.send_link_date)) && (
                                  <p className="text-muted-foreground text-[10px]">em {differenceInDays(parseISO(schedule.send_link_date), today)}d</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {getScheduleStatusBadge(schedule.status, schedule.send_link_date)}
                          </div>
                        </div>
                        {/* Action buttons for manageable schedules */}
                        {canManage && !isEditingThis && (
                          <div className="flex items-center gap-1 mt-1.5 pl-6">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingScheduleId(schedule.id);
                                setEditDate(schedule.send_link_date);
                              }}
                            >
                              <Pencil className="h-2.5 w-2.5" />
                              Editar
                            </Button>
                            {canResend && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => handleResendLink(schedule.id)}
                                disabled={isSendingLink === schedule.id}
                              >
                                <Send className="h-2.5 w-2.5" />
                                {schedule.status === 'pending' ? 'Enviar' : 'Reenviar'}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] gap-1 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm('Remover esta consulta da pipeline?')) {
                                  removeConsultationMutation.mutate(schedule.id);
                                }
                              }}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add consultation button */}
              {!showAddConsult ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-[10px] gap-1 mt-1 text-muted-foreground"
                  onClick={() => setShowAddConsult(true)}
                >
                  <Plus className="h-3 w-3" />
                  Adicionar consulta
                </Button>
              ) : (
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    type="date"
                    value={newConsultDate}
                    onChange={e => setNewConsultDate(e.target.value)}
                    className="h-7 text-xs flex-1"
                    placeholder="Data de envio"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={() => {
                      if (newConsultDate) addConsultationMutation.mutate(newConsultDate);
                    }}
                    disabled={!newConsultDate || addConsultationMutation.isPending}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5"
                    onClick={() => { setShowAddConsult(false); setNewConsultDate(''); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Histórico de Consultas Realizadas */}
        {completedAppointments.length > 0 && (
          <Collapsible open={showHistory} onOpenChange={setShowHistory}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs px-2.5">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Consultas Realizadas
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {completedAppointments.length}
                  </Badge>
                </span>
                {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5">
              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                {completedAppointments.map((apt) => (
                  <div 
                    key={apt.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      <div>
                        <p className="font-medium">
                          {format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-muted-foreground text-[10px]">
                          {apt.appointment_time.slice(0, 5)}
                        </p>
                      </div>
                    </div>
                    {apt.notes_admin && (
                      <span className="text-muted-foreground truncate max-w-[100px]" title={apt.notes_admin}>
                        {apt.notes_admin}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <Separator />

        {/* Meal plan status */}
        {(client.service_type === 'nutrition' || client.service_type === 'both') && (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
            <span className="text-xs text-muted-foreground">Plano Alimentar</span>
            <Badge 
              variant={mealPlanStatus?.status === 'sent' ? 'default' : 'secondary'}
              className={cn(
                "text-xs",
                mealPlanStatus?.status === 'sent' && 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              )}
            >
              {mealPlanStatus?.status === 'sent' 
                ? `Enviado ${mealPlanStatus.sent_at ? format(parseISO(mealPlanStatus.sent_at), 'dd/MM', { locale: ptBR }) : ''}`
                : mealPlanStatus?.status === 'pending' 
                  ? 'Pendente' 
                  : 'Não criado'}
            </Badge>
          </div>
        )}
        
        {/* Observações rápidas */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Observações</span>
            {!isEditing && (
              <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-1.5">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações rápidas..."
                className="min-h-[50px] text-xs"
              />
              <div className="flex gap-1.5">
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1 h-7 text-xs">
                  <Save className="h-3 w-3" /> Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving} className="h-7">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded min-h-[32px] whitespace-pre-wrap">
              {adminNotesShort || 'Sem observações'}
            </p>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1 text-xs h-8"
            onClick={() => navigate('/calendar')}
          >
            <Calendar className="h-3 w-3" />
            Agenda
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1 text-xs h-8"
            onClick={() => navigate('/tasks')}
          >
            <ListTodo className="h-3 w-3" />
            Tarefas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
