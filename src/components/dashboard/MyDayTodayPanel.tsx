import { useMyDayToday } from '@/hooks/useMyDayToday';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarCheck, ListTodo, MessageSquare, AlertTriangle, Video, ExternalLink, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export function MyDayTodayPanel() {
  const { data, isLoading } = useMyDayToday();
  const navigate = useNavigate();

  if (isLoading) {
    return <Skeleton className="h-36 w-full rounded-xl" />;
  }

  if (!data) return null;

  const { appointments, tasks, pendingCheckins, urgentAthletes } = data;
  const overdueTasks = tasks.filter(t => t.is_overdue);
  const todayTasks = tasks.filter(t => !t.is_overdue);
  const totalItems = appointments.length + tasks.length + pendingCheckins.length + urgentAthletes.length;

  if (totalItems === 0) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="flex items-center gap-3 py-4 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
            <CalendarCheck className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Tudo em dia! 🎉</p>
            <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente ou consulta agendada para hoje.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <CalendarCheck className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-sm sm:text-base">Meu Dia Hoje</h3>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {appointments.length > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0.5">
                {appointments.length} consulta{appointments.length > 1 ? 's' : ''}
              </Badge>
            )}
            {overdueTasks.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                {overdueTasks.length} atrasada{overdueTasks.length > 1 ? 's' : ''}
              </Badge>
            )}
            {todayTasks.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                {todayTasks.length} tarefa{todayTasks.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Appointments */}
        {appointments.length > 0 && (
          <div className="space-y-1.5">
            {appointments.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 text-sm border border-border/50">
                <div className="flex items-center gap-2 min-w-0">
                  <Video className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate font-medium">{a.client_name}</span>
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
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overdue tasks */}
        {overdueTasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Tarefas atrasadas
            </p>
            {overdueTasks.slice(0, 3).map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-lg bg-destructive/5 px-3 py-2 text-sm border border-destructive/20">
                <div className="flex items-center gap-2 min-w-0">
                  <ListTodo className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <span className="truncate text-xs">{t.title}</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={() => navigate('/tasks')}>
                  Ir
                </Button>
              </div>
            ))}
            {overdueTasks.length > 3 && (
              <Button variant="link" size="sm" className="h-6 text-xs p-0" onClick={() => navigate('/tasks')}>
                +{overdueTasks.length - 3} mais
              </Button>
            )}
          </div>
        )}

        {/* Today tasks */}
        {todayTasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Tarefas para hoje
            </p>
            {todayTasks.slice(0, 3).map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 text-sm border border-border/50">
                <div className="flex items-center gap-2 min-w-0">
                  <ListTodo className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-xs">{t.title}</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={() => navigate('/tasks')}>
                  Ir
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Pending checkins */}
        {pendingCheckins.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-warning flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Check-ins aguardando resposta
            </p>
            {pendingCheckins.slice(0, 3).map(c => (
              <div key={c.client_id} className="flex items-center justify-between rounded-lg bg-warning/5 px-3 py-2 text-sm border border-warning/20">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-xs font-medium">{c.client_name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">há {c.days_waiting}d</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={() => navigate(`/clients/${c.client_id}`)}>
                  Ver
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Urgent athletes */}
        {urgentAthletes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Planos vencendo
            </p>
            {urgentAthletes.slice(0, 3).map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-destructive/5 px-3 py-2 text-sm border border-destructive/20">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-xs font-medium">{a.name}</span>
                  <Badge variant="destructive" className="text-[10px] px-1 py-0">{a.days_left}d</Badge>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={() => navigate(`/clients/${a.id}`)}>
                  Ver
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
