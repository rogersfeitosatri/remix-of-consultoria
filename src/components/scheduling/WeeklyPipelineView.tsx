import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks, isBefore, startOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Send, User, Calendar, Clock, ChevronLeft, ChevronRight, CheckCircle2,
  AlertTriangle, Video, ExternalLink, RefreshCw, Loader2, Eye, Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConsultationSchedule, Client } from '@/hooks/useClients';
import { Link } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { PlanTypeBadge } from '@/components/clients/PlanTypeBadge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle } from 'lucide-react';

interface WeeklyPipelineViewProps {
  consultations: (ConsultationSchedule & { client_name: string })[];
  clients: Client[];
  appointments: any[];
  onSendLink: (id: string) => void;
  onMarkAsSent: (id: string) => void;
  isSending?: boolean;
}

type PipelineStatus = 'link_pending' | 'link_sent' | 'booked' | 'awaiting_confirmation' | 'completed' | 'cancelled' | 'no_show' | 'first_consult';

interface PipelineItem {
  clientId: string;
  clientName: string;
  client: Client | undefined;
  status: PipelineStatus;
  consultationNumber?: string;
  scheduleId?: string;
  sendDate?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentId?: string;
  meetLink?: string;
  daysSinceSent?: number;
  isOverdue?: boolean;
  lastLinkSentAt?: string;
  lastCompletedConsultDate?: string;
}

const STATUS_CONFIG: Record<PipelineStatus, { label: string; icon: any; className: string; bgClass: string }> = {
  link_pending: {
    label: 'Link Pendente',
    icon: Clock,
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    bgClass: 'bg-amber-500/5 border-amber-500/20',
  },
  link_sent: {
    label: 'Link Enviado',
    icon: Send,
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    bgClass: 'bg-blue-500/5 border-blue-500/20',
  },
  booked: {
    label: 'Agendado',
    icon: Calendar,
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    bgClass: 'bg-emerald-500/5 border-emerald-500/20',
  },
  awaiting_confirmation: {
    label: 'Aguardando confirmação',
    icon: AlertTriangle,
    className: 'bg-amber-500/15 text-amber-700 border-amber-500/40',
    bgClass: 'bg-amber-500/10 border-amber-500/30',
  },
  completed: {
    label: 'Realizada',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    bgClass: 'bg-emerald-500/5 border-emerald-500/20',
  },
  cancelled: {
    label: 'Cancelada',
    icon: XCircle,
    className: 'bg-muted text-muted-foreground border-border',
    bgClass: 'bg-muted/30 border-border',
  },
  no_show: {
    label: 'Não Agendou',
    icon: AlertTriangle,
    className: 'bg-destructive/10 text-destructive border-destructive/30',
    bgClass: 'bg-destructive/5 border-destructive/20',
  },
  first_consult: {
    label: '1ª Consulta',
    icon: User,
    className: 'bg-primary/10 text-primary border-primary/30',
    bgClass: 'bg-primary/5 border-primary/20',
  },
};

export function WeeklyPipelineView({
  consultations,
  clients,
  appointments,
  onSendLink,
  onMarkAsSent,
  isSending,
}: WeeklyPipelineViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const updateAppointmentStatus = async (appointmentId: string, newStatus: 'completed' | 'cancelled') => {
    setConfirmingId(appointmentId);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', appointmentId);
      if (error) throw error;
      toast({
        title: newStatus === 'completed' ? 'Consulta marcada como realizada' : 'Consulta marcada como cancelada',
      });
      queryClient.invalidateQueries({ queryKey: ['consultation-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setConfirmingId(null);
    }
  };


  const APP_URL = 'https://rogersfeitosa.com.br';

  const renderTpl = (tpl: { title?: string | null; body: string }, vars: Record<string, string>) => {
    let title = tpl.title || '';
    let body = tpl.body;
    for (const [k, v] of Object.entries(vars)) {
      const re = new RegExp(`\\{${k}\\}`, 'g');
      title = title.replace(re, v ?? '');
      body = body.replace(re, v ?? '');
    }
    return title ? `*${title}*\n\n${body}` : body;
  };

  const handleCopyBookingMessage = async (item: PipelineItem) => {
    if (!item.client) return;
    setCopyingId(item.clientId);
    try {
      // 1) Get or create active booking_link for this client
      let { data: link } = await supabase
        .from('booking_links')
        .select('token, usage_count')
        .eq('client_id', item.clientId)
        .eq('active', true)
        .maybeSingle();

      if (!link) {
        const { data: newLink, error: createErr } = await supabase
          .from('booking_links')
          .insert({ client_id: item.clientId, active: true })
          .select('token, usage_count')
          .single();
        if (createErr) throw createErr;
        link = newLink;
      }

      const bookingUrl = `${APP_URL}/booking/${link!.token}`;

      // 2) Decide template_key (mirror process-consultation-schedules logic)
      //    First consultation if no prior completed/scheduled, else followup
      const { count: priorCount } = await supabase
        .from('consultation_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', item.clientId)
        .in('status', ['completed', 'scheduled'])
        .neq('id', item.scheduleId ?? '00000000-0000-0000-0000-000000000000');

      const isFirst = (priorCount ?? 0) === 0;
      const templateKey = isFirst ? 'booking_first_consultation' : 'booking_followup_consultation';

      // 3) Fetch template
      const { data: tpl, error: tplErr } = await supabase
        .from('whatsapp_templates')
        .select('title, body, is_active')
        .eq('user_id', item.client.user_id)
        .eq('template_key', templateKey)
        .maybeSingle();

      if (tplErr) throw tplErr;
      if (!tpl) {
        toast({
          title: 'Template não encontrado',
          description: `Configure o template "${templateKey}" em Configurações → WhatsApp.`,
          variant: 'destructive',
        });
        return;
      }

      const firstName = item.client.name.split(' ')[0];
      const message = renderTpl(
        { title: tpl.title, body: tpl.body },
        {
          nome: firstName,
          client_name: firstName,
          booking_link: bookingUrl,
          link: bookingUrl,
        },
      );

      await navigator.clipboard.writeText(message);
      toast({
        title: 'Mensagem copiada!',
        description: 'O texto exato do WhatsApp foi copiado para a área de transferência.',
      });
    } catch (e) {
      toast({
        title: 'Erro ao copiar',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCopyingId(null);
    }
  };

  const today = startOfDay(new Date());
  const currentWeekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  // Per-client: last link sent and last completed consultation
  const lastLinkByClient = useMemo(() => {
    const map = new Map<string, string>();
    consultations.forEach(s => {
      const sent = (s as any).link_sent_at as string | null;
      if (!sent) return;
      const prev = map.get(s.client_id);
      if (!prev || new Date(sent) > new Date(prev)) map.set(s.client_id, sent);
    });
    return map;
  }, [consultations]);

  const lastCompletedByClient = useMemo(() => {
    const map = new Map<string, string>();
    (appointments || []).forEach((apt: any) => {
      // Only count appointments explicitly marked as completed (não auto-considerar por data passada)
      if (apt.status !== 'completed') return;
      const aptDate = parseISO(apt.appointment_date);
      const prev = map.get(apt.client_id);
      if (!prev || aptDate > parseISO(prev)) map.set(apt.client_id, apt.appointment_date);
    });
    return map;
  }, [appointments]);

  const statusFromAppointment = (apt: any): PipelineStatus => {
    if (apt.status === 'completed') return 'completed';
    if (apt.status === 'cancelled' || apt.status === 'no_show') return 'cancelled';
    const aptDate = parseISO(apt.appointment_date);
    return isBefore(aptDate, today) ? 'awaiting_confirmation' : 'booked';
  };


  // Build pipeline items for the current week
  const pipelineItems = useMemo(() => {
    const items: PipelineItem[] = [];
    const processedClientIds = new Set<string>();

    // 1. Process consultation_schedules for this week
    consultations
      .filter(s => {
        const sendDate = parseISO(s.send_link_date);
        return isWithinInterval(sendDate, { start: currentWeekStart, end: currentWeekEnd });
      })
      .forEach(schedule => {
        const client = clientsById.get(schedule.client_id);
        const sendDate = parseISO(schedule.send_link_date);

        // Check if there's a matching appointment in the same week or next 2 weeks (any non-cancelled status)
        const matchingAppointment = (appointments || []).find(
          (apt: any) =>
            apt.client_id === schedule.client_id &&
            apt.status !== 'cancelled' &&
            apt.status !== 'no_show' &&
            parseISO(apt.appointment_date) >= currentWeekStart
        );

        // Calculate consultation number
        const clientConsultations = consultations
          .filter(c => c.client_id === schedule.client_id)
          .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
        const index = clientConsultations.findIndex(c => c.id === schedule.id);
        const total = client?.consultation_count || 0;
        const consultNum = total > 0 && index >= 0 ? `${index + 1}/${total}` : undefined;

        let status: PipelineStatus;
        if (matchingAppointment) {
          status = statusFromAppointment(matchingAppointment);
        } else if (schedule.status === 'sent' || (schedule.status as string) === 'link_sent') {
          const daysSince = Math.floor((today.getTime() - sendDate.getTime()) / (1000 * 60 * 60 * 24));
          status = daysSince >= 3 ? 'no_show' : 'link_sent';
        } else {
          status = 'link_pending';
        }

        const daysSinceSent = schedule.status === 'sent' || (schedule.status as string) === 'link_sent'
          ? Math.floor((today.getTime() - sendDate.getTime()) / (1000 * 60 * 60 * 24))
          : undefined;

        items.push({
          clientId: schedule.client_id,
          clientName: schedule.client_name,
          client,
          status,
          consultationNumber: consultNum,
          scheduleId: schedule.id,
          sendDate: schedule.send_link_date,
          appointmentDate: matchingAppointment?.appointment_date,
          appointmentTime: matchingAppointment?.appointment_time,
          appointmentId: matchingAppointment?.id,
          meetLink: matchingAppointment?.google_meet_link,
          daysSinceSent,
          isOverdue: status === 'no_show',
          lastLinkSentAt: lastLinkByClient.get(schedule.client_id),
          lastCompletedConsultDate: lastCompletedByClient.get(schedule.client_id),
        });

        processedClientIds.add(schedule.client_id);
      });

    // 2. Add first consultations for this week (clients without schedule entries)
    clients
      .filter(c => {
        if (!c.first_consultation_date || !c.is_active) return false;
        if (processedClientIds.has(c.id)) return false;
        const firstDate = parseISO(c.first_consultation_date);
        return isWithinInterval(firstDate, { start: currentWeekStart, end: currentWeekEnd });
      })
      .forEach(client => {
        const matchingAppointment = (appointments || []).find(
          (apt: any) =>
            apt.client_id === client.id &&
            (apt.status === 'scheduled' || apt.status === 'confirmed') &&
            apt.appointment_date === client.first_consultation_date
        );

        items.push({
          clientId: client.id,
          clientName: client.name,
          client,
          status: matchingAppointment
            ? isBefore(parseISO(matchingAppointment.appointment_date), today)
              ? 'completed'
              : 'booked'
            : 'first_consult',
          appointmentDate: matchingAppointment?.appointment_date || client.first_consultation_date,
          appointmentTime: matchingAppointment?.appointment_time,
          appointmentId: matchingAppointment?.id,
          meetLink: matchingAppointment?.google_meet_link,
          lastLinkSentAt: lastLinkByClient.get(client.id),
          lastCompletedConsultDate: lastCompletedByClient.get(client.id),
        });

        processedClientIds.add(client.id);
      });

    // 3. Add appointments in this week that don't have a consultation_schedule
    (appointments || [])
      .filter((apt: any) => {
        if (processedClientIds.has(apt.client_id)) return false;
        if (apt.status !== 'scheduled' && apt.status !== 'confirmed') return false;
        const aptDate = parseISO(apt.appointment_date);
        return isWithinInterval(aptDate, { start: currentWeekStart, end: currentWeekEnd });
      })
      .forEach((apt: any) => {
        const client = clientsById.get(apt.client_id);
        items.push({
          clientId: apt.client_id,
          clientName: apt.client?.name || client?.name || 'Cliente',
          client,
          status: isBefore(parseISO(apt.appointment_date), today) ? 'completed' : 'booked',
          appointmentDate: apt.appointment_date,
          appointmentTime: apt.appointment_time,
          appointmentId: apt.id,
          meetLink: apt.google_meet_link,
          lastLinkSentAt: lastLinkByClient.get(apt.client_id),
          lastCompletedConsultDate: lastCompletedByClient.get(apt.client_id),
        });
        processedClientIds.add(apt.client_id);
      });

    // Sort: overdue first, then pending, then sent, then booked, then completed
    const statusOrder: Record<PipelineStatus, number> = {
      no_show: 0,
      link_pending: 1,
      link_sent: 2,
      first_consult: 3,
      booked: 4,
      completed: 5,
    };

    return items.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }, [consultations, clients, appointments, currentWeekStart, currentWeekEnd, today, clientsById]);

  // Filter
  const filteredItems = statusFilter === 'all'
    ? pipelineItems
    : pipelineItems.filter(i => i.status === statusFilter);

  // Stats
  const stats = useMemo(() => ({
    total: pipelineItems.length,
    pending: pipelineItems.filter(i => i.status === 'link_pending').length,
    sent: pipelineItems.filter(i => i.status === 'link_sent').length,
    overdue: pipelineItems.filter(i => i.status === 'no_show').length,
    booked: pipelineItems.filter(i => i.status === 'booked' || i.status === 'first_consult').length,
    completed: pipelineItems.filter(i => i.status === 'completed').length,
  }), [pipelineItems]);

  const isCurrentWeek = weekOffset === 0;
  const weekLabel = format(currentWeekStart, "dd MMM", { locale: ptBR }) +
    ' – ' + format(currentWeekEnd, "dd MMM yyyy", { locale: ptBR });

  return (
    <div className="space-y-4">
      {/* Week Navigation + Stats */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                <CardTitle className="text-sm font-medium capitalize">{weekLabel}</CardTitle>
                {isCurrentWeek && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] mt-1">Semana Atual</Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!isCurrentWeek && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>
                Hoje
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Stats bar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors",
                statusFilter === 'all' ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              )}
            >
              <div className="text-lg font-bold text-foreground">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground">Total</div>
            </button>
            <button
              onClick={() => setStatusFilter('link_pending')}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors",
                statusFilter === 'link_pending' ? "border-amber-500 bg-amber-500/5" : "border-border hover:bg-muted/50"
              )}
            >
              <div className="text-lg font-bold text-amber-600">{stats.pending}</div>
              <div className="text-[10px] text-muted-foreground">Pendentes</div>
            </button>
            <button
              onClick={() => setStatusFilter('link_sent')}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors",
                statusFilter === 'link_sent' ? "border-blue-500 bg-blue-500/5" : "border-border hover:bg-muted/50"
              )}
            >
              <div className="text-lg font-bold text-blue-600">{stats.sent}</div>
              <div className="text-[10px] text-muted-foreground">Enviados</div>
            </button>
            <button
              onClick={() => setStatusFilter('no_show')}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors",
                statusFilter === 'no_show' ? "border-destructive bg-destructive/5" : "border-border hover:bg-muted/50"
              )}
            >
              <div className={cn("text-lg font-bold", stats.overdue > 0 ? "text-destructive" : "text-muted-foreground")}>{stats.overdue}</div>
              <div className="text-[10px] text-muted-foreground">Não Agendou</div>
            </button>
            <button
              onClick={() => setStatusFilter('booked')}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors",
                statusFilter === 'booked' ? "border-emerald-500 bg-emerald-500/5" : "border-border hover:bg-muted/50"
              )}
            >
              <div className="text-lg font-bold text-emerald-600">{stats.booked}</div>
              <div className="text-[10px] text-muted-foreground">Agendados</div>
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors",
                statusFilter === 'completed' ? "border-emerald-500 bg-emerald-500/5" : "border-border hover:bg-muted/50"
              )}
            >
              <div className="text-lg font-bold text-emerald-600">{stats.completed}</div>
              <div className="text-[10px] text-muted-foreground">Realizadas</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Alert for overdue */}
      {stats.overdue > 0 && statusFilter === 'all' && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {stats.overdue} atleta{stats.overdue > 1 ? 's' : ''} recebeu link mas não agendou (3+ dias)
              </p>
              <p className="text-xs text-muted-foreground">Considere reenviar o link ou entrar em contato.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline list */}
      {filteredItems.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {statusFilter !== 'all'
                ? 'Nenhum atleta com esse status nesta semana.'
                : 'Nenhum atleta na pipeline desta semana.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const config = STATUS_CONFIG[item.status];
            const StatusIcon = config.icon;

            return (
              <Card key={`${item.clientId}-${item.scheduleId || 'apt'}`} className={cn("border", config.bgClass)}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Status icon + athlete info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn("rounded-full p-2 shrink-0", config.className)}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{item.clientName}</span>
                          {item.client && <PlanTypeBadge client={item.client} />}
                          {item.consultationNumber && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              Consulta #{item.consultationNumber}
                            </Badge>
                          )}
                          {item.status === 'first_consult' && (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 shrink-0">
                              1ª Consulta
                            </Badge>
                          )}
                        </div>

                        {/* Pipeline progress line */}
                        <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                          {/* Step 1: Link */}
                          {item.scheduleId && (
                            <>
                              <span className={cn(
                                "flex items-center gap-0.5",
                                item.status === 'link_pending' ? "text-amber-600 font-medium" :
                                  ['link_sent', 'no_show', 'booked', 'completed'].includes(item.status) ? "text-emerald-600" : ""
                              )}>
                                <Send className="h-3 w-3" />
                                {item.status === 'link_pending' ? 'Pendente' : 'Enviado'}
                              </span>
                              <span className="text-muted-foreground/50">→</span>
                            </>
                          )}

                          {/* Step 2: Booking */}
                          <span className={cn(
                            "flex items-center gap-0.5",
                            item.status === 'no_show' ? "text-destructive font-medium" :
                              item.status === 'link_sent' ? "text-blue-600" :
                                ['booked', 'completed'].includes(item.status) ? "text-emerald-600" : ""
                          )}>
                            <Calendar className="h-3 w-3" />
                            {item.status === 'no_show' ? `Sem resposta (${item.daysSinceSent}d)` :
                              item.status === 'link_sent' ? 'Aguardando' :
                                item.appointmentDate
                                  ? `${format(parseISO(item.appointmentDate), 'EEE dd/MM', { locale: ptBR })}${item.appointmentTime ? ` ${item.appointmentTime.substring(0, 5)}` : ''}`
                                  : 'Pendente'}
                          </span>

                          {/* Step 3: Consultation */}
                          {['booked', 'completed'].includes(item.status) && (
                            <>
                              <span className="text-muted-foreground/50">→</span>
                              <span className={cn(
                                "flex items-center gap-0.5",
                                item.status === 'completed' ? "text-emerald-600 font-medium" : ""
                              )}>
                                <CheckCircle2 className="h-3 w-3" />
                                {item.status === 'completed' ? 'Realizada' : 'Aguardando'}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Last link sent + last completed consultation */}
                        {(item.lastLinkSentAt || item.lastCompletedConsultDate) && (
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/80">
                            {item.lastLinkSentAt && (
                              <span className="flex items-center gap-0.5">
                                <Send className="h-2.5 w-2.5" />
                                Último link: {format(parseISO(item.lastLinkSentAt), "dd/MM/yy", { locale: ptBR })}
                              </span>
                            )}
                            {item.lastCompletedConsultDate && (
                              <span className="flex items-center gap-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Última consulta: {format(parseISO(item.lastCompletedConsultDate), "dd/MM/yy", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={cn("text-[10px]", config.className)}>
                        {config.label}
                      </Badge>

                      {/* Copy WhatsApp message (exact text sent to athlete) */}
                      {item.client && (item.status === 'link_pending' || item.status === 'link_sent' || item.status === 'no_show') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          title="Copiar mensagem do WhatsApp para envio manual"
                          onClick={() => handleCopyBookingMessage(item)}
                          disabled={copyingId === item.clientId}
                        >
                          {copyingId === item.clientId
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Copy className="h-3 w-3" />}
                        </Button>
                      )}

                      {/* Send link button */}
                      {item.status === 'link_pending' && item.scheduleId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => onSendLink(item.scheduleId!)}
                          disabled={isSending}
                        >
                          {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Enviar
                        </Button>
                      )}

                      {/* Mark as sent button */}
                      {item.status === 'link_pending' && item.scheduleId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          onClick={() => onMarkAsSent(item.scheduleId!)}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </Button>
                      )}

                      {/* Resend link button */}
                      {(item.status === 'no_show' || item.status === 'link_sent') && item.scheduleId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => onSendLink(item.scheduleId!)}
                          disabled={isSending}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reenviar
                        </Button>
                      )}

                      {/* Meet link */}
                      {item.meetLink && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                          <a href={item.meetLink} target="_blank" rel="noopener noreferrer">
                            <Video className="h-3 w-3" />
                          </a>
                        </Button>
                      )}

                      {/* Appointment detail */}
                      {item.appointmentId && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                          <Link to={`/appointments/${item.appointmentId}`}>
                            <Eye className="h-3 w-3" />
                          </Link>
                        </Button>
                      )}

                      {/* View athlete */}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" title="Abrir perfil do atleta" asChild>
                        <Link to={`/clients/${item.clientId}`}>
                          <User className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
