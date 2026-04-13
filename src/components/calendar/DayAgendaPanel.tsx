import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarCheck2,
  UtensilsCrossed,
  MessageSquare,
  Zap,
  CheckCircle2,
  AlertTriangle,
  User,
  Clock,
  ExternalLink,
  Send,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useTasksByDate, useCompleteTask, Task, TaskStatus, TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '@/hooks/useTasks';
import { Link } from 'react-router-dom';

interface DayAgendaPanelProps {
  date: Date;
  appointments?: Array<{
    id: string;
    client_id: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    client?: { name: string; phone?: string };
  }>;
}

const TYPE_ICONS: Record<string, typeof UtensilsCrossed> = {
  meal_plan: UtensilsCrossed,
  checkin_response: MessageSquare,
  consultation_prep: CalendarCheck2,
  diet_adjustment: Zap,
  custom: CheckCircle2,
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  urgent: 'bg-destructive/10 text-destructive',
};

export function DayAgendaPanel({ date, appointments = [] }: DayAgendaPanelProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: tasks = [] } = useTasksByDate(dateStr);
  const completeTask = useCompleteTask();

  const dayAppointments = useMemo(() => {
    return appointments
      .filter(a => a.appointment_date === dateStr && (a.status === 'scheduled' || a.status === 'confirmed'))
      .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  }, [appointments, dateStr]);

  const sortedTasks = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...tasks].sort((a, b) => {
      // Overdue first
      const aOverdue = a.status === 'overdue' ? 0 : 1;
      const bOverdue = b.status === 'overdue' ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  }, [tasks]);

  const overdueCount = tasks.filter(t => t.status === 'overdue').length;
  const totalItems = dayAppointments.length + tasks.length;

  if (totalItems === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            📋 Agenda do Dia — {format(date, "dd 'de' MMMM", { locale: ptBR })}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {totalItems} item{totalItems > 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {/* Appointments */}
            {dayAppointments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consultas</p>
                {dayAppointments.map(apt => {
                  const clientName = apt.client?.name || 'Cliente';
                  return (
                    <div key={apt.id} className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                      <CalendarCheck2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{clientName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {apt.appointment_time?.substring(0, 5)}
                        </p>
                      </div>
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

            {/* Tasks */}
            {sortedTasks.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3">Tarefas</p>
                {sortedTasks.map(task => {
                  const TypeIcon = TYPE_ICONS[task.task_type] || CheckCircle2;
                  const isOverdue = task.status === 'overdue';

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border transition-colors",
                        isOverdue
                          ? "bg-destructive/5 border-destructive/20"
                          : "bg-muted/30 border-border hover:bg-muted/50"
                      )}
                    >
                      <Checkbox
                        checked={task.status === 'done'}
                        onCheckedChange={() => completeTask.mutate(task.id)}
                        disabled={completeTask.isPending}
                        className="flex-shrink-0"
                      />
                      <TypeIcon className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isOverdue ? "text-destructive" : "text-muted-foreground"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", isOverdue && "text-destructive")}>
                          {task.title}
                        </p>
                        {task.client_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.client_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge className={cn("text-[10px] px-1.5 py-0", PRIORITY_COLORS[task.priority])}>
                          {task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟡' : ''}
                          {TASK_TYPE_LABELS[task.task_type]}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
