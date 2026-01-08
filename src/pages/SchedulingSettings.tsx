import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { 
  useSchedulingSettings, 
  useSchedulingBlocks, 
  useSaveSchedulingSettings, 
  useAddSchedulingBlock,
  useDeleteSchedulingBlock,
  useAppointments,
} from '@/hooks/useScheduling';
import { TimeBlocksManager } from '@/components/scheduling/TimeBlocksManager';
import { Clock, Calendar as CalendarIcon, Link, Plus, Trash2, Copy, Check, Loader2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function SchedulingSettings() {
  const { data: settings, isLoading: settingsLoading } = useSchedulingSettings();
  const { data: blocks = [], isLoading: blocksLoading } = useSchedulingBlocks();
  const { data: appointments = [] } = useAppointments();
  const saveSettings = useSaveSchedulingSettings();
  const addBlock = useAddSchedulingBlock();
  const deleteBlock = useDeleteSchedulingBlock();

  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [slotDuration, setSlotDuration] = useState(60);
  const [slug, setSlug] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockDate, setBlockDate] = useState<Date>();
  const [blockType, setBlockType] = useState<'full_day' | 'time_range'>('full_day');
  const [blockStartTime, setBlockStartTime] = useState('08:00');
  const [blockEndTime, setBlockEndTime] = useState('18:00');
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    if (settings) {
      setWorkingDays(settings.working_days);
      setStartTime(settings.working_hours_start?.substring(0, 5) || '08:00');
      setEndTime(settings.working_hours_end?.substring(0, 5) || '18:00');
      setSlotDuration(settings.slot_duration_minutes);
      setSlug(settings.booking_link_slug || '');
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await saveSettings.mutateAsync({
        working_days: workingDays,
        working_hours_start: startTime + ':00',
        working_hours_end: endTime + ':00',
        slot_duration_minutes: slotDuration,
        booking_link_slug: slug || null,
      });
      toast.success('Configurações salvas!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const handleAddBlock = async () => {
    if (!blockDate) {
      toast.error('Selecione uma data');
      return;
    }

    try {
      await addBlock.mutateAsync({
        block_type: blockType,
        block_date: format(blockDate, 'yyyy-MM-dd'),
        start_time: blockType === 'time_range' ? blockStartTime + ':00' : null,
        end_time: blockType === 'time_range' ? blockEndTime + ':00' : null,
        reason: blockReason || null,
      });
      toast.success('Bloqueio adicionado');
      setIsBlockDialogOpen(false);
      setBlockDate(undefined);
      setBlockReason('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao adicionar bloqueio');
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      await deleteBlock.mutateAsync(id);
      toast.success('Bloqueio removido');
    } catch (error) {
      toast.error('Erro ao remover bloqueio');
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/agendar/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleDay = (day: number) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter(d => d !== day));
    } else {
      setWorkingDays([...workingDays, day].sort());
    }
  };

  const isLoading = settingsLoading || blocksLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Agendamento de Consultas</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Configure horários de atendimento e bloqueie datas
          </p>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="settings" className="gap-2">
              <Clock className="h-4 w-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="blocks" className="gap-2">
              <Ban className="h-4 w-4" />
              Bloqueios
            </TabsTrigger>
            <TabsTrigger value="appointments" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              Agendamentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            {/* Working Days */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dias de Atendimento</CardTitle>
                <CardDescription>Selecione os dias da semana em que você atende</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {WEEK_DAYS.map(day => (
                    <div
                      key={day.value}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        workingDays.includes(day.value)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-muted/50 border-border hover:bg-muted'
                      }`}
                      onClick={() => toggleDay(day.value)}
                    >
                      <Checkbox checked={workingDays.includes(day.value)} />
                      <span className="text-sm font-medium">{day.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Horário de Atendimento Padrão</CardTitle>
                <CardDescription>Defina o horário geral. Use os "Blocos de Horário" abaixo para turnos específicos por dia.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
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
                  <div className="space-y-2">
                    <Label>Duração do Slot</Label>
                    <Select value={slotDuration.toString()} onValueChange={(v) => setSlotDuration(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="45">45 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="90">1h30</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Link */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  Link de Agendamento
                </CardTitle>
                <CardDescription>
                  Crie um link personalizado para seus atletas agendarem consultas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Identificador do Link</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-0 rounded-md border border-input bg-background">
                      <span className="px-3 py-2 text-sm text-muted-foreground bg-muted rounded-l-md border-r">
                        {window.location.origin}/agendar/
                      </span>
                      <Input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="seu-nome"
                        className="border-0 rounded-l-none focus-visible:ring-0"
                      />
                    </div>
                    {slug && (
                      <Button variant="outline" onClick={handleCopyLink}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use apenas letras minúsculas, números e hífens
                  </p>
                </div>
                
                {settings?.booking_link_slug && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <Check className="h-4 w-4 text-primary" />
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Link salvo:</span>{' '}
                      <a 
                        href={`${window.location.origin}/agendar/${settings.booking_link_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {window.location.origin}/agendar/{settings.booking_link_slug}
                      </a>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saveSettings.isPending} className="w-full sm:w-auto mb-6">
              {saveSettings.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Configurações'
              )}
            </Button>

            {/* Time Blocks Manager - Multiple time blocks per day */}
            {settings?.id && (
              <TimeBlocksManager settingsId={settings.id} workingDays={workingDays} />
            )}
          </TabsContent>

          <TabsContent value="blocks" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Bloqueios de Data/Horário</CardTitle>
                    <CardDescription>
                      Bloqueie datas ou horários específicos em que você não poderá atender
                    </CardDescription>
                  </div>
                  <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Adicionar Bloqueio
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Bloqueio</DialogTitle>
                        <DialogDescription>
                          Bloqueie uma data ou período específico
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Data</Label>
                          <Calendar
                            mode="single"
                            selected={blockDate}
                            onSelect={setBlockDate}
                            locale={ptBR}
                            className="rounded-md border mx-auto"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo de Bloqueio</Label>
                          <Select value={blockType} onValueChange={(v) => setBlockType(v as 'full_day' | 'time_range')}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_day">Dia inteiro</SelectItem>
                              <SelectItem value="time_range">Horário específico</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {blockType === 'time_range' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>De</Label>
                              <Select value={blockStartTime} onValueChange={setBlockStartTime}>
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
                              <Label>Até</Label>
                              <Select value={blockEndTime} onValueChange={setBlockEndTime}>
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
                        )}
                        <div className="space-y-2">
                          <Label>Motivo (opcional)</Label>
                          <Input
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            placeholder="Ex: Feriado, Viagem, etc."
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddBlock} disabled={addBlock.isPending}>
                          Adicionar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {blocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum bloqueio cadastrado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {blocks.map(block => (
                      <div
                        key={block.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Ban className="h-4 w-4 text-destructive" />
                          <div>
                            <p className="font-medium text-sm">
                              {format(parseISO(block.block_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {block.block_type === 'full_day' 
                                ? 'Dia inteiro' 
                                : `${block.start_time?.substring(0, 5)} - ${block.end_time?.substring(0, 5)}`}
                              {block.reason && ` • ${block.reason}`}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteBlock(block.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Consultas Agendadas</CardTitle>
                <CardDescription>
                  Visualize todos os agendamentos confirmados pelos atletas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {appointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum agendamento confirmado ainda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {appointments.map(appointment => (
                      <div
                        key={appointment.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{appointment.client_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(appointment.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
                              {' às '}
                              {appointment.appointment_time?.substring(0, 5)}
                            </p>
                          </div>
                        </div>
                        <Badge variant={
                          appointment.status === 'confirmed' ? 'default' :
                          appointment.status === 'completed' ? 'secondary' :
                          'destructive'
                        }>
                          {appointment.status === 'confirmed' ? 'Confirmado' :
                           appointment.status === 'completed' ? 'Concluído' :
                           'Cancelado'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
