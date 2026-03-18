import { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
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
import { Badge } from '@/components/ui/badge';
import { Archive, Loader2, UtensilsCrossed, Plus, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { TaskDialog } from './TaskDialog';
import { MealPlanTaskDialog } from './MealPlanTaskDialog';
import {
  useTasks,
  useTaskLabels,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCompleteTask,
  TaskWithLabels,
} from '@/hooks/useTasks';
import { useMealPlanStatus, useMarkMealPlanSent } from '@/hooks/useMealPlanStatus';
import { toast } from 'sonner';
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
  const [mealPlanDialogOpen, setMealPlanDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithLabels | null>(null);
  const [defaultDay, setDefaultDay] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TaskWithLabels | null>(null);

  const { data: tasks = [], isLoading } = useTasks(showArchived);
  const { data: labels = [] } = useTaskLabels();
  const { data: mealPlanStatuses = [] } = useMealPlanStatus();
  const markMealPlanSent = useMarkMealPlanSent();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const completeTask = useCompleteTask();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Summary counts
  const overdueCount = useMemo(() => tasks.filter(t => t.status === 'overdue' && !t.is_archived).length, [tasks]);
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(t => t.due_date === today && t.status !== 'done' && !t.is_archived).length;
  }, [tasks]);
  const pendingCount = useMemo(() => tasks.filter(t => (t.status === 'pending' || t.status === 'in_progress') && !t.is_archived).length, [tasks]);

  const tasksByDay = useMemo(() => {
    const grouped: Record<number, TaskWithLabels[]> = {};
    for (let i = 0; i < 7; i++) grouped[i] = [];
    tasks.forEach((task) => {
      if (!showArchived && task.is_archived) return;
      grouped[task.day_of_week]?.push(task);
    });
    Object.keys(grouped).forEach((key) => {
      grouped[Number(key)].sort((a, b) => {
        // Overdue first, then pinned, then by priority, then order_index
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (a.status !== 'overdue' && b.status === 'overdue') return 1;
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return a.order_index - b.order_index;
      });
    });
    return grouped;
  }, [tasks, showArchived]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const overData = over.data.current;
    let targetDay = task.day_of_week;

    if (overData?.dayOfWeek !== undefined) {
      targetDay = overData.dayOfWeek;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetDay = overTask.day_of_week;
    }

    if (targetDay !== task.day_of_week) {
      updateTask.mutate({ id: taskId, day_of_week: targetDay });
    } else if (over.id !== active.id) {
      const oldIndex = tasksByDay[targetDay].findIndex((t) => t.id === active.id);
      const newIndex = tasksByDay[targetDay].findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(tasksByDay[targetDay], oldIndex, newIndex);
        newOrder.forEach((t, index) => {
          if (t.order_index !== index) updateTask.mutate({ id: t.id, order_index: index });
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

  const handleCompleteTask = (task: TaskWithLabels) => {
    completeTask.mutate(task.id);
  };

  const handleArchiveTask = (task: TaskWithLabels) => {
    updateTask.mutate({ id: task.id, is_archived: !task.is_archived });
  };

  const handleDeleteTask = (task: TaskWithLabels) => setDeleteConfirm(task);

  const handleTogglePin = (task: TaskWithLabels) => {
    updateTask.mutate({ id: task.id, is_pinned: !task.is_pinned });
  };

  const handleMarkMealPlanSent = async (task: TaskWithLabels) => {
    const mealPlanStatus = mealPlanStatuses.find(mp => mp.task_id === task.id);
    if (mealPlanStatus) {
      markMealPlanSent.mutate(mealPlanStatus.client_id);
    } else {
      completeTask.mutate(task.id);
    }
  };

  const handleSaveTask = (data: {
    title: string;
    description?: string;
    day_of_week: number;
    due_date?: string;
    due_time?: string;
    label_ids: string[];
    client_id?: string;
    task_type?: any;
    priority?: any;
  }) => {
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, ...data });
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Quadro de Tarefas</CardTitle>
            {/* Summary badges */}
            <div className="flex items-center gap-1.5">
              {overdueCount > 0 && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
                </Badge>
              )}
              {todayCount > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  <Clock className="h-3 w-3" />
                  {todayCount} hoje
                </Badge>
              )}
              {pendingCount > 0 && overdueCount === 0 && todayCount === 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMealPlanDialogOpen(true)}
              className="gap-1.5 text-orange-700 border-orange-300 hover:bg-orange-50 hover:text-orange-800 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950/30"
            >
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">Plano Alimentar</span>
              <Plus className="h-3 w-3" />
            </Button>
            <div className="flex items-center gap-2">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived" className="text-sm flex items-center gap-1.5">
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">Mostrar arquivadas</span>
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
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
                onCompleteTask={handleCompleteTask}
                onMarkMealPlanSent={handleMarkMealPlanSent}
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

        <MealPlanTaskDialog
          open={mealPlanDialogOpen}
          onOpenChange={setMealPlanDialogOpen}
        />

        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A tarefa "{deleteConfirm?.title}" será excluída permanentemente.
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
