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
  link_sent_at: string | null;
  confirmed_at: string | null;
  confirmation_status: string | null;
  appointment_id: string | null;
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
  const [showConfirmConsult1, setShowConfirmConsult1] = useState(false);
  const [confirmConsult1Date, setConfirmConsult1Date] = useState(format(new Date(), 'yyyy-MM-dd'));
  // Edit state for completed appointments (history)
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [editAptDate, setEditAptDate] = useState('');
  const [editAptTime, setEditAptTime] = useState('');
  const [editAptNotes, setEditAptNotes] = useState('');

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
        .select('id, scheduled_date, send_link_date, status, scheduled_time, link_sent_at, confirmed_at, confirmation_status, appointment_id')
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

  // State for confirming overdue consultations
  const [confirmingOverdueId, setConfirmingOverdueId] = useState<string | null>(null);
  const [overdueConfirmDate, setOverdueConfirmDate] = useState('');

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

  // Confirm overdue consultation - marks schedule as completed and creates appointment record
  const confirmOverdueConsultationMutation = useMutation({
    mutationFn: async ({ scheduleId, consultDate, wasRealized }: { scheduleId: string; consultDate: string; wasRealized: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      if (wasRealized) {
        // 1. Mark schedule as completed
        const { error: schedError } = await supabase
          .from('consultation_schedules')
          .update({ 
            status: 'completed', 
            scheduled_date: consultDate,
            confirmed_at: new Date().toISOString(),
            confirmation_status: 'realizada',
            updated_at: new Date().toISOString() 
          })
          .eq('id', scheduleId);
        if (schedError) throw schedError;

        // 2. Check if appointment already exists for this date
        const { data: existingApt } = await supabase
          .from('appointments')
          .select('id')
          .eq('client_id', client.id)
          .eq('appointment_date', consultDate)
          .in('status', ['completed', 'confirmed', 'scheduled'])
          .maybeSingle();

        // 3. Create completed appointment if none exists
        if (!existingApt) {
          const { data: newApt, error: aptError } = await supabase
            .from('appointments')
            .insert({
              client_id: client.id,
              user_id: user.id,
              appointment_date: consultDate,
              appointment_time: '09:00',
              duration_minutes: 60,
              status: 'completed',
              notes_admin: 'Consulta confirmada manualmente (retroativa)',
              timezone: 'America/Fortaleza',
            })
            .select('id')
            .single();
          if (aptError) throw aptError;
          
          // Link appointment to schedule
          await supabase
            .from('consultation_schedules')
            .update({ appointment_id: newApt.id })
            .eq('id', scheduleId);
        } else {
          await supabase
            .from('appointments')
            .update({ status: 'completed' })
            .eq('id', existingApt.id);
          await supabase
            .from('consultation_schedules')
            .update({ appointment_id: existingApt.id })
            .eq('id', scheduleId);
        }
      } else {
        // Mark as not realized
        const { error } = await supabase
          .from('consultation_schedules')
          .update({ 
            status: 'completed', 
            confirmed_at: new Date().toISOString(),
            confirmation_status: 'nao_realizada',
            updated_at: new Date().toISOString() 
          })
          .eq('id', scheduleId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules', client.id] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-appointments', client.id] });
      setConfirmingOverdueId(null);
      setOverdueConfirmDate('');
      toast.success('Consulta atualizada com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar consulta'),
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

  // Update completed appointment (date/time/notes)
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, date, time, notes }: { id: string; date: string; time: string; notes: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: date,
          appointment_time: time.length === 5 ? `${time}:00` : time,
          notes_admin: notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-appointments', client.id] });
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules', client.id] });
      setEditingAptId(null);
      toast.success('Consulta atualizada');
    },
    onError: (e: any) => toast.error('Erro ao atualizar: ' + (e?.message || '')),
  });

  // Delete completed appointment
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      // Unlink any schedule pointing to this appointment and revert to pending
      await supabase
        .from('consultation_schedules')
        .update({ appointment_id: null, status: 'pending', confirmed_at: null, confirmation_status: null })
        .eq('appointment_id', id);
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-appointments', client.id] });
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules', client.id] });
      toast.success('Consulta excluída');
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + (e?.message || '')),
  });

  // Confirm consultation 1 and generate remaining pipeline
  const confirmAndGeneratePipelineMutation = useMutation({
    mutationFn: async (anchorDate: string) => {
      if (!user) throw new Error('Not authenticated');
      const totalConsultations = client.consultation_count || 1;
      const frequency = client.consultation_frequency as 'once' | 'monthly' | 'six_weeks';
      const planEndDate = parseISO(client.end_date);
      const anchor = parseISO(anchorDate);

      // Only consider schedules from the current plan period (ignore previous cycles)
      const planStartStr = client.start_date || null;
      const currentPlanSchedules = schedules.filter(
        s => !planStartStr || (s.scheduled_date && s.scheduled_date >= planStartStr)
      );

      // 1. Mark existing first schedule as completed, or create one
      const existingFirst = currentPlanSchedules.find(s => s.status === 'pending');
      if (existingFirst) {
        await supabase
          .from('consultation_schedules')
          .update({ status: 'completed', scheduled_date: anchorDate, send_link_date: anchorDate, updated_at: new Date().toISOString() })
          .eq('id', existingFirst.id);
      } else {
        await supabase
          .from('consultation_schedules')
          .insert({
            client_id: client.id,
            user_id: user.id,
            scheduled_date: anchorDate,
            send_link_date: anchorDate,
            status: 'completed',
          });
      }

      // 2. Generate remaining schedules
      const existingCompleted = currentPlanSchedules.filter(s => s.status === 'completed').length;
      const alreadyCompletedCount = existingCompleted + (existingFirst ? 0 : 1); // +1 for the one we just created/updated
      const remaining = totalConsultations - alreadyCompletedCount;
      
      if (remaining <= 0 || frequency === 'once') return;

      const newSchedules: Array<{ client_id: string; user_id: string; scheduled_date: string; send_link_date: string; status: string }> = [];
      let currentBase = anchor;

      for (let i = 0; i < remaining; i++) {
        const intervalEnd = frequency === 'six_weeks'
          ? addWeeks(currentBase, 6)
          : addMonths(currentBase, 1);
        
        const sendDate = nextMonday(intervalEnd);
        
        if (sendDate > planEndDate) break;

        newSchedules.push({
          client_id: client.id,
          user_id: user.id,
          scheduled_date: format(sendDate, 'yyyy-MM-dd'),
          send_link_date: format(sendDate, 'yyyy-MM-dd'),
          status: 'pending',
        });

        currentBase = intervalEnd;
      }

      // Delete any remaining pending schedules that aren't the first one
      const pendingIds = currentPlanSchedules
        .filter(s => ['pending', 'sent', 'link_sent'].includes(s.status) && s.id !== existingFirst?.id)
        .map(s => s.id);
      
      if (pendingIds.length > 0) {
        await supabase
          .from('consultation_schedules')
          .delete()
          .in('id', pendingIds);
      }

      if (newSchedules.length > 0) {
        const { error } = await supabase
          .from('consultation_schedules')
          .insert(newSchedules);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules', client.id] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-appointments', client.id] });
      toast.success('Consulta 1 confirmada e pipeline gerado!');
      setShowConfirmConsult1(false);
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const handleResendLink = async (scheduleId: string) => {
    try {
      setIsSendingLink(scheduleId);
      toast.loading('Enviando link...');
      const { data, error } = await supabase.functions.invoke('send-booking-link', {
        body: {
          consultationScheduleId: scheduleId,
          messageType: 'booking_invite',
          triggeredBy: 'manual_admin',
        },
      });
      toast.dismiss();
      if (error) throw error;
      if (data?.blocked) {
        toast.warning(`Envio bloqueado: ${data.reason || 'desconhecido'}`);
      } else if (data?.success) {
        toast.success('Link de agendamento enviado!');
      } else {
        toast.error(data?.error || 'Falha ao enviar link');
      }
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

  // Scope schedules/appointments to the CURRENT plan period so that, after a
  // renewal (which advances start_date), the pipeline resets: consultations from
  // the previous plan cycle no longer count. This also re-enables the manual
  // "Confirmar Consulta 1" flow, which is hidden while completed schedules exist.
  const planStart = client.start_date || null;
  const inCurrentPlan = (dateStr?: string | null) => !planStart || (!!dateStr && dateStr >= planStart);

  const planSchedules = schedules.filter(s => inCurrentPlan(s.scheduled_date));
  const planAppointments = appointments.filter(a => inCurrentPlan(a.appointment_date));

  const completedAppointments = planAppointments.filter(a => a.status === 'completed');
  const upcomingAppointments = planAppointments.filter(a =>
    ['scheduled', 'confirmed'].includes(a.status) && !isPast(parseISO(a.appointment_date))
  );
  const nextAppointment = upcomingAppointments.length > 0
    ? upcomingAppointments[upcomingAppointments.length - 1]
    : null;

  // Pipeline: future/pending schedules (scoped to the current plan)
  const pendingSchedules = planSchedules.filter(s => ['pending', 'sent', 'link_sent'].includes(s.status));
  const scheduledSchedules = planSchedules.filter(s => s.status === 'scheduled');
  const completedSchedules = planSchedules.filter(s => s.status === 'completed' && s.confirmation_status !== 'nao_realizada');
  const notRealizedSchedules = planSchedules.filter(s => s.confirmation_status === 'nao_realizada');

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

  const getScheduleStatusBadge = (schedule: ScheduleRow) => {
    const { status, send_link_date, confirmation_status } = schedule;
    const sendDateParsed = parseISO(send_link_date);
    const isOverdue = isPast(sendDateParsed) && !isToday(sendDateParsed) && status === 'pending';

    if (status === 'completed' && confirmation_status === 'nao_realizada') {
      return <Badge className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20">Não Realizada</Badge>;
    }
    if (status === 'completed') {
      return <Badge className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Confirmada ✓</Badge>;
    }
    if (status === 'scheduled') {
      return <Badge className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">Agendada</Badge>;
    }
    if (status === 'sent' || status === 'link_sent') {
      return <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">Link Enviado</Badge>;
    }
    if (status === 'pending' && isOverdue) {
      return <Badge className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20">Atrasado</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]">Pendente</Badge>;
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
                  {planSchedules.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      {completedSchedules.length}/{planSchedules.length}
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
                {(completedSchedules.length > 0 || notRealizedSchedules.length > 0) && (
                  <p className="mt-0.5">
                    {completedSchedules.length > 0 && `✅ ${completedSchedules.length} confirmada${completedSchedules.length > 1 ? 's' : ''}`}
                    {notRealizedSchedules.length > 0 && ` · ❌ ${notRealizedSchedules.length} não realizada${notRealizedSchedules.length > 1 ? 's' : ''}`}
                    {pendingSchedules.length > 0 
                      ? ` · 📅 ${pendingSchedules.length} pendente${pendingSchedules.length > 1 ? 's' : ''}` 
                      : completedSchedules.length + notRealizedSchedules.length >= (client.consultation_count || 0) ? ' · Todas concluídas' : ''}
                  </p>
                )}
              </div>

              {/* Show confirm + generate button when pipeline is incomplete */}
              {completedSchedules.length === 0 && planSchedules.length < (client.consultation_count || 1) && client.consultation_frequency !== 'once' && (
                <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Pipeline incompleto</p>
                      <p className="text-muted-foreground">
                        {planSchedules.length}/{client.consultation_count} consultas no cronograma. Confirme a consulta 1 para gerar as demais automaticamente.
                      </p>
                    </div>
                  </div>
                  {!showConfirmConsult1 ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-7 text-xs gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                      onClick={() => setShowConfirmConsult1(true)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Confirmar Consulta 1 e Gerar Pipeline
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-muted-foreground shrink-0">Data da consulta 1:</label>
                        <Input
                          type="date"
                          value={confirmConsult1Date}
                          onChange={e => setConfirmConsult1Date(e.target.value)}
                          className="h-7 text-xs flex-1"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <Button 
                          size="sm" 
                          className="flex-1 h-7 text-xs gap-1"
                          onClick={() => confirmAndGeneratePipelineMutation.mutate(confirmConsult1Date)}
                          disabled={confirmAndGeneratePipelineMutation.isPending || !confirmConsult1Date}
                        >
                          {confirmAndGeneratePipelineMutation.isPending ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Confirmar e Gerar
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => setShowConfirmConsult1(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {planSchedules.length === 0 && completedSchedules.length === 0 && (client.consultation_frequency === 'once' || (client.consultation_count || 0) <= 1) ? (
                <div className="p-3 text-center text-xs text-muted-foreground border border-dashed rounded-md">
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                  <p>Nenhum cronograma gerado.</p>
                  <p className="text-[10px] mt-0.5">Edite o cadastro do atleta para gerar o pipeline.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {/* Note: with action buttons, schedules need more vertical room */}
                  {planSchedules.map((schedule, index) => {
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
                              <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                                <Input
                                  type="date"
                                  value={editDate}
                                  onChange={e => setEditDate(e.target.value)}
                                  className="h-8 text-xs flex-1 min-w-[130px]"
                                />
                                <Button
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    if (editDate) updateScheduleDateMutation.mutate({ id: schedule.id, newDate: editDate });
                                  }}
                                  disabled={updateScheduleDateMutation.isPending}
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setEditingScheduleId(null)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {schedule.status === 'completed' 
                                    ? `${format(parseISO(schedule.scheduled_date), "dd/MM/yy")}${schedule.confirmation_status === 'nao_realizada' ? ' ✗' : ''}`
                                    : schedule.status === 'scheduled'
                                      ? format(parseISO(schedule.scheduled_date), "dd/MM/yy")
                                      : `Envio: ${format(parseISO(schedule.send_link_date), "dd/MM/yy")}`
                                  }
                                </p>
                                {schedule.link_sent_at && (
                                  <p className="text-muted-foreground text-[10px]">
                                    Link: {format(parseISO(schedule.link_sent_at), "dd/MM HH:mm")}
                                  </p>
                                )}
                                {schedule.scheduled_time && (
                                  <p className="text-muted-foreground text-[10px]">{schedule.scheduled_time.slice(0, 5)}</p>
                                )}
                                {schedule.confirmed_at && (
                                  <p className="text-muted-foreground text-[10px]">
                                    Confirmado: {format(parseISO(schedule.confirmed_at), "dd/MM/yy")}
                                  </p>
                                )}
                                {schedule.status === 'pending' && !isPast(parseISO(schedule.send_link_date)) && (
                                  <p className="text-muted-foreground text-[10px]">em {differenceInDays(parseISO(schedule.send_link_date), today)}d</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {getScheduleStatusBadge(schedule)}
                          </div>
                        </div>
                        {/* Overdue confirmation UI */}
                        {schedule.status === 'pending' && isPast(parseISO(schedule.send_link_date)) && !isToday(parseISO(schedule.send_link_date)) && (
                          confirmingOverdueId === schedule.id ? (
                            <div className="mt-2 space-y-2 p-2 rounded-md bg-background border border-border">
                              <p className="text-[11px] font-medium">Essa consulta foi realizada?</p>
                              <div>
                                <label className="text-[10px] text-muted-foreground">Data da consulta</label>
                                <Input
                                  type="date"
                                  value={overdueConfirmDate}
                                  onChange={e => setOverdueConfirmDate(e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-8 text-[11px] gap-1 px-2 bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => {
                                    if (overdueConfirmDate) {
                                      confirmOverdueConsultationMutation.mutate({
                                        scheduleId: schedule.id,
                                        consultDate: overdueConfirmDate,
                                        wasRealized: true,
                                      });
                                    }
                                  }}
                                  disabled={!overdueConfirmDate || confirmOverdueConsultationMutation.isPending}
                                >
                                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                                  <span className="truncate">Sim</span>
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 text-[11px] gap-1 px-2"
                                  onClick={() => {
                                    confirmOverdueConsultationMutation.mutate({
                                      scheduleId: schedule.id,
                                      consultDate: schedule.send_link_date,
                                      wasRealized: false,
                                    });
                                  }}
                                  disabled={confirmOverdueConsultationMutation.isPending}
                                >
                                  <X className="h-3 w-3 shrink-0" />
                                  <span className="truncate">Não</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-[11px]"
                                  onClick={() => { setConfirmingOverdueId(null); setOverdueConfirmDate(''); }}
                                >
                                  Voltar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-[11px] gap-1 px-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 col-span-2 sm:col-span-1"
                                onClick={() => {
                                  setConfirmingOverdueId(schedule.id);
                                  setOverdueConfirmDate(schedule.send_link_date);
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                <span className="truncate">Confirmar</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-[11px] gap-1 px-2"
                                onClick={() => {
                                  setEditingScheduleId(schedule.id);
                                  setEditDate(schedule.send_link_date);
                                }}
                              >
                                <Pencil className="h-3 w-3 shrink-0" />
                                <span className="truncate">Editar</span>
                              </Button>
                              {canResend && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-[11px] gap-1 px-2"
                                  onClick={() => handleResendLink(schedule.id)}
                                  disabled={isSendingLink === schedule.id}
                                >
                                  <Send className="h-3 w-3 shrink-0" />
                                  <span className="truncate">Enviar</span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-[11px] gap-1 px-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                  if (confirm('Remover esta consulta da pipeline?')) {
                                    removeConsultationMutation.mutate(schedule.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3 shrink-0" />
                                <span className="truncate sm:hidden">Excluir</span>
                              </Button>
                            </div>
                          )
                        )}
                        {/* Confirm realized for scheduled consultations whose date has passed */}
                        {schedule.status === 'scheduled' && schedule.appointment_id && isPast(parseISO(schedule.scheduled_date)) && !isToday(parseISO(schedule.scheduled_date)) && (
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-[11px] gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('appointments')
                                    .update({ status: 'completed' })
                                    .eq('id', schedule.appointment_id!);
                                  if (error) throw error;
                                  queryClient.invalidateQueries({ queryKey: ['athlete-consultation-schedules', client.id] });
                                  queryClient.invalidateQueries({ queryKey: ['athlete-appointments', client.id] });
                                  queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
                                  toast.success('Consulta confirmada como realizada!');
                                } catch {
                                  toast.error('Erro ao confirmar consulta');
                                }
                              }}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Confirmar Realizada
                            </Button>
                          </div>
                        )}
                        {/* Action buttons for non-overdue manageable schedules */}
                        {canManage && !isEditingThis && !(schedule.status === 'pending' && isPast(parseISO(schedule.send_link_date)) && !isToday(parseISO(schedule.send_link_date))) && (
                          <div className="grid grid-cols-3 gap-1.5 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-[11px] gap-1 px-2"
                              onClick={() => {
                                setEditingScheduleId(schedule.id);
                                setEditDate(schedule.send_link_date);
                              }}
                            >
                              <Pencil className="h-3 w-3 shrink-0" />
                              <span className="truncate">Editar</span>
                            </Button>
                            {canResend ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-[11px] gap-1 px-2"
                                onClick={() => handleResendLink(schedule.id)}
                                disabled={isSendingLink === schedule.id}
                              >
                                <Send className="h-3 w-3 shrink-0" />
                                <span className="truncate">{schedule.status === 'pending' ? 'Enviar' : 'Reenviar'}</span>
                              </Button>
                            ) : <span />}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-[11px] gap-1 px-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                if (confirm('Remover esta consulta da pipeline?')) {
                                  removeConsultationMutation.mutate(schedule.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">Excluir</span>
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
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {completedAppointments.map((apt) => {
                  const isEditingApt = editingAptId === apt.id;
                  return (
                    <div
                      key={apt.id}
                      className="p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-xs"
                    >
                      {isEditingApt ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Data</label>
                              <Input
                                type="date"
                                value={editAptDate}
                                onChange={e => setEditAptDate(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">Hora</label>
                              <Input
                                type="time"
                                value={editAptTime}
                                onChange={e => setEditAptTime(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Observações</label>
                            <Textarea
                              value={editAptNotes}
                              onChange={e => setEditAptNotes(e.target.value)}
                              placeholder="Notas da consulta…"
                              className="min-h-[50px] text-xs"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              size="sm"
                              className="h-8 text-[11px] gap-1"
                              onClick={() => updateAppointmentMutation.mutate({
                                id: apt.id,
                                date: editAptDate,
                                time: editAptTime,
                                notes: editAptNotes,
                              })}
                              disabled={updateAppointmentMutation.isPending || !editAptDate || !editAptTime}
                            >
                              <Save className="h-3 w-3" /> Salvar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-[11px]"
                              onClick={() => setEditingAptId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="font-medium">
                                  {format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
                                  <span className="text-muted-foreground font-normal ml-1.5">
                                    {apt.appointment_time.slice(0, 5)}
                                  </span>
                                </p>
                                {apt.notes_admin && (
                                  <p className="text-muted-foreground text-[11px] mt-0.5 line-clamp-2">
                                    {apt.notes_admin}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-[11px] gap-1 px-2"
                              onClick={() => {
                                setEditingAptId(apt.id);
                                setEditAptDate(apt.appointment_date);
                                setEditAptTime(apt.appointment_time.slice(0, 5));
                                setEditAptNotes(apt.notes_admin || '');
                              }}
                            >
                              <Pencil className="h-3 w-3 shrink-0" />
                              <span className="truncate">Editar</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-[11px] gap-1 px-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                if (confirm('Excluir esta consulta realizada? A pipeline será revertida para pendente.')) {
                                  deleteAppointmentMutation.mutate(apt.id);
                                }
                              }}
                              disabled={deleteAppointmentMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">Excluir</span>
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
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
