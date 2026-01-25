import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskCard } from './TaskCard';
import { TaskWithLabels } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

interface TaskColumnProps {
  dayOfWeek: number;
  tasks: TaskWithLabels[];
  onAddTask: (dayOfWeek: number) => void;
  onEditTask: (task: TaskWithLabels) => void;
  onArchiveTask: (task: TaskWithLabels) => void;
  onDeleteTask: (task: TaskWithLabels) => void;
  onTogglePin: (task: TaskWithLabels) => void;
}

export function TaskColumn({
  dayOfWeek,
  tasks,
  onAddTask,
  onEditTask,
  onArchiveTask,
  onDeleteTask,
  onTogglePin,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${dayOfWeek}`,
    data: { dayOfWeek },
  });

  const today = new Date().getDay();
  const isToday = dayOfWeek === today;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-64 bg-muted/30 rounded-lg p-3 flex flex-col',
        isOver && 'ring-2 ring-primary/50',
        isToday && 'bg-primary/10'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={cn(
          'font-semibold text-sm',
          isToday && 'text-primary'
        )}>
          {WEEKDAY_NAMES[dayOfWeek]}
          {isToday && <span className="ml-2 text-xs font-normal">(Hoje)</span>}
        </h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground mb-2"
        onClick={() => onAddTask(dayOfWeek)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Adicionar tarefa
      </Button>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onArchive={onArchiveTask}
              onDelete={onDeleteTask}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
