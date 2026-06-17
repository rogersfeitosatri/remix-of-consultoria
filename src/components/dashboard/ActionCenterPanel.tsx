import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertTriangle, Clock, CheckCircle, ChevronRight, Video, ExternalLink,
  ListTodo, MessageSquare, UtensilsCrossed, UserX, Zap, CalendarCheck,
  Target, Users, Phone, UserPlus, Send, Loader2, Check
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { useMyDayToday } from '@/hooks/useMyDayToday';
import { useInactivityAlerts } from '@/hooks/useInactivityAlerts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePendingMealPlans, useUnlinkedAnamneseForMealPlan, useMarkMealPlanSent } from '@/hooks/useMealPlanStatus';
import { formatDistanceToNow, parseISO, addDays, isWeekend, format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

function businessDaysSince(fromDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  let count = 0;
  let current = new Date(start);
  while (current < today) {
    current = addDays(current, 1);
    if (!isWeekend(current)) count++;
  }
  return count;
}

export function ActionCenterPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: dayData, isLoading: dayLoading } = useMyDayToday();
  const { data: inactiveAthletes = [] } = useInactivityAlerts(14);
  const { data: pendingPlans = [] } = usePendingMealPlans();
  const { data: unlinkedAnamnese = [] } = useUnlinkedAnamneseForMealPlan();
  const markAsSent = useMarkMealPlanSent();

  // ─── Dispensar ações ─────────────────────────────────────────────
  // Marca uma ação como "feita/dispensada" localmente por 24h.
  // Some da lista imediatamente; reaparece se o dado de fato continuar pendente após 24h.
  const DISMISS_KEY = 'action-center-dismissed-v1';
  const DISMISS_TTL = 24 * 60 * 60 * 1000;
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, number>;
      const now = Date.now();
      const valid: Record<string, number> = {};
      for (const [k, ts] of Object.entries(parsed)) {
        if (now - ts < DISMISS_TTL) valid[k] = ts;
      }
      return valid;
    } catch { return {}; }
  });
  const isDismissed = (key: string) => key in dismissed;
  const dismiss = (key: string) => {
    setDismissed(prev => {
      const next = { ...prev, [key]: Date.now() };
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    toast.success('Ação concluída');
  };

  const DismissBtn = ({ k }: { k: string }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
            onClick={(e) => { e.stopPropagation(); dismiss(k); }}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top"><p className="text-xs">Dar check e remover da lista</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Complete task mutation
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const completeTask = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString(), is_archived: true })
        .eq('id', taskId);
      if (error) throw error;
      toast.success('Tarefa concluída!');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-day-today'] });
    } catch {
      toast.error('Erro ao concluir tarefa');
    } finally {
      setCompletingTaskId(null);
    }
  };

  // Unresponsive athletes
  const { data: unresponsiveAthletes = [] } = useQuery({
    queryKey: ['unresponsive-athletes-checkin', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: dispatches } = await supabase
        .from('checkin_dispatches')
        .select('client_id, sent_at, status')
        .eq('user_id', user.id)
        .in('status', ['sent', 'pending'])
        .order('sent_at', { ascending: false })
        .limit(500);

      if (!dispatches?.length) return [];

      const byClient: Record<string, { count: number; lastSentAt: string }> = {};
      for (const d of dispatches) {
        if (!byClient[d.client_id]) byClient[d.client_id] = { count: 0, lastSentAt: d.sent_at };
        byClient[d.client_id].count++;
      }

      const problematic = Object.entries(byClient)
        .filter(([_, v]) => v.count >= 2)
        .map(([clientId, v]) => ({ clientId, ...v }));

      if (!problematic.length) return [];

      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, phone, is_frozen')
        .in('id', problematic.map(p => p.clientId))
        .eq('is_active', true)
        .eq('is_frozen', false);

      const clientMap = new Map((clients || []).map(c => [c.id, { name: c.name, phone: c.phone }]));

      return problematic
        .filter(p => clientMap.has(p.clientId))
        .map(p => ({
          clientId: p.clientId,
          clientName: clientMap.get(p.clientId)!.name,
          phone: clientMap.get(p.clientId)!.phone,
          missedCount: p.count,
          lastSentAt: p.lastSentAt,
        }))
        .sort((a, b) => b.missedCount - a.missedCount);
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Pending checkin feedbacks (excludes frozen/inactive clients)
  const { data: pendingCheckinFeedbacks = [] } = useQuery({
    queryKey: ['pending_checkins_dashboard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('checkin_feedbacks')
        .select('id, checkin_response_id, status, created_at, clients!inner(id, name, is_active, is_frozen), checkin_responses(submitted_at, checkin_forms(title))')
        .in('status', ['pending', 'approved'])
        .eq('clients.is_active', true)
        .eq('clients.is_frozen', false)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
    refetchInterval: 30000,
  });

  // Helper to detect missing fields for pending registrations
  const getMissingFields = (c: any): string[] => {
    const missing: string[] = [];
    if (!c.monthly_value || Number(c.monthly_value) <= 0) missing.push('Valor total');
    if (!c.phone) missing.push('Telefone');
    if (!c.plan_type) missing.push('Tipo de plano');
    if (!c.service_type) missing.push('Tipo de serviço');
    if (!c.plan_duration) missing.push('Duração do plano');
    return missing;
  };

  // Pending registrations: athletes auto-created from anamnese with incomplete setup
  const { data: pendingRegistrations = [] } = useQuery({
    queryKey: ['pending-registrations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, email, phone, created_at, athlete_status, plan_type, service_type, monthly_value, has_checkin, has_consultations, plan_duration, payment_type')
        .eq('user_id', user.id)
        .eq('registration_source', 'anamnese_auto')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Only show clients that still have missing fields
      return (clients || [])
        .map((c: any) => ({
          ...c,
          days_since: differenceInCalendarDays(new Date(), new Date(c.created_at)),
          missing_fields: getMissingFields(c),
        }))
        .filter((c: any) => c.missing_fields.length > 0);
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Retention panel: athletes with <30 days to plan expiration
  const { data: retentionAthletes = [] } = useQuery({
    queryKey: ['retention-athletes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const today = new Date();
      const thirtyDaysLater = format(addDays(today, 30), 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');

      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, phone, end_date, plan_type, service_type')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('is_frozen', false)
        .lte('end_date', thirtyDaysLater)
        .gte('end_date', todayStr)
        .order('end_date');

      return (clients || []).map((c: any) => ({
        ...c,
        days_left: differenceInCalendarDays(new Date(c.end_date), today),
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 300000,
  });

  // Send queue: upcoming booking-link dispatches in next 7 days
  const { data: sendQueue = [] } = useQuery({
    queryKey: ['send-queue-7d', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('consultation_schedules')
        .select('id, scheduled_date, send_link_date, status, link_sent_at, client_id, clients!inner(id, name, phone, is_active, is_frozen)')
        .eq('user_id', user.id)
        .in('status', ['pending', 'sent', 'link_sent'])
        .gte('send_link_date', today)
        .lte('send_link_date', in7)
        .eq('clients.is_active', true)
        .eq('clients.is_frozen', false)
        .order('send_link_date', { ascending: true })
        .limit(50);

      return (data || []) as any[];
    },
    enabled: !!user?.id,
    refetchInterval: 120000,
  });

  const [resendingId, setResendingId] = useState<string | null>(null);
  const resendBookingLink = async (scheduleId: string, clientId: string) => {
    setResendingId(scheduleId);
    try {
      // Determine first vs followup based on prior consultations
      const { count } = await supabase
        .from('consultation_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .in('status', ['completed', 'scheduled']);

      const templateKey = (count || 0) === 0 ? 'booking_first_consultation' : 'booking_followup_consultation';

      const { error } = await supabase.functions.invoke('send-booking-link', {
        body: {
          clientId,
          consultationScheduleId: scheduleId,
          templateKey,
          triggeredBy: 'manual_admin',
        },
      });
      if (error) throw error;
      toast.success('Link enviado!');
      queryClient.invalidateQueries({ queryKey: ['send-queue-7d'] });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar link');
    } finally {
      setResendingId(null);
    }
  };

  const appointments = (dayData?.appointments || []).filter(a => !isDismissed(`apt:${a.id}`));
  const overdueTasks = (dayData?.tasks.filter(t => t.is_overdue) || []).filter(t => !isDismissed(`tsk:${t.id}`));
  const todayTasks = (dayData?.tasks.filter(t => !t.is_overdue) || []).filter(t => !isDismissed(`tsk:${t.id}`));
  const pendingCheckins = (dayData?.pendingCheckins || []).filter(c => !isDismissed(`pck:${c.client_id}`));
  const urgentAthletes = (dayData?.urgentAthletes || []).filter(a => !isDismissed(`urg:${a.id}`));
  const visibleUnresponsive = unresponsiveAthletes.filter((a: any) => !isDismissed(`unr:${a.clientId}`));
  const visiblePendingPlans = pendingPlans.filter((p: any) => !isDismissed(`mpl:${p.id}`));
  const visibleUnlinkedAnamnese = unlinkedAnamnese.filter((a: any) => !isDismissed(`mpu:${a.id}`));
  const visibleFeedbacks = pendingCheckinFeedbacks.filter((f: any) => !isDismissed(`pcf:${f.id}`));
  const visibleInactive = inactiveAthletes.filter((a: any) => !isDismissed(`ina:${a.id}`));
  const visibleRetention = retentionAthletes.filter((a: any) => !isDismissed(`ret:${a.id}`));
  const visibleRegistrations = pendingRegistrations.filter((a: any) => !isDismissed(`reg:${a.id}`));
  const visibleSendQueue = sendQueue.filter((s: any) => !isDismissed(`que:${s.id}`));

  // Count items per tab
  const urgentCount = overdueTasks.length + visibleUnresponsive.length + urgentAthletes.length;
  const todayCount = appointments.length + todayTasks.length + pendingCheckins.length;
  const pendingCount = visiblePendingPlans.length + visibleUnlinkedAnamnese.length + visibleFeedbacks.length + visibleInactive.length;
  const retentionCount = visibleRetention.length;
  const registrationCount = visibleRegistrations.length;
  const queueCount = visibleSendQueue.length;

  const totalCount = urgentCount + todayCount + pendingCount + retentionCount + registrationCount + queueCount;

  const [activeTab, setActiveTab] = useState(() => {
    if (registrationCount > 0) return 'registrations';
    if (urgentCount > 0) return 'urgent';
    if (todayCount > 0) return 'today';
    if (queueCount > 0) return 'queue';
    if (retentionCount > 0) return 'retention';
    return 'pending';
  });

  if (dayLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (totalCount === 0) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="flex items-center gap-3 py-5 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Tudo em dia! 🎉</p>
            <p className="text-sm text-muted-foreground">Nenhuma pendência ou tarefa urgente no momento.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const openWhatsApp = (phone: string, message?: string) => {
    const digits = phone.replace(/\D/g, '');
    const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
    const msg = message || 'Olá! Tudo bem? 💪';
    window.open(`https://wa.me/${withDDI}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const TaskCheckRow = ({ task }: { task: any }) => (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${
        task.is_overdue
          ? 'bg-destructive/5 border-destructive/20'
          : 'bg-background/80 border-border/50'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Checkbox
          checked={false}
          disabled={completingTaskId === task.id}
          onClick={(e) => { e.stopPropagation(); completeTask(task.id); }}
          className={`h-3.5 w-3.5 shrink-0 ${task.is_overdue ? 'border-destructive' : 'border-muted-foreground'}`}
        />
        <span className="truncate text-xs font-medium">{task.title}</span>
        {task.client_name && <span className="text-[10px] text-muted-foreground shrink-0">{task.client_name}</span>}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <DismissBtn k={`tsk:${task.id}`} />
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => navigate('/tasks')}>
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  const getRetentionBadgeColor = (daysLeft: number) => {
    if (daysLeft <= 7) return 'destructive';
    if (daysLeft <= 14) return 'default';
    return 'secondary';
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b border-border px-4 pt-3">
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">Centro de Ações</h3>
            </div>
             <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-1 flex-wrap">
              {registrationCount > 0 && (
                <TabsTrigger
                  value="registrations"
                  className="relative data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-emerald-500 px-3 py-1.5 text-xs"
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Cadastros
                  <Badge className="ml-1.5 h-4 min-w-4 text-[10px] px-1 bg-emerald-500 text-white">
                    {registrationCount}
                  </Badge>
                </TabsTrigger>
              )}
              <TabsTrigger
                value="urgent"
                className="relative data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-destructive px-3 py-1.5 text-xs"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Urgente
                {urgentCount > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-4 min-w-4 text-[10px] px-1">
                    {urgentCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="today"
                className="relative data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-3 py-1.5 text-xs"
              >
                <Clock className="h-3 w-3 mr-1" />
                Hoje
                {todayCount > 0 && (
                  <Badge className="ml-1.5 h-4 min-w-4 text-[10px] px-1 bg-primary text-primary-foreground">
                    {todayCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="relative data-[state=active]:bg-warning/10 data-[state=active]:text-warning data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-warning px-3 py-1.5 text-xs"
              >
                <UtensilsCrossed className="h-3 w-3 mr-1" />
                Pendente
                {pendingCount > 0 && (
                  <Badge className="ml-1.5 h-4 min-w-4 text-[10px] px-1 bg-warning text-warning-foreground">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="retention"
                className="relative data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-600 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-orange-500 px-3 py-1.5 text-xs"
              >
                <Users className="h-3 w-3 mr-1" />
                Retenção
                {retentionCount > 0 && (
                  <Badge className="ml-1.5 h-4 min-w-4 text-[10px] px-1 bg-orange-500 text-white">
                    {retentionCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="queue"
                className="relative data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-600 data-[state=active]:shadow-none rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-sky-500 px-3 py-1.5 text-xs"
              >
                <Send className="h-3 w-3 mr-1" />
                Fila de Envios
                {queueCount > 0 && (
                  <Badge className="ml-1.5 h-4 min-w-4 text-[10px] px-1 bg-sky-500 text-white">
                    {queueCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* REGISTRATIONS TAB */}
          <TabsContent value="registrations" className="m-0 p-4 space-y-3">
            {registrationCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cadastro pendente ✓</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                    <UserPlus className="h-3 w-3" /> Cadastros pendentes ({registrationCount})
                  </p>
                  <Button variant="link" size="sm" className="h-6 text-xs p-0" onClick={() => navigate('/clients')}>
                    Ver todos
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Atletas que enviaram a anamnese e precisam ter o cadastro finalizado (plano, financeiro, etc.)
                </p>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {visibleRegistrations.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm border bg-background/80 border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserPlus className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="truncate text-xs font-medium block">{a.name}</span>
                          <span className="text-[10px] text-muted-foreground block">{a.email}</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {a.missing_fields?.map((field: string) => (
                              <Badge key={field} variant="outline" className="text-[9px] px-1 py-0 text-destructive border-destructive/30">
                                ⚠ {field}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {a.days_since > 3 ? (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0 shrink-0">
                            {a.days_since}d atrás
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                            {a.days_since === 0 ? 'Hoje' : `${a.days_since}d atrás`}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {a.phone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-success"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWhatsApp(a.phone, `Olá ${a.name.split(' ')[0]}! Recebi sua anamnese. Vou finalizar seu cadastro e já te informo os próximos passos! 💪`);
                            }}
                          >
                            <Phone className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => navigate(`/clients/${a.id}`)}
                        >
                          Concluir cadastro
                        </Button>
                        <DismissBtn k={`reg:${a.id}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* URGENT TAB */}
          <TabsContent value="urgent" className="m-0 p-4 space-y-3">
            {urgentCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma urgência no momento ✓</p>
            ) : (
              <>
                {overdueTasks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                      <ListTodo className="h-3 w-3" /> Tarefas atrasadas ({overdueTasks.length})
                    </p>
                    {overdueTasks.slice(0, 5).map(t => (
                      <TaskCheckRow key={t.id} task={t} />
                    ))}
                    {overdueTasks.length > 5 && (
                      <Button variant="link" size="sm" className="h-6 text-xs p-0" onClick={() => navigate('/tasks')}>
                        +{overdueTasks.length - 5} mais
                      </Button>
                    )}
                  </div>
                )}

                {unresponsiveAthletes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Sem resposta ({unresponsiveAthletes.length})
                    </p>
                    {visibleUnresponsive.slice(0, 5).map(a => (
                      <ActionRow
                        key={a.clientId}
                        icon={<MessageSquare className="h-3.5 w-3.5 text-destructive" />}
                        title={a.clientName}
                        subtitle={`${a.missedCount}x sem resposta`}
                        variant="destructive"
                        onClick={() => navigate(`/clients/${a.clientId}`)}
                        whatsApp={a.phone ? () => openWhatsApp(a.phone!, `Olá! Percebi que faz um tempo que não nos falamos. Como está indo? 💪`) : undefined}
                        onDismiss={() => dismiss(`unr:${a.clientId}`)}
                      />
                    ))}
                  </div>
                )}

                {urgentAthletes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                      <Target className="h-3 w-3" /> Planos vencendo ({urgentAthletes.length})
                    </p>
                    {urgentAthletes.map(a => (
                      <ActionRow
                        key={a.id}
                        icon={<Target className="h-3.5 w-3.5 text-destructive" />}
                        title={a.name}
                        badge={<Badge variant="destructive" className="text-[10px] px-1 py-0">{a.days_left}d</Badge>}
                        variant="destructive"
                        onClick={() => navigate(`/clients/${a.id}`)}
                        whatsApp={a.phone ? () => openWhatsApp(a.phone!) : undefined}
                        onDismiss={() => dismiss(`urg:${a.id}`)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* TODAY TAB */}
          <TabsContent value="today" className="m-0 p-4 space-y-3">
            {todayCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Agenda livre hoje ✓</p>
            ) : (
              <>
                {appointments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-primary flex items-center gap-1">
                      <Video className="h-3 w-3" /> Consultas ({appointments.length})
                    </p>
                    {appointments.map(a => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-sm border border-primary/20">
                        <div className="flex items-center gap-2 min-w-0">
                          <Video className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate font-medium text-xs">{a.client_name}</span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            {a.appointment_time?.substring(0, 5)}
                          </span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {a.google_meet_link && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                              <a href={a.google_meet_link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" /> Meet
                              </a>
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => navigate(`/clients/${a.client_id}`)}>
                            Ver
                          </Button>
                          <DismissBtn k={`apt:${a.id}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {todayTasks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <ListTodo className="h-3 w-3" /> Tarefas para hoje ({todayTasks.length})
                    </p>
                    {todayTasks.slice(0, 5).map(t => (
                      <TaskCheckRow key={t.id} task={t} />
                    ))}
                  </div>
                )}

                {pendingCheckins.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-warning flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Aguardando resposta ({pendingCheckins.length})
                    </p>
                    {pendingCheckins.map(c => (
                      <ActionRow
                        key={c.client_id}
                        icon={<MessageSquare className="h-3.5 w-3.5 text-warning" />}
                        title={c.client_name}
                        subtitle={`há ${c.days_waiting}d`}
                        variant="warning"
                        onClick={() => navigate(`/clients/${c.client_id}`)}
                        onDismiss={() => dismiss(`pck:${c.client_id}`)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* PENDING TAB */}
          <TabsContent value="pending" className="m-0 p-4 space-y-3">
            {pendingCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pendência ✓</p>
            ) : (
              <>
                {(visiblePendingPlans.length > 0 || visibleUnlinkedAnamnese.length > 0) && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-orange-500 flex items-center gap-1">
                      <UtensilsCrossed className="h-3 w-3" /> Planos alimentares ({visiblePendingPlans.length + visibleUnlinkedAnamnese.length})
                    </p>
                    {visiblePendingPlans.slice(0, 5).map(plan => {
                      const refDate = plan.anamnese_submitted_at ? parseISO(plan.anamnese_submitted_at) : parseISO(plan.created_at);
                      const elapsed = businessDaysSince(refDate);
                      const remaining = 4 - elapsed;
                      return (
                        <div key={plan.id} className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 text-sm border border-border/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox
                              checked={false}
                              onClick={(e) => { e.stopPropagation(); markAsSent.mutate(plan.client_id); }}
                              disabled={markAsSent.isPending}
                              className="border-orange-400 h-3.5 w-3.5"
                            />
                            <span className="truncate text-xs font-medium">{plan.client_name}</span>
                            {remaining < 0 ? (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">{Math.abs(remaining)}d atrasado</Badge>
                            ) : remaining === 0 ? (
                              <Badge className="text-[10px] px-1 py-0 bg-yellow-500 text-white">Último dia</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">{remaining}d</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <DismissBtn k={`mpl:${plan.id}`} />
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => {
                              if (plan.anamnese_response_id) navigate(`/anamnese-response/${plan.anamnese_response_id}`);
                              else navigate(`/clients/${plan.client_id}`);
                            }}>
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {visibleFeedbacks.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-orange-500 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Check-ins p/ revisar ({visibleFeedbacks.length})
                    </p>
                    {visibleFeedbacks.slice(0, 5).map((f: any) => (
                      <ActionRow
                        key={f.id}
                        icon={<MessageSquare className="h-3.5 w-3.5 text-orange-500" />}
                        title={f.clients?.name || 'N/A'}
                        subtitle={f.status === 'approved' ? 'Pronto p/ envio' : 'Pendente'}
                        onClick={() => navigate(`/checkin-review/${f.checkin_response_id}`)}
                        onDismiss={() => dismiss(`pcf:${f.id}`)}
                      />
                    ))}
                  </div>
                )}

                {visibleInactive.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <UserX className="h-3 w-3" /> Sem interação +14d ({visibleInactive.length})
                    </p>
                    {visibleInactive.slice(0, 5).map((a: any) => (
                      <ActionRow
                        key={a.id}
                        icon={<UserX className="h-3.5 w-3.5 text-muted-foreground" />}
                        title={a.name}
                        subtitle={`${a.daysSinceLastInteraction}d`}
                        onClick={() => navigate(`/clients/${a.id}`)}
                        whatsApp={a.phone ? () => openWhatsApp(a.phone!) : undefined}
                        onDismiss={() => dismiss(`ina:${a.id}`)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* RETENTION TAB */}
          <TabsContent value="retention" className="m-0 p-4 space-y-3">
            {retentionCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano vencendo nos próximos 30 dias ✓</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-orange-600 flex items-center gap-1">
                    <Users className="h-3 w-3" /> Atletas com plano vencendo em até 30 dias ({retentionCount})
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Foque em contato diário para aumentar as chances de renovação
                </p>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {visibleRetention.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm border bg-background/80 border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-xs font-medium">{a.name}</span>
                        <Badge
                          variant={getRetentionBadgeColor(a.days_left) as any}
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          {a.days_left}d
                        </Badge>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {a.plan_type === 'premium' ? 'Premium' : 'Consultoria'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {a.phone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-success"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWhatsApp(a.phone, `Olá ${a.name.split(' ')[0]}! Como está indo o acompanhamento? Quero saber como posso te ajudar ainda mais! 💪`);
                            }}
                          >
                            <Phone className="h-3 w-3" />
                          </Button>
                        )}
                        <DismissBtn k={`ret:${a.id}`} />
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => navigate(`/clients/${a.id}`)}>
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* QUEUE TAB - Próximos envios de link de agendamento (7 dias) */}
          <TabsContent value="queue" className="m-0 p-4 space-y-3">
            {queueCount === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum envio programado nos próximos 7 dias ✓</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-sky-600 flex items-center gap-1">
                    <Send className="h-3 w-3" /> Próximos envios de link ({queueCount})
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Links de agendamento programados pelo cron diário. Reenvie manualmente se necessário.
                </p>
                <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                  {sendQueue.map((s: any) => {
                    const sendDate = parseISO(s.send_link_date);
                    const consultDate = parseISO(s.scheduled_date);
                    const isSent = s.status === 'sent' || s.status === 'link_sent' || !!s.link_sent_at;
                    const isToday = format(sendDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm border bg-background/80 border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Send className={`h-3.5 w-3.5 shrink-0 ${isSent ? 'text-success' : 'text-sky-500'}`} />
                          <div className="min-w-0 flex-1">
                            <span className="truncate text-xs font-medium block">{s.clients?.name}</span>
                            <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                              <Badge variant={isToday ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
                                Envio: {format(sendDate, 'dd/MM', { locale: ptBR })}
                              </Badge>
                              <span className="text-[9px] text-muted-foreground">→</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0">
                                Consulta: {format(consultDate, 'dd/MM', { locale: ptBR })}
                              </Badge>
                              {isSent && (
                                <Badge className="text-[9px] px-1 py-0 bg-success/15 text-success border-success/30">
                                  ✓ Enviado
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={resendingId === s.id}
                            onClick={() => resendBookingLink(s.id, s.client_id)}
                          >
                            {resendingId === s.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-3 w-3 mr-1" />
                                {isSent ? 'Reenviar' : 'Enviar agora'}
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => navigate(`/clients/${s.client_id}`)}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Reusable action row
function ActionRow({
  icon, title, subtitle, badge, variant, onClick, whatsApp, onDismiss,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  variant?: 'destructive' | 'warning';
  onClick: () => void;
  whatsApp?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border cursor-pointer transition-colors ${
        variant === 'destructive'
          ? 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10'
          : variant === 'warning'
          ? 'bg-warning/5 border-warning/20 hover:bg-warning/10'
          : 'bg-background/80 border-border/50 hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="truncate text-xs font-medium">{title}</span>
        {subtitle && <span className="text-[10px] text-muted-foreground shrink-0">{subtitle}</span>}
        {badge}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {whatsApp && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success" onClick={(e) => { e.stopPropagation(); whatsApp(); }}>
            <Zap className="h-3 w-3" />
          </Button>
        )}
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
            title="Dar check e remover da lista"
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
}
