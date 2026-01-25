import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TaskWithLabels, TaskLabel, useCreateLabel, useDeleteLabel } from '@/hooks/useTasks';

const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

const LABEL_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskWithLabels | null;
  defaultDayOfWeek?: number;
  labels: TaskLabel[];
  onSave: (data: {
    title: string;
    description?: string;
    day_of_week: number;
    due_date?: string;
    due_time?: string;
    label_ids: string[];
  }) => void;
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultDayOfWeek = 1,
  labels,
  onSave,
}: TaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(defaultDayOfWeek);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dueTime, setDueTime] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  const createLabel = useCreateLabel();
  const deleteLabel = useDeleteLabel();

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDayOfWeek(task.day_of_week);
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setDueTime(task.due_time ? task.due_time.slice(0, 5) : '');
      setSelectedLabels(task.labels.map((l) => l.id));
    } else {
      setTitle('');
      setDescription('');
      setDayOfWeek(defaultDayOfWeek);
      setDueDate(undefined);
      setDueTime('');
      setSelectedLabels([]);
    }
    setShowNewLabel(false);
    setNewLabelName('');
  }, [task, defaultDayOfWeek, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      day_of_week: dayOfWeek,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      due_time: dueTime || undefined,
      label_ids: selectedLabels,
    });

    onOpenChange(false);
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    await createLabel.mutateAsync({
      name: newLabelName.trim(),
      color: newLabelColor,
    });
    setNewLabelName('');
    setShowNewLabel(false);
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{task ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Digite o título da tarefa"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Dia da Semana</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_NAMES.map((name, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant={dayOfWeek === index ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDayOfWeek(index)}
                  >
                    {name.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data de Execução (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate
                      ? format(dueDate, 'dd/MM/yyyy', { locale: ptBR })
                      : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    locale={ptBR}
                  />
                  {dueDate && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setDueDate(undefined)}
                      >
                        Limpar data
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-time">Horário (opcional)</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="due-time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-32"
                />
                {dueTime && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDueTime('')}
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Etiquetas</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewLabel(!showNewLabel)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nova
                </Button>
              </div>

              {showNewLabel && (
                <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                  <Input
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Nome da etiqueta"
                    className="flex-1 h-8"
                  />
                  <div className="flex gap-1">
                    {LABEL_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          'w-5 h-5 rounded-full border-2',
                          newLabelColor === color
                            ? 'border-foreground'
                            : 'border-transparent'
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewLabelColor(color)}
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={handleCreateLabel}
                    disabled={!newLabelName.trim() || createLabel.isPending}
                  >
                    Criar
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <div key={label.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-colors',
                        selectedLabels.includes(label.id)
                          ? 'border-transparent'
                          : 'border-border bg-background'
                      )}
                      style={
                        selectedLabels.includes(label.id)
                          ? { backgroundColor: label.color + '30', color: label.color }
                          : {}
                      }
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteLabel.mutate(label.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {labels.length === 0 && !showNewLabel && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma etiqueta criada
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {task ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
