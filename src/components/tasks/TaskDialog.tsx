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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  TaskWithLabels,
  TaskLabel,
  TaskType,
  TaskPriority,
  RecurrenceType,
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  useCreateLabel,
  useDeleteLabel,
} from '@/hooks/useTasks';
import { useClients } from '@/hooks/useClients';

const WEEKDAY_NAMES = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
];

const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
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
    client_id?: string;
    task_type?: TaskType;
    priority?: TaskPriority;
    recurrence_type?: RecurrenceType;
    recurrence_days?: number[] | null;
    recurrence_day_of_month?: number | null;
    recurrence_interval?: number;
    recurrence_end_date?: string | null;
    xp_reward?: number;
    reminder_enabled?: boolean;
    reminder_minutes_before?: number;
    reminder_method?: 'app' | 'whatsapp' | 'both';
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
  const [clientId, setClientId] = useState<string>('');
  const [taskType, setTaskType] = useState<TaskType>('custom');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(1);
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>();
  const [xpReward, setXpReward] = useState<number>(10);

  const createLabel = useCreateLabel();
  const deleteLabel = useDeleteLabel();
  const { data: clients = [] } = useClients();
  const activeClients = clients.filter(c => c.is_active).sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setDayOfWeek(task.day_of_week);
      setDueDate(task.due_date ? new Date(task.due_date + 'T12:00:00') : undefined);
      setDueTime(task.due_time ? task.due_time.slice(0, 5) : '');
      setSelectedLabels(task.labels.map((l) => l.id));
      setClientId(task.client_id || '');
      setTaskType(task.task_type || 'custom');
      setPriority(task.priority || 'medium');
      setRecurrenceType(task.recurrence_type || 'none');
      setRecurrenceDays(task.recurrence_days || []);
      setRecurrenceDayOfMonth(task.recurrence_day_of_month || 1);
      setRecurrenceInterval(task.recurrence_interval || 1);
      setRecurrenceEndDate(task.recurrence_end_date ? new Date(task.recurrence_end_date + 'T12:00:00') : undefined);
      setXpReward(task.xp_reward ?? 10);
    } else {
      setTitle('');
      setDescription('');
      setDayOfWeek(defaultDayOfWeek);
      setDueDate(undefined);
      setDueTime('');
      setSelectedLabels([]);
      setClientId('');
      setTaskType('custom');
      setPriority('medium');
      setRecurrenceType('none');
      setRecurrenceDays([]);
      setRecurrenceDayOfMonth(1);
      setRecurrenceInterval(1);
      setRecurrenceEndDate(undefined);
      setXpReward(10);
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
      client_id: clientId && clientId !== 'none' ? clientId : undefined,
      task_type: taskType,
      priority,
      recurrence_type: recurrenceType,
      recurrence_days: recurrenceType === 'weekly' ? recurrenceDays : null,
      recurrence_day_of_month: recurrenceType === 'monthly' ? recurrenceDayOfMonth : null,
      recurrence_interval: recurrenceInterval,
      recurrence_end_date: recurrenceEndDate ? format(recurrenceEndDate, 'yyyy-MM-dd') : null,
      xp_reward: xpReward,
    });

    onOpenChange(false);
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    await createLabel.mutateAsync({ name: newLabelName.trim(), color: newLabelColor });
    setNewLabelName('');
    setShowNewLabel(false);
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{task ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Digite o título da tarefa" autoFocus />
            </div>

            {/* Client + Type + Priority row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Paciente (opcional)</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {activeClients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional" rows={2} />
            </div>

            {/* Day of week */}
            <div className="space-y-2">
              <Label>Dia da Semana</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_NAMES.map((name, index) => (
                  <Button key={index} type="button" variant={dayOfWeek === index ? 'default' : 'outline'} size="sm" onClick={() => setDayOfWeek(index)}>
                    {name.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-2">
              <Label>Prazo (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dueDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus locale={ptBR} />
                  {dueDate && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setDueDate(undefined)}>Limpar data</Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Due time */}
            <div className="space-y-2">
              <Label htmlFor="due-time">Horário (opcional)</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input id="due-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="w-32" />
                {dueTime && <Button type="button" variant="ghost" size="sm" onClick={() => setDueTime('')}>Limpar</Button>}
              </div>
            </div>

            {/* Recurrence */}
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <Label>Recorrência</Label>
              <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as RecurrenceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (única)</SelectItem>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal (dias específicos)</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>

              {recurrenceType === 'weekly' && (
                <div className="space-y-1">
                  <Label className="text-xs">Repetir nos dias</Label>
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAY_NAMES.map((n, i) => (
                      <Button
                        key={i}
                        type="button"
                        size="sm"
                        variant={recurrenceDays.includes(i) ? 'default' : 'outline'}
                        onClick={() =>
                          setRecurrenceDays((p) =>
                            p.includes(i) ? p.filter((x) => x !== i) : [...p, i]
                          )
                        }
                      >
                        {n.slice(0, 3)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {recurrenceType === 'monthly' && (
                <div className="space-y-1">
                  <Label className="text-xs">Dia do mês (1–28)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={recurrenceDayOfMonth}
                    onChange={(e) => setRecurrenceDayOfMonth(Number(e.target.value))}
                    className="w-24"
                  />
                </div>
              )}

              {recurrenceType !== 'none' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">A cada</Label>
                    <Input
                      type="number"
                      min={1}
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Termina em (opcional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {recurrenceEndDate ? format(recurrenceEndDate, 'dd/MM/yy', { locale: ptBR }) : '—'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={recurrenceEndDate} onSelect={setRecurrenceEndDate} initialFocus locale={ptBR} />
                        {recurrenceEndDate && (
                          <div className="p-2 border-t">
                            <Button variant="ghost" size="sm" className="w-full" onClick={() => setRecurrenceEndDate(undefined)}>Limpar</Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>

            {/* XP */}
            <div className="space-y-2">
              <Label htmlFor="xp">XP ao concluir</Label>
              <Input
                id="xp"
                type="number"
                min={0}
                max={500}
                value={xpReward}
                onChange={(e) => setXpReward(Number(e.target.value))}
                className="w-32"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Etiquetas</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewLabel(!showNewLabel)}>
                  <Plus className="h-4 w-4 mr-1" /> Nova
                </Button>
              </div>

              {showNewLabel && (
                <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                  <Input value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} placeholder="Nome da etiqueta" className="flex-1 h-8" />
                  <div className="flex gap-1">
                    {LABEL_COLORS.map((color) => (
                      <button key={color} type="button" className={cn('w-5 h-5 rounded-full border-2', newLabelColor === color ? 'border-foreground' : 'border-transparent')} style={{ backgroundColor: color }} onClick={() => setNewLabelColor(color)} />
                    ))}
                  </div>
                  <Button type="button" size="sm" className="h-8" onClick={handleCreateLabel} disabled={!newLabelName.trim() || createLabel.isPending}>Criar</Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <div key={label.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => toggleLabel(label.id)} className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-colors', selectedLabels.includes(label.id) ? 'border-transparent' : 'border-border bg-background')} style={selectedLabels.includes(label.id) ? { backgroundColor: label.color + '30', color: label.color } : {}}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} />
                      {label.name}
                    </button>
                    <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => deleteLabel.mutate(label.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {labels.length === 0 && !showNewLabel && (
                  <p className="text-xs text-muted-foreground">Nenhuma etiqueta criada</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!title.trim()}>{task ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
