/**
 * ETAPA 4B — Agenda do Dia.
 *
 * Usa a MESMA camada operacional do dashboard (useOperationalDashboard):
 * mesmos SLAs em dias úteis, mesma deduplicação, mesmos rótulos.
 * Operações derivadas (check-in, plano, anamnese, convite) NÃO têm checkbox:
 * só se resolvem na entidade de origem.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarCheck2,
  CheckCircle2,
  AlertTriangle,
  User,
  Clock,
  ExternalLink,
  Send,
  RefreshCw,
  Loader2,
  CloudOff,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCompleteTask } from '@/hooks/useTasks';
import { useOperationalDashboard } from '@/hooks/useOperationalDashboard';
import { OPERATION_LABEL, overdueBusinessDays, type Operation } from '@/lib/dashboardOperations';
import {
  dayAgendaSections,
  googleSyncState,
  isManualOperation,
  type AppointmentLike,
} from '@/lib/calendarProjection';
import { Link } from 'react-router-dom';

interface DayAgendaPanelProps {
  date: Date;
  appointments?: AppointmentLike[];
  /** Envios de link pendentes já vêm como operação (booking_invite) do dashboard. */
  onOpenLinkDialog?: () => void;
}

function OperationRow({
  op,
  overdue,
  holidays,
  onComplete,
  completing,
}: {
  op: Operation;
  overdue: boolean;
  holidays: Set<string>;
  onComplete: (id: string) => void;
  completing: boolean;
}) {
  const manual = isManualOperation(op);
  const lateDays = overdue && op.dueDate ? overdueBusinessDays(op, holidays, new Date()) : 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-2 transition-colors',
        overdue ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-muted/30 hover:bg-muted/50',
      )}
    >
      {manual ? (
        <Checkbox
          checked={false}
          onCheckedChange={() => op.sourceId && onComplete(op.sourceId)}
          disabled={completing || !op.sourceId}
          className="flex-shrink-0"
          aria-label={`Concluir ${op.title}`}
        />
      ) : (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
          <span className={cn('h-2 w-2 rounded-full', overdue ? 'bg-destructive' : 'bg-primary/60')} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', overdue && 'text-destructive')}>{op.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          {op.clientName}
          {lateDays > 0 && <span className="text-destructive">• {lateDays}d úteis de atraso</span>}
        </p>
      </div>
      <Badge variant="outline" className="hidden shrink-0 text-[10px] sm:inline-flex">
        {OPERATION_LABEL[op.kind]}
      </Badge>
      <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs" asChild>
        <Link to={op.route}>{manual ? <ExternalLink className="h-3 w-3" /> : 'Resolver'}</Link>
      </Button>
    </div>
  );
}

export function DayAgendaPanel({ date, appointments = [], onOpenLinkDialog }: DayAgendaPanelProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { operations, isLoading, error, refetch, holidays } = useOperationalDashboard();
  const completeTask = useCompleteTask();

  const sections = useMemo(
    () => dayAgendaSections(operations, appointments, dateStr, new Date()),
    [operations, appointments, dateStr],
  );

  const pendingInvites = useMemo(
    () => sections.today.filter((o) => o.kind === 'booking_invite').length + sections.overdue.filter((o) => o.kind === 'booking_invite').length,
    [sections],
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando agenda…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <p className="text-sm text-destructive">Não foi possível carregar a agenda do dia.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1">
            <RefreshCw className="h-3 w-3" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (sections.total === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhuma atividade para {format(date, "dd 'de' MMMM", { locale: ptBR })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            📋 Agenda do Dia — {format(date, "dd 'de' MMMM", { locale: ptBR })}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {sections.overdue.length > 0 && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                {sections.overdue.length} atrasada{sections.overdue.length > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {sections.total} item{sections.total > 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[420px]">
          <div className="space-y-3">
            {sections.appointments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consultas</p>
                {sections.appointments.map((apt) => {
                  const clientName = apt.client?.name || 'Cliente';
                  const needsAttention = sections.attention.some((a) => a.id === apt.id);
                  const sync = googleSyncState(apt);
                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-2',
                        needsAttention
                          ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'
                          : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20',
                      )}
                    >
                      <CalendarCheck2
                        className={cn(
                          'h-4 w-4 flex-shrink-0',
                          needsAttention ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{clientName}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {apt.appointment_time?.substring(0, 5)}
                          {needsAttention && <span className="text-amber-600">• confirmar realização</span>}
                          {apt.status === 'completed' && <span>• realizada</span>}
                        </p>
                      </div>
                      {sync !== 'synced' && apt.status !== 'completed' && (
                        <span
                          className="flex items-center gap-1 text-[10px] text-muted-foreground"
                          title={sync === 'pending' ? 'Sem evento no Google Agenda' : 'Sem link do Meet'}
                        >
                          <CloudOff className="h-3 w-3" />
                          {sync === 'pending' ? 'sem Google' : 'sem Meet'}
                        </span>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                        <Link to={`/appointments/${apt.id}`}>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {sections.overdue.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
                  Atrasadas ({sections.overdue.length})
                </p>
                {sections.overdue.map((op) => (
                  <OperationRow
                    key={op.id}
                    op={op}
                    overdue
                    holidays={holidays}
                    onComplete={(id) => completeTask.mutate(id)}
                    completing={completeTask.isPending}
                  />
                ))}
              </div>
            )}

            {sections.today.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Do dia ({sections.today.length})
                  </p>
                  {pendingInvites > 0 && onOpenLinkDialog && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" onClick={onOpenLinkDialog}>
                      <Send className="mr-1 h-3 w-3" /> Gerenciar envios
                    </Button>
                  )}
                </div>
                {sections.today.map((op) => (
                  <OperationRow
                    key={op.id}
                    op={op}
                    overdue={false}
                    holidays={holidays}
                    onComplete={(id) => completeTask.mutate(id)}
                    completing={completeTask.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
