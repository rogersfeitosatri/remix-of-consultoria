import { useMemo, useState } from 'react';
import { useTasks, useCompleteTask, useUpdateTask, useDeleteTask, useCreateTask, useTaskLabels, TaskWithLabels } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, addMonths, isSameMonth, isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TaskDialog } from './TaskDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';

export function MonthlyTaskView() {
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithLabels | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const { data: tasks = [] } = useTasks(false);
  const { data: labels = [] } = useTaskLabels();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const completeTask = useCompleteTask();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const tasksByDate = useMemo(() => {
    const m = new Map<string, TaskWithLabels[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const arr = m.get(t.due_date) || [];
      arr.push(t);
      m.set(t.due_date, arr);
    });
    return m;
  }, [tasks]);

  const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
  const selectedTasks = selectedDate ? tasksByDate.get(dayKey(selectedDate)) || [] : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCursor((d) => addMonths(d, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-lg font-semibold capitalize">
          {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
        </div>
        <Button variant="outline" size="sm" onClick={() => setCursor((d) => addMonths(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const k = dayKey(d);
          const tList = tasksByDate.get(k) || [];
          const inMonth = isSameMonth(d, cursor);
          return (
            <button
              key={k}
              onClick={() => setSelectedDate(d)}
              className={cn(
                'min-h-[80px] p-1.5 rounded-md border text-left text-xs hover:border-primary transition-colors',
                inMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground',
                isToday(d) && 'ring-2 ring-primary'
              )}
            >
              <div className="font-semibold mb-1">{format(d, 'd')}</div>
              <div className="space-y-0.5">
                {tList.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      'truncate px-1 rounded text-[10px]',
                      t.status === 'done' && 'line-through opacity-50',
                      t.status === 'overdue' ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary'
                    )}
                  >
                    {t.title}
                  </div>
                ))}
                {tList.length > 3 && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">+{tList.length - 3}</Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Sheet open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="capitalize">
              {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                setEditingTask(null);
                setDefaultDate(selectedDate);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Nova tarefa neste dia
            </Button>
            {selectedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem tarefas.</p>
            ) : (
              selectedTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onEdit={(task) => { setEditingTask(task); setDialogOpen(true); }}
                  onArchive={(task) => updateTask.mutate({ id: task.id, is_archived: !task.is_archived })}
                  onDelete={(task) => deleteTask.mutate(task.id)}
                  onTogglePin={(task) => updateTask.mutate({ id: task.id, is_pinned: !task.is_pinned })}
                  onComplete={(task) => completeTask.mutate(task.id)}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultDayOfWeek={(defaultDate || selectedDate || new Date()).getDay()}
        labels={labels}
        onSave={(data) => {
          const payload = {
            ...data,
            due_date: data.due_date || (defaultDate ? format(defaultDate, 'yyyy-MM-dd') : undefined),
          };
          if (editingTask) updateTask.mutate({ id: editingTask.id, ...payload });
          else createTask.mutate(payload);
        }}
      />
    </div>
  );
}
