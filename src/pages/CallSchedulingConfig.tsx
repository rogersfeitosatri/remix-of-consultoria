import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCallSchedulingLink, useUpdateCallSchedulingLink, useCallBookings, useUpdateCallBooking, type WeeklySlot } from '@/hooks/useCallScheduling';
import { ArrowLeft, Save, Loader2, Copy, Eye, Plus, Trash2, Calendar, Clock, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  rescheduled: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};
const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  rescheduled: 'Reagendado',
};

export default function CallSchedulingConfig() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { data: link, isLoading } = useCallSchedulingLink(linkId);
  const updateLink = useUpdateCallSchedulingLink();
  const { data: bookings = [] } = useCallBookings(linkId);
  const updateBooking = useUpdateCallBooking();

  // Form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [slotDuration, setSlotDuration] = useState(30);
  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(10);
  const [minAdvance, setMinAdvance] = useState(6);
  const [maxAdvance, setMaxAdvance] = useState(60);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [confirmationTemplate, setConfirmationTemplate] = useState('');
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklySlot[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');

  useEffect(() => {
    if (link) {
      setTitle(link.title);
      setSlug(link.slug);
      setDescription(link.description || '');
      setStatus(link.status);
      setSlotDuration(link.slot_duration_minutes);
      setBufferBefore(link.buffer_before_minutes);
      setBufferAfter(link.buffer_after_minutes);
      setMinAdvance(link.min_advance_hours);
      setMaxAdvance(link.max_advance_days);
      setDailyLimit(link.daily_limit);
      setAllowMultiple(link.allow_multiple_per_lead);
      setRequireConfirmation(link.require_manual_confirmation);
      setMeetingLink(link.meeting_link || '');
      setConfirmationTemplate(link.confirmation_template || '');
      setWeeklyAvailability(Array.isArray(link.weekly_availability) ? link.weekly_availability : []);
      setBlockedDates(Array.isArray(link.blocked_dates) ? link.blocked_dates : []);
    }
  }, [link]);

  const handleSave = () => {
    if (!linkId) return;
    updateLink.mutate({
      id: linkId,
      title,
      slug,
      description: description || null,
      status,
      slot_duration_minutes: slotDuration,
      buffer_before_minutes: bufferBefore,
      buffer_after_minutes: bufferAfter,
      min_advance_hours: minAdvance,
      max_advance_days: maxAdvance,
      daily_limit: dailyLimit,
      allow_multiple_per_lead: allowMultiple,
      require_manual_confirmation: requireConfirmation,
      meeting_link: meetingLink || null,
      confirmation_template: confirmationTemplate || null,
      weekly_availability: weeklyAvailability,
      blocked_dates: blockedDates,
    } as any);
  };

  const addWeeklySlot = () => {
    setWeeklyAvailability(prev => [...prev, { day: 1, start: '09:00', end: '12:00' }]);
  };

  const updateWeeklySlot = (idx: number, updates: Partial<WeeklySlot>) => {
    setWeeklyAvailability(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const removeWeeklySlot = (idx: number) => {
    setWeeklyAvailability(prev => prev.filter((_, i) => i !== idx));
  };

  const addBlockedDate = () => {
    if (newBlockedDate && !blockedDates.includes(newBlockedDate)) {
      setBlockedDates(prev => [...prev, newBlockedDate].sort());
      setNewBlockedDate('');
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/agendar-call/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!', { description: url });
  };

  if (isLoading) {
    return <Layout><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></Layout>;
  }

  if (!link) {
    return <Layout><p className="text-center text-muted-foreground py-12">Link não encontrado.</p></Layout>;
  }

  const activeBookings = bookings.filter(b => b.status !== 'cancelled');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/scheduling-links')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{link.title}</h1>
            <p className="text-sm text-muted-foreground">/agendar-call/{link.slug}</p>
          </div>
          <Button variant="outline" onClick={copyLink} className="gap-2">
            <Copy className="h-4 w-4" /> Copiar Link
          </Button>
          <Button variant="outline" onClick={() => window.open(`/agendar-call/${link.slug}`, '_blank')} className="gap-2">
            <Eye className="h-4 w-4" /> Preview
          </Button>
        </div>

        <Tabs defaultValue="config">
          <TabsList>
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
            <TabsTrigger value="bookings">Reservas ({activeBookings.length})</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
          </TabsList>

          {/* CONFIG TAB */}
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Informações Básicas</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Título</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>URL (slug)</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">/agendar-call/</span>
                    <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
                  </div>
                </div>
                <div>
                  <Label>Descrição (visível na página pública)</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                </div>
                <div>
                  <Label>Link de videoconferência (opcional)</Label>
                  <Input value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Regras do Slot</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Duração (min)</Label>
                    <Input type="number" value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Buffer antes (min)</Label>
                    <Input type="number" value={bufferBefore} onChange={e => setBufferBefore(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Buffer depois (min)</Label>
                    <Input type="number" value={bufferAfter} onChange={e => setBufferAfter(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Antecedência mín. (horas)</Label>
                    <Input type="number" value={minAdvance} onChange={e => setMinAdvance(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Antecedência máx. (dias)</Label>
                    <Input type="number" value={maxAdvance} onChange={e => setMaxAdvance(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Limite diário</Label>
                    <Input type="number" value={dailyLimit ?? ''} onChange={e => setDailyLimit(e.target.value ? Number(e.target.value) : null)} placeholder="Sem limite" />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} />
                    <Label>Permitir múltiplas reservas por lead</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={requireConfirmation} onCheckedChange={setRequireConfirmation} />
                    <Label>Exigir confirmação manual</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={updateLink.isPending} className="gap-2">
              <Save className="h-4 w-4" /> {updateLink.isPending ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </TabsContent>

          {/* AVAILABILITY TAB */}
          <TabsContent value="availability" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Horários Recorrentes</CardTitle>
                  <Button variant="outline" size="sm" onClick={addWeeklySlot} className="gap-1">
                    <Plus className="h-4 w-4" /> Adicionar faixa
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {weeklyAvailability.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum horário configurado. Adicione faixas para disponibilizar slots.</p>
                )}
                {weeklyAvailability.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <Select value={String(slot.day)} onValueChange={v => updateWeeklySlot(idx, { day: Number(v) })}>
                      <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((name, i) => <SelectItem key={i} value={String(i)}>{name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="time" value={slot.start} onChange={e => updateWeeklySlot(idx, { start: e.target.value })} className="w-[120px]" />
                    <span className="text-muted-foreground">até</span>
                    <Input type="time" value={slot.end} onChange={e => updateWeeklySlot(idx, { end: e.target.value })} className="w-[120px]" />
                    <Button variant="ghost" size="icon" onClick={() => removeWeeklySlot(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Datas Bloqueadas</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input type="date" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} />
                  <Button variant="outline" onClick={addBlockedDate}>Bloquear</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {blockedDates.map(d => (
                    <Badge key={d} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setBlockedDates(prev => prev.filter(x => x !== d))}>
                      {d} ✕
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={updateLink.isPending} className="gap-2">
              <Save className="h-4 w-4" /> Salvar Disponibilidade
            </Button>
          </TabsContent>

          {/* BOOKINGS TAB */}
          <TabsContent value="bookings" className="space-y-4">
            {activeBookings.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma reserva ainda.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {bookings.map(b => (
                  <Card key={b.id}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center text-center min-w-[60px]">
                          <Calendar className="h-4 w-4 text-muted-foreground mb-1" />
                          <span className="text-sm font-medium">{b.booking_date}</span>
                          <span className="text-xs text-muted-foreground">{b.booking_time?.slice(0, 5)}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{b.lead_name || 'Sem nome'}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{b.lead_email} · {b.lead_phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={STATUS_COLORS[b.status] || ''}>{STATUS_LABELS[b.status] || b.status}</Badge>
                        <Select value={b.status} onValueChange={v => updateBooking.mutate({ id: b.id, status: v } as any)}>
                          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* NOTIFICATIONS TAB */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Mensagem de Confirmação</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Placeholders: {'{{nome}}'}, {'{{data_horario}}'}, {'{{link_call}}'}, {'{{responsavel}}'}</p>
                <Textarea value={confirmationTemplate} onChange={e => setConfirmationTemplate(e.target.value)} rows={5} />
              </CardContent>
            </Card>
            <Button onClick={handleSave} disabled={updateLink.isPending} className="gap-2">
              <Save className="h-4 w-4" /> Salvar
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
