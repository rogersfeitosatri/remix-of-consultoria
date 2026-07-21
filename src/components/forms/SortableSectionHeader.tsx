import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Edit2, Check, X, Copy, Trash2 } from 'lucide-react';
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

interface SortableSectionHeaderProps {
  id: string;
  section: string;
  order?: number;
  questionCount?: number;
  onRename: (oldName: string, newName: string) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  isDragOverlay?: boolean;
}

export function SortableSectionHeader({
  id,
  section,
  order,
  questionCount,
  onRename,
  onDuplicate,
  onDelete,
  isDragOverlay = false,
}: SortableSectionHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(section);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    if (editValue.trim() && editValue.trim() !== section) {
      onRename(section, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(section);
    setIsEditing(false);
  };

  if (isDragOverlay) {
    return (
      <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-md">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-primary">{section}</h3>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 mb-3 group/section border-l-2 border-primary/30 pl-2"
    >
      <div
        {...attributes}
        {...listeners}
        className="text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        title="Arrastar seção"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 max-w-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <h3 className="text-lg font-semibold text-primary">
            {typeof order === 'number' && <span className="text-muted-foreground mr-2">{order}.</span>}
            {section}
          </h3>
          {typeof questionCount === 'number' && (
            <span className="text-xs text-muted-foreground">
              ({questionCount} {questionCount === 1 ? 'pergunta' : 'perguntas'})
            </span>
          )}
          <div className="flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setIsEditing(true)}
              title="Renomear"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            {onDuplicate && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onDuplicate}
                title="Duplicar seção"
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    title="Excluir seção"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir seção "{section}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {questionCount && questionCount > 0
                        ? `Esta ação excluirá a seção e as ${questionCount} pergunta(s) contidas nela. Não pode ser desfeita.`
                        : 'Esta ação removerá a seção vazia.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// Simple editable section header without drag functionality
export function EditableSectionHeader({
  section,
  onRename,
}: {
  section: string;
  onRename: (oldName: string, newName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(section);

  const handleSave = () => {
    if (editValue.trim() && editValue.trim() !== section) {
      onRename(section, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(section);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-2 mb-3 group">
      {isEditing ? (
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 max-w-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <h3 className="text-lg font-semibold text-primary">{section}</h3>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
