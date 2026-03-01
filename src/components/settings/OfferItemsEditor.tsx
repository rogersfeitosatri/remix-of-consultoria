import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { OfferItem } from '@/hooks/useLandingPageSettings';

const AVAILABLE_ICONS = [
  'Calendar', 'Utensils', 'ClipboardList', 'RefreshCw', 'MessageCircle',
  'Dumbbell', 'FileText', 'Activity', 'Target', 'Award', 'Zap', 'Users',
  'Heart', 'Star', 'Check', 'Gift',
];

interface OfferItemsEditorProps {
  label: string;
  items: OfferItem[];
  onChange: (items: OfferItem[]) => void;
}

export function OfferItemsEditor({ label, items, onChange }: OfferItemsEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const updateItem = (index: number, field: keyof OfferItem, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addItem = () => {
    onChange([...items, {
      id: crypto.randomUUID(),
      icon: 'Check',
      title: 'Novo item',
      description: 'Descrição do item',
    }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...items];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    onChange(updated);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <Button variant="outline" size="sm" onClick={addItem} className="text-xs h-7">
          <Plus className="h-3 w-3 mr-1" /> Adicionar item
        </Button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`border rounded-lg p-3 space-y-2 bg-card transition-opacity ${
              dragIndex === index ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
              <span className="text-xs text-muted-foreground font-medium w-4">{index + 1}</span>
              <Select value={item.icon} onValueChange={(v) => updateItem(index, 'icon', v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon} className="text-xs">{icon}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={item.title}
                onChange={(e) => updateItem(index, 'title', e.target.value)}
                className="text-sm h-8 flex-1"
                placeholder="Título"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => removeItem(index)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
            <Textarea
              value={item.description}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              className="text-xs resize-none ml-6"
              rows={2}
              placeholder="Descrição"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
