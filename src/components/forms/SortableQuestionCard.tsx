import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Settings, Trash2, Edit, Copy } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface SortableQuestionCardProps {
  id: string;
  question: {
    id: string;
    question_text: string;
    question_type: string;
    is_required?: boolean;
    has_comment_field?: boolean;
    options?: any;
    scale_min?: number;
    scale_max?: number;
  };
  index: number;
  typeLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  showIndex?: boolean;
}

export function SortableQuestionCard({
  id,
  question,
  index,
  typeLabel,
  onEdit,
  onDelete,
  showIndex = false,
}: SortableQuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`hover:border-primary/50 transition-colors ${isDragging ? 'shadow-lg' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 mt-1 text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          {showIndex && (
            <span className="font-medium text-muted-foreground mt-1">{index + 1}.</span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{question.question_text}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">{typeLabel}</Badge>
                  {question.is_required && (
                    <Badge variant="secondary">Obrigatória</Badge>
                  )}
                  {question.has_comment_field && (
                    <Badge variant="secondary">Com comentário</Badge>
                  )}
                </div>
                {question.question_type === 'scale' && question.scale_min !== undefined && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Escala: {question.scale_min} a {question.scale_max}
                  </p>
                )}
                {question.options && Array.isArray(question.options) && question.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {question.options.map((option: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {option}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir pergunta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
