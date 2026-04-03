import { useState } from 'react';
import { useAthleteCheckinSchedules, useSaveCheckinSchedule, useDeleteCheckinSchedule } from '@/hooks/useBroadcasts';
import { useCheckinForms } from '@/hooks/useCheckinForms';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Clock, CalendarDays, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';

const FREQ_LABELS: Record<string, string> = {
  daily: 'Diário (envio semanal)',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: 'A cada 3 semanas',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  custom: 'Personalizado',
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Props {
  clientId: string;
}

export function AthleteCheckinSchedules({ clientId }: Props) {
  const { user } = useAuth();
  const { data: schedules = [], isLoading } = useAthleteCheckinSchedules(clientId);
  const { data: forms = [] } = useCheckinForms();
  const saveSchedule = useSaveCheckinSchedule();
  const deleteSchedule = useDeleteCheckinSchedule();
  const [showAdd, setShowAdd] = useState(false);

  const [editId, setEditId] = useState<string | undefined>();
  const [formId, setFormId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [freqType, setFreqType] = useState('weekly');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1]); // Monday
  const [sendTime, setSendTime] = useState('09:00');
  const [dueInHours, setDueInHours] = useState('48');
  const [isActive, setIsActive] = useState(true);

  const availableForms = forms.filter(f => f.is_active);
  const usedFormIds = schedules.map(s => s.checkin_form_id);

  const openAdd = () => {
    setEditId(undefined);
    setFormId('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setFreqType('weekly');
    setWeeklyDays([1]);
    setSendTime('09:00');
    setDueInHours('48');
    setIsActive(true);
    setShowAdd(true);
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    setFormId(s.checkin_form_id);
    setStartDate(s.start_date);
    setFreqType(s.frequency_type);
    setWeeklyDays(s.weekly_days || [1]);
    setSendTime(s.send_time?.substring(0, 5) || '09:00');
    setDueInHours(String(s.due_in_hours || 48));
    setIsActive(s.is_active);
    setShowAdd(true);
  };

  const handleSave = () => {
    if (!formId) return;
    saveSchedule.mutate({
      id: editId,
      client_id: clientId,
      checkin_form_id: formId,
      start_date: startDate,
      frequency_type: freqType,
      weekly_days: weeklyDays,
      send_time: sendTime,
      due_in_hours: parseInt(dueInHours) || 48,
      is_active: isActive,
    }, {
      onSuccess: () => setShowAdd(false),
    });
  };

  const toggleDay = (day: number) => {
    setWeeklyDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Automação de Check-ins
          </CardTitle>
          <Button size="sm" onClick={openAdd} className="gap-1">
            <Plus className="h-3 w-3" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum check-in automatizado configurado.
          </p>
        ) : (
          schedules.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{s.checkin_forms?.title || 'Formulário'}</span>
                  <Badge variant={s.is_active ? 'default' : 'secondary'} className={s.is_active ? 'bg-green-500' : ''}>
                    {s.is_active ? 'Ativo' : 'Pausado'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{FREQ_LABELS[s.frequency_type]}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {s.send_time?.substring(0, 5)}
                  </span>
                  {s.weekly_days && (
                    <span>{s.weekly_days.map(d => DAY_LABELS[d]).join(', ')}</span>
                  )}
                  <span>Prazo: {s.due_in_hours}h</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => deleteSchedule.mutate(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar' : 'Novo'} Agendamento de Check-in</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Formulário de Check-in</Label>
              <Select value={formId} onValueChange={setFormId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {availableForms.filter(f => !usedFormIds.includes(f.id) || f.id === formId).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Frequência</Label>
                <Select value={freqType} onValueChange={setFreqType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="three_weeks">A cada 3 semanas</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="bimonthly">Bimestral</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(freqType === 'weekly' || freqType === 'biweekly') && (
              <div>
                <Label>Dias da semana</Label>
                <div className="flex gap-2 mt-1">
                  {DAY_LABELS.map((label, i) => (
                    <label key={i} className="flex flex-col items-center gap-1 cursor-pointer">
                      <Checkbox
                        checked={weeklyDays.includes(i)}
                        onCheckedChange={() => toggleDay(i)}
                      />
                      <span className="text-xs">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Horário de envio</Label>
                <Input type="time" value={sendTime} onChange={e => setSendTime(e.target.value)} />
              </div>
              <div>
                <Label>Prazo de resposta (horas)</Label>
                <Input type="number" value={dueInHours} onChange={e => setDueInHours(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativo</Label>
            </div>

            <Button onClick={handleSave} disabled={saveSchedule.isPending || !formId} className="w-full">
              {saveSchedule.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
