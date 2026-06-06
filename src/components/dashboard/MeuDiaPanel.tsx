import { useMyDayToday } from '@/hooks/useMyDayToday';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  CalendarDays,
  MessageSquare,
  Send,
  ExternalLink,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function MeuDiaPanel() {
  const { data, isLoading } = useMyDayToday();
  const navigate = useNavigate();

  const today = new Date();
  const greeting = 'Bom dia, Roger!';
  const dateStr = format(today, "EEEE, d 'de' MMMM", { locale: ptBR });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    appointments,
    tasks,
    pendingCheckins,
    urgentAthletes,
    newCheckinResponses,
    periodicityAlerts,
    bookingLinksToSend,
  } = data;

  const overdueTasks = tasks.filter(t => t.is_overdue);

  // Build urgent items list (red first, then yellow), max 5
  type UrgentItem = {
    key: string;
    label: string;
    reason: string;
    severity: 'red' | 'yellow';
    clientId?: string;
  };

  const urgentItems: UrgentItem[] = [];

  // Red: periodicity late (>7d overdue)
  for (const a of periodicityAlerts.filter(a => a.status === 'late')) {
    urgentItems.push({
      key: `per-${a.client_id}`,
      label: a.client_name,
      reason: `Periodicidade atrasada ${a.days_overdue}d`,
      severity: 'red',
      clientId: a.client_id,
    });
  }

  // Red: plan expiring ≤3 days
  for (const a of urgentAthletes.filter(a => a.days_left <= 3)) {
    urgentItems.push({
      key: `ath-${a.id}`,
      label: a.name,
      reason: `Plano vence em ${a.days_left}d`,
      severity: 'red',
      clientId: a.id,
    });
  }

  // Red: overdue tasks
  for (const t of overdueTasks) {
    urgentItems.push({
      key: `task-${t.id}`,
      label: t.title,
      reason: 'Tarefa atrasada',
      severity: 'red',
      clientId: t.client_id || undefined,
    });
  }

  // Yellow: periodicity attention (4-7d overdue)
  for (const a of periodicityAlerts.filter(a => a.status === 'attention')) {
    urgentItems.push({
      key: `per-att-${a.client_id}`,
      label: a.client_name,
      reason: `Periodicidade há ${a.days_overdue}d`,
      severity: 'yellow',
      clientId: a.client_id,
    });
  }

  // Yellow: plan expiring 4-7 days
  for (const a of urgentAthletes.filter(a => a.days_left > 3 && a.days_left <= 7)) {
    urgentItems.push({
      key: `ath-att-${a.id}`,
      label: a.name,
      reason: `Plano vence em ${a.days_left}d`,
      severity: 'yellow',
      clientId: a.id,
    });
  }

  const topUrgentItems = urgentItems.slice(0, 5);

  // Checkin responses received today
  const todayStr = format(today, 'yyyy-MM-dd');
  const checkinsPendingOver2d = pendingCheckins.filter(c => c.days_waiting > 2);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-primary/10 to-transparent px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">{greeting}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground capitalize">{dateStr}</p>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Quadrant 1 — URGENTE */}
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Urgente
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1.5 max-h-52 overflow-y-auto">
            {topUrgentItems.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Sem urgências hoje</span>
              </div>
            ) : (
              topUrgentItems.map(item => (
                <div
                  key={item.key}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${
                    item.severity === 'red'
                      ? 'bg-destructive/5 border-destructive/20'
                      : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-xs font-medium">{item.label}</span>
                    <Badge
                      variant={item.severity === 'red' ? 'destructive' : 'outline'}
                      className={`text-[10px] px-1 py-0 shrink-0 ${
                        item.severity === 'yellow'
                          ? 'border-amber-400 text-amber-700 dark:text-amber-400'
                          : ''
                      }`}
                    >
                      {item.reason}
                    </Badge>
                  </div>
                  {item.clientId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={() => navigate(`/clients/${item.clientId}`)}
                    >
                      Ver
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quadrant 2 — CONSULTAS HOJE */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Consultas Hoje
              {appointments.length > 0 && (
                <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0">
                  {appointments.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1.5 max-h-52 overflow-y-auto">
            {appointments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma consulta agendada</p>
            ) : (
              appointments.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 text-sm border border-border/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {a.appointment_time?.substring(0, 5)}
                    </span>
                    <button
                      className="truncate text-xs font-medium hover:underline text-left"
                      onClick={() => navigate(`/clients/${a.client_id}`)}
                    >
                      {a.client_name}
                    </button>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {a.google_meet_link && (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
                        <a href={a.google_meet_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Meet
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => navigate(`/clients/${a.client_id}`)}
                    >
                      Ver
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quadrant 3 — CHECKINS NOVOS */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-500" />
              Checkins Novos
              {(newCheckinResponses.length > 0 || checkinsPendingOver2d.length > 0) && (
                <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400">
                  {newCheckinResponses.length + checkinsPendingOver2d.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2 max-h-52 overflow-y-auto">
            {newCheckinResponses.length === 0 && checkinsPendingOver2d.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum checkin pendente</p>
            ) : (
              <>
                {newCheckinResponses.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Respondidos hoje
                    </p>
                    {newCheckinResponses.map(r => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 text-sm border border-border/50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate text-xs font-medium">{r.client_name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {r.submitted_at ? format(new Date(r.submitted_at), 'HH:mm') : ''}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs shrink-0"
                          onClick={() => navigate(`/clients/${r.client_id}`)}
                        >
                          Ver
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {checkinsPendingOver2d.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Aguardando (&gt;2d)
                    </p>
                    {checkinsPendingOver2d.map(c => (
                      <div
                        key={c.client_id}
                        className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/30"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate text-xs font-medium">{c.client_name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            há {c.days_waiting}d
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs shrink-0"
                          onClick={() => navigate(`/clients/${c.client_id}`)}
                        >
                          Ver
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quadrant 4 — PARA ENVIAR HOJE */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              Para Enviar Hoje
              {bookingLinksToSend.length > 0 && (
                <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 border-blue-400 text-blue-700 dark:text-blue-400">
                  {bookingLinksToSend.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1.5 max-h-52 overflow-y-auto">
            {bookingLinksToSend.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum envio programado</p>
            ) : (
              bookingLinksToSend.map(s => (
                <div
                  key={s.schedule_id}
                  className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 text-sm border border-border/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      className="truncate text-xs font-medium hover:underline text-left"
                      onClick={() => navigate(`/clients/${s.client_id}`)}
                    >
                      {s.client_name}
                    </button>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                      Automático
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
