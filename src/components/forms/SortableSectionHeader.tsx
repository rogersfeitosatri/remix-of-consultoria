import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Edit2, Check, X } from 'lucide-react';

interface SortableSectionHeaderProps {
  id: string;
  section: string;
  onRename: (oldName: string, newName: string) => void;
  isDragOverlay?: boolean;
}

export function SortableSectionHeader({
  id,
  section,
  onRename,
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
      className="flex items-center gap-2 mb-3"
    >
      <div
        {...attributes}
        {...listeners}
        className="text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
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
          <h3 className="text-lg font-semibold text-primary">{section}</h3>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
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
