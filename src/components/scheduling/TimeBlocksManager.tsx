import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTimeBlocks, useAddTimeBlock, useDeleteTimeBlock, TimeBlock } from '@/hooks/useTimeBlocks';
import { Plus, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const WEEK_DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return [`${hour}:00`, `${hour}:30`];
}).flat();

interface TimeBlocksManagerProps {
  settingsId: string;
  workingDays: number[];
}

export function TimeBlocksManager({ settingsId, workingDays }: TimeBlocksManagerProps) {
  const { data: timeBlocks = [], isLoading } = useTimeBlocks(settingsId);
  const addTimeBlock = useAddTimeBlock();
  const deleteTimeBlock = useDeleteTimeBlock();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(workingDays[0] ?? 1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');

  const handleAddBlock = async () => {
    if (startTime >= endTime) {
      toast.error('O horário de início deve ser antes do término');
      return;
    }

    try {
      await addTimeBlock.mutateAsync({
        settings_id: settingsId,
        day_of_week: selectedDay,
        start_time: startTime + ':00',
        end_time: endTime + ':00',
      });
      toast.success('Bloco de horário adicionado!');
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao adicionar bloco');
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      await deleteTimeBlock.mutateAsync({ id, settingsId });
      toast.success('Bloco removido');
    } catch (error) {
      toast.error('Erro ao remover bloco');
    }
  };

  // Group blocks by day
  const blocksByDay = timeBlocks.reduce((acc, block) => {
    if (!acc[block.day_of_week]) {
      acc[block.day_of_week] = [];
    }
    acc[block.day_of_week].push(block);
    return acc;
  }, {} as Record<number, TimeBlock[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Blocos de Horário
            </CardTitle>
            <CardDescription>
              Configure múltiplos blocos de atendimento para cada dia (ex: manhã e tarde)
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Bloco
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Bloco de Horário</DialogTitle>
                <DialogDescription>
                  Defina um período de atendimento para um dia da semana
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Dia da Semana</Label>
                  <Select 
                    value={selectedDay.toString()} 
                    onValueChange={(v) => setSelectedDay(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEK_DAYS.filter(d => workingDays.includes(d.value)).map(day => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Select value={startTime} onValueChange={setStartTime}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Término</Label>
                    <Select value={endTime} onValueChange={setEndTime}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddBlock} disabled={addTimeBlock.isPending}>
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {timeBlocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum bloco de horário configurado</p>
            <p className="text-xs mt-1">
              Sem blocos configurados, o sistema usará o horário geral definido acima
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {WEEK_DAYS.filter(d => workingDays.includes(d.value)).map(day => {
              const dayBlocks = blocksByDay[day.value] || [];
              return (
                <div key={day.value} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{day.label}</Badge>
                    {dayBlocks.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        (usa horário geral)
                      </span>
                    )}
                  </div>
                  {dayBlocks.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-4">
                      {dayBlocks.map(block => (
                        <div
                          key={block.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/50 text-sm"
                        >
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {block.start_time.substring(0, 5)} - {block.end_time.substring(0, 5)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteBlock(block.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
