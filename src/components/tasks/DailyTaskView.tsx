import { useMemo, useState } from 'react';
import { useTasks, useCompleteTask, useUpdateTask, useDeleteTask, useCreateTask, useTaskLabels, TaskWithLabels } from '@/hooks/useTasks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Sun, Sunset, Moon } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { TaskDialog } from './TaskDialog';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

type Shift = 'morning' | 'afternoon' | 'evening' | 'unscheduled';

const SHIFT_META: Record<Shift, { label: string; icon: typeof Sun; color: string; range: string }> = {
  morning: { label: 'Manhã', icon: Sun, color: 'text-amber-500', range: '06:00–12:00' },
  afternoon: { label: 'Tarde', icon: Sunset, color: 'text-orange-500', range: '12:00–18:00' },
  evening: { label: 'Noite', icon: Moon, color: 'text-indigo-500', range: '18:00–23:59' },
  unscheduled: { label: 'Sem horário', icon: Sun, color: 'text-muted-foreground', range: '' },
};

function shiftOf(time: string | null): Shift {
  if (!time) return 'unscheduled';
  const h = parseInt(time.slice(0, 2), 10);
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function ShiftColumn({
  shift,
  tasks,
  onAdd,
  onEdit,
  onArchive,
  onDelete,
  onTogglePin,
  onComplete,
}: any) {
  const meta = SHIFT_META[shift as Shift];
  const Icon = meta.icon;
  const { setNodeRef, isOver } = useDroppable({ id: `shift-${shift}`, data: { shift } });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] bg-muted/30 rounded-lg p-3 ${isOver ? 'ring-2 ring-primary/50' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${meta.color}`} />
          <h3 className="font-semibold text-sm">{meta.label}</h3>
          {meta.range && <span className="text-[10px] text-muted-foreground">{meta.range}</span>}
        </div>
        <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
      </div>
      <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground mb-2" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" /> Adicionar
      </Button>
      <SortableContext items={tasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {tasks.map((t: TaskWithLabels) => (
            <TaskCard
              key={t.id}
              task={t}
              onEdit={onEdit}
              onArchive={onArchive}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              onComplete={onComplete}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function DailyTaskView() {
  const [date, setDate] = useState(new Date());
  const { data: tasks = [] } = useTasks(false);
  const { data: labels = [] } = useTaskLabels();
  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithLabels | null>(null);
  const [defaultShift, setDefaultShift] = useState<Shift>('morning');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const dateStr = format(date, 'yyyy-MM-dd');
  const dayTasks = useMemo(
    () => tasks.filter((t) => t.due_date === dateStr || (!t.due_date && t.day_of_week === date.getDay())),
    [tasks, dateStr, date]
  );
  const grouped = useMemo(() => {
    const g: Record<Shift, TaskWithLabels[]> = { morning: [], afternoon: [], evening: [], unscheduled: [] };
    dayTasks.forEach((t) => g[shiftOf(t.due_time)].push(t));
    return g;
  }, [dayTasks]);

  const handleAdd = (shift: Shift) => {
    setEditingTask(null);
    setDefaultShift(shift);
    setDialogOpen(true);
  };

  const handleSave = (data: any) => {
    const shiftDefaults: Record<Shift, string> = {
      morning: '09:00', afternoon: '14:00', evening: '20:00', unscheduled: '',
    };
    const payload = {
      ...data,
      due_date: data.due_date || dateStr,
      due_time: data.due_time || (defaultShift !== 'unscheduled' ? shiftDefaults[defaultShift] : undefined),
    };
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, ...payload });
    } else {
      createTask.mutate({ ...payload, day_of_week: date.getDay() });
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const overData = e.over?.data.current as any;
    if (!overData?.shift) return;
    const task = tasks.find((t) => t.id === e.active.id);
    if (!task) return;
    const shift = overData.shift as Shift;
    const newTime: Record<Shift, string | null> = {
      morning: '09:00:00', afternoon: '14:00:00', evening: '20:00:00', unscheduled: null,
    };
    updateTask.mutate({ id: task.id, due_date: dateStr, due_time: newTime[shift] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setDate((d) => addDays(d, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <div className="text-lg font-semibold capitalize">
            {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
          <Button variant="link" size="sm" onClick={() => setDate(new Date())}>
            Hoje
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDate((d) => addDays(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-col lg:flex-row gap-4">
          {(['morning', 'afternoon', 'evening', 'unscheduled'] as Shift[]).map((s) => (
            <ShiftColumn
              key={s}
              shift={s}
              tasks={grouped[s]}
              onAdd={() => handleAdd(s)}
              onEdit={(t: TaskWithLabels) => { setEditingTask(t); setDialogOpen(true); }}
              onArchive={(t: TaskWithLabels) => updateTask.mutate({ id: t.id, is_archived: !t.is_archived })}
              onDelete={(t: TaskWithLabels) => deleteTask.mutate(t.id)}
              onTogglePin={(t: TaskWithLabels) => updateTask.mutate({ id: t.id, is_pinned: !t.is_pinned })}
              onComplete={(t: TaskWithLabels) => completeTask.mutate(t.id)}
            />
          ))}
        </div>
      </DndContext>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultDayOfWeek={date.getDay()}
        labels={labels}
        onSave={handleSave}
      />
    </div>
  );
}
