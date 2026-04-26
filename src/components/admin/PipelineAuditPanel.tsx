import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ShieldCheck,
  CalendarClock,
  Send,
  CheckCircle2,
  Undo2,
  Bot,
  UserCog,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState } from 'react';

interface Props {
  clientId: string;
}

interface ScheduleRow {
  id: string;
  scheduled_date: string;
  send_link_date: string;
  scheduled_time: string | null;
  status: string;
  link_sent_at: string | null;
  appointment_id: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
}

interface AppointmentRow {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  created_at: string;
  created_by: string | null;
  notes_admin: string | null;
}

interface ClientRow {
  created_at: string;
  start_date: string | null;
  consultation_count: number | null;
  remaining_consultations: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  sent: 'Link enviado',
  link_sent: 'Link enviado',
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  completed: 'Realizada',
  cancelled: 'Cancelada',
  no_show: 'Não compareceu',
  rescheduled: 'Reagendada',
};

export function PipelineAuditPanel({ clientId }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const { data: client } = useQuery({
    queryKey: ['audit-client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('created_at, start_date, consultation_count, remaining_consultations')
        .eq('id', clientId)
        .single();
      if (error) throw error;
      return data as ClientRow;
    },
  });

  const { data: schedules = [], isLoading: loadingSchedules, refetch: refetchSchedules } = useQuery({
    queryKey: ['audit-schedules', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultation_schedules')
        .select('id, scheduled_date, send_link_date, scheduled_time, status, link_sent_at, appointment_id, created_at, updated_at, confirmed_at')
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return (data || []) as ScheduleRow[];
    },
  });

  const { data: appointments = [], refetch: refetchAppointments } = useQuery({
    queryKey: ['audit-appointments', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, appointment_date, appointment_time, status, created_at, created_by, notes_admin')
        .eq('client_id', clientId)
        .order('appointment_date', { ascending: true });
      if (error) throw error;
      return (data || []) as AppointmentRow[];
    },
  });

  // Heurística: schedule criado automaticamente se created_at ≤ 5min após o cadastro do cliente
  const isAutoCreated = (createdAt: string) => {
    if (!client?.created_at) return false;
    return Math.abs(differenceInMinutes(parseISO(createdAt), parseISO(client.created_at))) <= 5;
  };

  const firstSchedule = schedules[0];
  const firstIsCompleted = firstSchedule?.status === 'completed';
  const firstAppointment = firstSchedule?.appointment_id
    ? appointments.find((a) => a.id === firstSchedule.appointment_id)
    : null;

  const handleToggleFirstCompleted = async () => {
    if (!firstSchedule || !client) return;
    setToggling(true);
    try {
      if (firstIsCompleted) {
        // Desmarcar: voltar schedule para pending e cancelar appointment auto
        const { error: schedErr } = await supabase
          .from('consultation_schedules')
          .update({
            status: 'pending',
            confirmed_at: null,
            appointment_id: null,
          })
          .eq('id', firstSchedule.id);
        if (schedErr) throw schedErr;

        if (firstAppointment) {
          await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', firstAppointment.id);
        }
        toast.success('1ª consulta desmarcada como realizada.');
      } else {
        // Marcar como realizada
        const { error: schedErr } = await supabase
          .from('consultation_schedules')
          .update({
            status: 'completed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', firstSchedule.id);
        if (schedErr) throw schedErr;

        // Criar appointment retroativo se não existir
        if (!firstSchedule.appointment_id) {
          const { data: userData } = await supabase.auth.getUser();
          const { data: newAppt, error: apptErr } = await supabase
            .from('appointments')
            .insert({
              client_id: clientId,
              user_id: userData.user?.id,
              appointment_date: firstSchedule.scheduled_date,
              appointment_time: firstSchedule.scheduled_time || '09:00:00',
              duration_minutes: 60,
              status: 'completed',
              timezone: 'America/Fortaleza',
              created_by: 'admin_manual_audit',
              notes_admin: 'Marcada como realizada manualmente via auditoria.',
            })
            .select('id')
            .single();
          if (apptErr) throw apptErr;
          if (newAppt) {
            await supabase
              .from('consultation_schedules')
              .update({ appointment_id: newAppt.id })
              .eq('id', firstSchedule.id);
          }
        }
        toast.success('1ª consulta marcada como realizada. Recalculando envios futuros...');
      }

      // Forçar recálculo da pipeline tocando no plano (dispara sync_pipeline_on_plan_change)
      const { data: c } = await supabase
        .from('clients')
        .select('end_date')
        .eq('id', clientId)
        .single();
      if (c?.end_date) {
        await supabase
          .from('clients')
          .update({ end_date: c.end_date })
          .eq('id', clientId);
      }

      await Promise.all([refetchSchedules(), refetchAppointments()]);
      qc.invalidateQueries({ queryKey: ['pipeline-timeline', clientId] });
      qc.invalidateQueries({ queryKey: ['client', clientId] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar 1ª consulta');
    } finally {
      setToggling(false);
    }
  };

  if (loadingSchedules) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  if (schedules.length === 0 && appointments.length === 0) {
    return null;
  }

  const autoSchedules = schedules.filter((s) => isAutoCreated(s.created_at));
  const manualSchedules = schedules.filter((s) => !isAutoCreated(s.created_at));
  const autoAppointments = appointments.filter(
    (a) => a.created_by === 'admin_manual_audit' || isAutoCreated(a.created_at),
  );

  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Auditoria da Pipeline</h3>
            <p className="text-xs text-muted-foreground">
              Histórico de schedules e consultas criados automaticamente ou manualmente.
            </p>
          </div>
        </div>

        {firstSchedule && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant={firstIsCompleted ? 'outline' : 'default'}
                disabled={toggling}
                className="gap-2"
              >
                {firstIsCompleted ? (
                  <>
                    <Undo2 className="h-4 w-4" />
                    Desmarcar 1ª como realizada
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar 1ª como realizada
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {firstIsCompleted
                    ? 'Desmarcar a 1ª consulta como realizada?'
                    : 'Marcar a 1ª consulta como realizada?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {firstIsCompleted
                    ? 'A 1ª consulta voltará ao status pendente. O appointment vinculado (se criado pela auditoria) será cancelado e os envios futuros serão recalculados.'
                    : 'A 1ª consulta será registrada como realizada e um appointment retroativo será criado. Os envios futuros serão recalculados a partir desta data.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleToggleFirstCompleted}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox icon={Bot} label="Schedules automáticos" value={autoSchedules.length} />
        <StatBox icon={UserCog} label="Schedules manuais" value={manualSchedules.length} />
        <StatBox icon={CalendarClock} label="Appointments totais" value={appointments.length} />
        <StatBox icon={Send} label="Links enviados" value={schedules.filter((s) => s.link_sent_at).length} />
      </div>

      {/* Toggle expand */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full gap-2 text-xs"
      >
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {expanded ? 'Ocultar detalhes' : 'Ver detalhes da auditoria'}
      </Button>

      {expanded && (
        <div className="space-y-4 pt-2 border-t">
          {/* Schedules */}
          <div>
            <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
              Consultation schedules ({schedules.length})
            </h4>
            <div className="space-y-2">
              {schedules.map((s, idx) => {
                const auto = isAutoCreated(s.created_at);
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border bg-card/50 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">#{idx + 1}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {STATUS_LABEL[s.status] || s.status}
                        </Badge>
                        {auto ? (
                          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] gap-1">
                            <Bot className="h-3 w-3" /> Automático
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <UserCog className="h-3 w-3" /> Manual
                          </Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        criado {format(parseISO(s.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="text-muted-foreground space-y-0.5">
                      <div>
                        📅 Consulta: {format(parseISO(s.scheduled_date), "dd/MM/yyyy", { locale: ptBR })}
                        {s.scheduled_time && ` às ${s.scheduled_time.slice(0, 5)}`}
                      </div>
                      <div>
                        📨 Envio link: {format(parseISO(s.send_link_date), 'dd/MM/yyyy', { locale: ptBR })}
                        {s.link_sent_at &&
                          ` · enviado em ${format(parseISO(s.link_sent_at), 'dd/MM HH:mm', { locale: ptBR })}`}
                      </div>
                      {s.confirmed_at && (
                        <div>
                          ✅ Confirmado em {format(parseISO(s.confirmed_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Appointments */}
          {appointments.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">
                Appointments ({appointments.length})
              </h4>
              <div className="space-y-2">
                {appointments.map((a) => {
                  const auto = a.created_by === 'admin_manual_audit' || isAutoCreated(a.created_at);
                  return (
                    <div key={a.id} className="rounded-lg border bg-card/50 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {STATUS_LABEL[a.status] || a.status}
                          </Badge>
                          {auto && (
                            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] gap-1">
                              <Bot className="h-3 w-3" />
                              {a.created_by === 'admin_manual_audit' ? 'Retroativa (auditoria)' : 'Automático'}
                            </Badge>
                          )}
                          {a.created_by && a.created_by !== 'admin_manual_audit' && (
                            <Badge variant="secondary" className="text-[10px]">
                              {a.created_by}
                            </Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {format(parseISO(a.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        📅 {format(parseISO(a.appointment_date), 'dd/MM/yyyy', { locale: ptBR })} às{' '}
                        {a.appointment_time.slice(0, 5)}
                      </div>
                      {a.notes_admin && (
                        <div className="text-muted-foreground italic">📝 {a.notes_admin}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-card/50 p-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-base font-semibold text-foreground leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  );
}
