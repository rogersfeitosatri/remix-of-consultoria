import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface QuestionDropZoneProps {
  id: string;
  label?: string;
  className?: string;
}

export function QuestionDropZone({ id, label, className }: QuestionDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md border border-dashed p-2 text-center text-xs transition-colors',
        isOver
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-muted-foreground/20 text-muted-foreground/60',
        className
      )}
    >
      {label ?? 'Solte uma pergunta aqui'}
    </div>
  );
}
