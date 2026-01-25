import { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Archive, Loader2 } from 'lucide-react';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskDialog } from './TaskDialog';
import {
  useTasks,
  useTaskLabels,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  TaskWithLabels,
} from '@/hooks/useTasks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function TaskBoard() {
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithLabels | null>(null);
  const [defaultDay, setDefaultDay] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TaskWithLabels | null>(null);

  const { data: tasks = [], isLoading } = useTasks(showArchived);
  const { data: labels = [] } = useTaskLabels();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const tasksByDay = useMemo(() => {
    const grouped: Record<number, TaskWithLabels[]> = {};
    for (let i = 0; i < 7; i++) {
      grouped[i] = [];
    }
    tasks.forEach((task) => {
      if (!showArchived && task.is_archived) return;
      grouped[task.day_of_week]?.push(task);
    });
    // Sort each day: pinned first, then by order_index
    Object.keys(grouped).forEach((key) => {
      grouped[Number(key)].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return a.order_index - b.order_index;
      });
    });
    return grouped;
  }, [tasks, showArchived]);

  const activeTask = activeId
    ? tasks.find((t) => t.id === activeId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Optional: could implement preview here
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Check if dropped on a column
    const overData = over.data.current;
    let targetDay = task.day_of_week;

    if (overData?.dayOfWeek !== undefined) {
      targetDay = overData.dayOfWeek;
    } else {
      // Dropped on another task
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) {
        targetDay = overTask.day_of_week;
      }
    }

    if (targetDay !== task.day_of_week) {
      updateTask.mutate({
        id: taskId,
        day_of_week: targetDay,
      });
    } else if (over.id !== active.id) {
      // Reorder within same column
      const oldIndex = tasksByDay[targetDay].findIndex((t) => t.id === active.id);
      const newIndex = tasksByDay[targetDay].findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(tasksByDay[targetDay], oldIndex, newIndex);
        // Update order_index for affected tasks
        newOrder.forEach((t, index) => {
          if (t.order_index !== index) {
            updateTask.mutate({ id: t.id, order_index: index });
          }
        });
      }
    }
  };

  const handleAddTask = (dayOfWeek: number) => {
    setEditingTask(null);
    setDefaultDay(dayOfWeek);
    setDialogOpen(true);
  };

  const handleEditTask = (task: TaskWithLabels) => {
    setEditingTask(task);
    setDefaultDay(task.day_of_week);
    setDialogOpen(true);
  };

  const handleArchiveTask = (task: TaskWithLabels) => {
    updateTask.mutate({
      id: task.id,
      is_archived: !task.is_archived,
    });
  };

  const handleDeleteTask = (task: TaskWithLabels) => {
    setDeleteConfirm(task);
  };

  const handleTogglePin = (task: TaskWithLabels) => {
    updateTask.mutate({
      id: task.id,
      is_pinned: !task.is_pinned,
    });
  };

  const handleSaveTask = (data: {
    title: string;
    description?: string;
    day_of_week: number;
    due_date?: string;
    label_ids: string[];
  }) => {
    if (editingTask) {
      updateTask.mutate({
        id: editingTask.id,
        ...data,
      });
    } else {
      createTask.mutate(data);
    }
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteTask.mutate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Quadro de Tarefas</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-sm flex items-center gap-1.5">
              <Archive className="h-4 w-4" />
              Mostrar arquivadas
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => (
              <TaskColumn
                key={dayOfWeek}
                dayOfWeek={dayOfWeek}
                tasks={tasksByDay[dayOfWeek]}
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onArchiveTask={handleArchiveTask}
                onDeleteTask={handleDeleteTask}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="opacity-80">
                <TaskCard
                  task={activeTask}
                  onEdit={() => {}}
                  onArchive={() => {}}
                  onDelete={() => {}}
                  onTogglePin={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <TaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          task={editingTask}
          defaultDayOfWeek={defaultDay}
          labels={labels}
          onSave={handleSaveTask}
        />

        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A tarefa "{deleteConfirm?.title}" será
                excluída permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
