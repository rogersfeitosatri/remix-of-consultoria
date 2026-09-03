import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarCheck, Send, CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
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
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState } from 'react';

interface PipelineTimelineTabProps {
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
  confirmation_status: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, variant: 'outline', className: 'border-muted-foreground/30 text-muted-foreground' },
  sent: { label: 'Link Enviado', icon: Send, variant: 'secondary', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  link_sent: { label: 'Link Enviado', icon: Send, variant: 'secondary', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  scheduled: { label: 'Agendada', icon: CalendarCheck, variant: 'default', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  completed: { label: 'Realizada', icon: CheckCircle2, variant: 'default', className: 'bg-emerald-600 text-white' },
  cancelled: { label: 'Cancelada', icon: XCircle, variant: 'destructive', className: '' },
  rescheduled: { label: 'Reagendada', icon: RefreshCw, variant: 'secondary', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
};

export function PipelineTimelineTab({ clientId }: PipelineTimelineTabProps) {
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: schedules = [], isLoading, refetch } = useQuery({
    queryKey: ['pipeline-timeline', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultation_schedules')
        .select('id, scheduled_date, send_link_date, scheduled_time, status, link_sent_at, appointment_id, confirmation_status')
        .eq('client_id', clientId)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data as ScheduleRow[];
    },
  });

  const handleResendLink = async (scheduleId: string) => {
    setResendingId(scheduleId);
    try {
      const { data, error } = await supabase.functions.invoke('send-booking-link', {
        body: {
          consultationScheduleId: scheduleId,
          clientId,
          messageType: 'booking_invite',
          triggeredBy: 'manual_admin',
        },
      });
      if (error) throw error;
      if (data?.success) toast.success('Link reenviado com sucesso!');
      else if (data?.blocked) toast.warning(`Bloqueado: ${data.reason || 'duplicado'}`);
      else toast.error('Falha ao reenviar link');
      await refetch();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao reenviar link');
    } finally {
      setResendingId(null);
    }
  };

  const handleDelete = async (sch: ScheduleRow) => {
    setDeletingId(sch.id);
    try {
      if (sch.appointment_id) {
        await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', sch.appointment_id);
      }
      const { error } = await supabase.from('consultation_schedules').delete().eq('id', sch.id);
      if (error) throw error;
      toast.success('Consulta excluída da pipeline.');
      await refetch();
      qc.invalidateQueries({ queryKey: ['audit-schedules', clientId] });
      qc.invalidateQueries({ queryKey: ['audit-appointments', clientId] });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir consulta');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
        <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Nenhuma consulta projetada</p>
        <p className="text-sm mt-1">A pipeline será gerada quando o plano tiver consultas configuradas.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pipeline de Consultas</h3>
          <p className="text-xs text-muted-foreground">Linha do tempo das consultas projetadas, agendadas e realizadas.</p>
        </div>
        <Badge variant="outline" className="text-xs">{schedules.length} consulta(s)</Badge>
      </div>

      <div className="relative space-y-3">
        {schedules.map((sch, idx) => {
          const cfg = STATUS_CONFIG[sch.status] || STATUS_CONFIG.pending;
          const Icon = cfg.icon;
          const isPast = new Date(sch.scheduled_date) < new Date();
          const canResend = ['pending', 'sent', 'link_sent'].includes(sch.status);

          return (
            <div key={sch.id} className="flex gap-3 items-start">
              {/* Timeline rail */}
              <div className="flex flex-col items-center pt-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${cfg.className || 'bg-muted'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                {idx < schedules.length - 1 && <div className="w-px flex-1 bg-border min-h-[24px] mt-1" />}
              </div>

              {/* Content */}
              <div className="flex-1 rounded-lg border bg-card/50 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        Consulta #{idx + 1}
                      </span>
                      <Badge variant={cfg.variant} className={cfg.className}>{cfg.label}</Badge>
                      {sch.status === 'pending' && isPast && (
                        <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Atrasada</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      📅 Prevista: {format(parseISO(sch.scheduled_date), "EEEE, dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      {sch.scheduled_time && ` às ${sch.scheduled_time.slice(0, 5)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      📨 Envio do link: {format(parseISO(sch.send_link_date), "dd/MM/yyyy", { locale: ptBR })}
                      {sch.link_sent_at && ` · enviado em ${format(parseISO(sch.link_sent_at), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canResend && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResendLink(sch.id)}
                        disabled={resendingId === sch.id}
                        className="gap-1 text-xs"
                      >
                        <Send className="h-3 w-3" />
                        {resendingId === sch.id ? 'Enviando...' : 'Reenviar link'}
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deletingId === sch.id}
                          className="gap-1 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir esta consulta da pipeline?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A consulta #{idx + 1} será removida da pipeline. Se houver um agendamento
                            vinculado, ele será cancelado. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(sch)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
