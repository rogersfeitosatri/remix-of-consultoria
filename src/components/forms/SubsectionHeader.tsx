import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Check, X, Copy, Trash2 } from 'lucide-react';
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

interface SubsectionHeaderProps {
  label: string; // ex: "4.1"
  name: string;
  questionCount?: number;
  onRename: (newName: string) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function SubsectionHeader({
  label,
  name,
  questionCount,
  onRename,
  onDuplicate,
  onDelete,
}: SubsectionHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);

  const handleSave = () => {
    const val = editValue.trim();
    if (val && val !== name) onRename(val);
    setIsEditing(false);
  };
  const handleCancel = () => {
    setEditValue(name);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-2 mb-2 group/sub">
      {isEditing ? (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 max-w-xs text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <h4 className="text-sm font-semibold text-foreground/80">
            <span className="text-muted-foreground mr-2">{label}</span>
            {name}
          </h4>
          {typeof questionCount === 'number' && (
            <span className="text-xs text-muted-foreground">
              ({questionCount} {questionCount === 1 ? 'pergunta' : 'perguntas'})
            </span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setIsEditing(true)}
              title="Renomear subseção"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            {onDuplicate && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onDuplicate}
                title="Duplicar subseção"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    title="Excluir subseção"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir subseção "{name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {questionCount && questionCount > 0
                        ? `Esta ação excluirá a subseção e as ${questionCount} pergunta(s) contidas nela. Não pode ser desfeita.`
                        : 'Esta ação removerá a subseção vazia.'}
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
