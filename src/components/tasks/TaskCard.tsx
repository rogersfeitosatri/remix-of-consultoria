import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GripVertical, Pin, Calendar, Pencil, Archive, Trash2, Clock, UtensilsCrossed } from 'lucide-react';
import { TaskWithLabels } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskCardProps {
  task: TaskWithLabels;
  onEdit: (task: TaskWithLabels) => void;
  onArchive: (task: TaskWithLabels) => void;
  onDelete: (task: TaskWithLabels) => void;
  onTogglePin: (task: TaskWithLabels) => void;
  isMealPlanTask?: boolean;
  onMarkMealPlanSent?: (task: TaskWithLabels) => void;
}

export function TaskCard({ 
  task, 
  onEdit, 
  onArchive, 
  onDelete, 
  onTogglePin,
  isMealPlanTask = false,
  onMarkMealPlanSent,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Check if this is a meal plan task based on title
  const isMealPlan = isMealPlanTask || task.title.toLowerCase().includes('plano alimentar');

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-3 cursor-pointer hover:border-primary/50 transition-colors group',
        isDragging && 'opacity-50 shadow-lg',
        task.is_pinned && 'border-primary/30 bg-primary/5',
        isMealPlan && 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20'
      )}
    >
      <div className="flex items-start gap-2">
        {isMealPlan && onMarkMealPlanSent ? (
          <Checkbox
            checked={false}
            onCheckedChange={() => onMarkMealPlanSent(task)}
            className="mt-0.5 border-orange-400 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
            title="Marcar plano como enviado"
          />
        ) : (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isMealPlan && (
                <UtensilsCrossed className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              )}
              <h4 className={cn(
                "font-medium text-sm leading-tight",
                isMealPlan && "text-orange-800 dark:text-orange-200"
              )}>
                {task.title}
              </h4>
            </div>
            {task.is_pinned && (
              <Pin className="h-3 w-3 text-primary flex-shrink-0" />
            )}
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          {task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.labels.map((label) => (
                <Badge
                  key={label.id}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                  style={{ backgroundColor: label.color + '30', color: label.color }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          )}

          {(task.due_date || task.due_time) && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              {task.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.due_date), 'dd MMM', { locale: ptBR })}
                </span>
              )}
              {task.due_time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {task.due_time.slice(0, 5)}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(task);
              }}
              title={task.is_pinned ? 'Desafixar' : 'Fixar'}
            >
              <Pin className={cn('h-3 w-3', task.is_pinned && 'fill-current')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              title="Editar"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onArchive(task);
              }}
              title="Arquivar"
            >
              <Archive className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task);
              }}
              title="Excluir"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
