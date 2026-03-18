import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GripVertical, Pin, Calendar, Pencil, Archive, Trash2, Clock, UtensilsCrossed, MessageSquare, User, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { TaskWithLabels, TASK_TYPE_LABELS, TASK_STATUS_LABELS, TaskStatus, TaskPriority } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskCardProps {
  task: TaskWithLabels;
  onEdit: (task: TaskWithLabels) => void;
  onArchive: (task: TaskWithLabels) => void;
  onDelete: (task: TaskWithLabels) => void;
  onTogglePin: (task: TaskWithLabels) => void;
  onComplete?: (task: TaskWithLabels) => void;
  isMealPlanTask?: boolean;
  onMarkMealPlanSent?: (task: TaskWithLabels) => void;
}

const TYPE_ICONS: Record<string, typeof UtensilsCrossed> = {
  meal_plan: UtensilsCrossed,
  checkin_response: MessageSquare,
  consultation_prep: Calendar,
  diet_adjustment: Zap,
  custom: CheckCircle2,
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: 'border-l-2 border-l-muted-foreground/30',
  medium: 'border-l-2 border-l-primary/50',
  high: 'border-l-2 border-l-amber-500',
  urgent: 'border-l-2 border-l-destructive animate-pulse-subtle',
};

const STATUS_BADGE_STYLES: Record<TaskStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  overdue: 'bg-destructive/10 text-destructive',
};

export function TaskCard({ 
  task, 
  onEdit, 
  onArchive, 
  onDelete, 
  onTogglePin,
  onComplete,
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

  const TypeIcon = TYPE_ICONS[task.task_type] || CheckCircle2;
  const isMealPlan = isMealPlanTask || task.task_type === 'meal_plan';
  const isOverdue = task.status === 'overdue';
  const isAutoTask = task.source !== 'manual';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-3 cursor-pointer hover:border-primary/50 transition-colors group',
        PRIORITY_STYLES[task.priority],
        isDragging && 'opacity-50 shadow-lg',
        task.is_pinned && 'border-primary/30 bg-primary/5',
        isOverdue && 'bg-destructive/5 border-destructive/20',
        isMealPlan && !isOverdue && 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20'
      )}
    >
      <div className="flex items-start gap-2">
        {onComplete && task.status !== 'done' ? (
          <Checkbox
            checked={false}
            onCheckedChange={() => onComplete(task)}
            className={cn(
              "mt-0.5",
              isMealPlan && "border-orange-400 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
            )}
            title="Marcar como concluída"
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
            <div className="flex items-center gap-1.5 min-w-0">
              <TypeIcon className={cn(
                "h-3.5 w-3.5 flex-shrink-0",
                isMealPlan ? "text-orange-600 dark:text-orange-400" : 
                isOverdue ? "text-destructive" : "text-muted-foreground"
              )} />
              <h4 className={cn(
                "font-medium text-sm leading-tight truncate",
                isMealPlan && !isOverdue && "text-orange-800 dark:text-orange-200",
                isOverdue && "text-destructive"
              )}>
                {task.title}
              </h4>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {task.is_pinned && <Pin className="h-3 w-3 text-primary" />}
              {isAutoTask && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Zap className="h-3 w-3 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent><p>Tarefa automática</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Client name */}
          {task.client_name && (
            <div className="flex items-center gap-1 mt-1">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{task.client_name}</span>
            </div>
          )}

          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Status + Type badges */}
          <div className="flex flex-wrap items-center gap-1 mt-2">
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", STATUS_BADGE_STYLES[task.status])}>
              {isOverdue && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
            {task.task_type !== 'custom' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {TASK_TYPE_LABELS[task.task_type]}
              </Badge>
            )}
          </div>

          {task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
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
                <span className={cn(
                  "flex items-center gap-1",
                  isOverdue && "text-destructive font-medium"
                )}>
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.due_date + 'T12:00:00'), 'dd MMM', { locale: ptBR })}
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
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onTogglePin(task); }}
              title={task.is_pinned ? 'Desafixar' : 'Fixar'}
            >
              <Pin className={cn('h-3 w-3', task.is_pinned && 'fill-current')} />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              title="Editar"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onArchive(task); }}
              title="Arquivar"
            >
              <Archive className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(task); }}
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
