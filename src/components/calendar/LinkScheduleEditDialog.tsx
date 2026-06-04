import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Send, User, Edit2, Trash2, Check, RefreshCw, ArrowRight, CalendarDays, AlertTriangle, CheckCircle2, Copy, Link2,
} from 'lucide-react';
import { format, parseISO, getDay, addWeeks, nextMonday, isBefore, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ConsultationSchedule,
  Client,
  useUpdateConsultationSchedule,
  useDeleteConsultationSchedule,
} from '@/hooks/useClients';
import { cn } from '@/lib/utils';

interface LinkScheduleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  schedules: (ConsultationSchedule & { client_name: string })[];
  allSchedules: (ConsultationSchedule & { client_name: string })[];
  clients: Client[];
}

type EditMode = 'adapt_pipeline' | 'change_only';

interface EditingState {
  scheduleId: string;
  mode: EditMode | null;
  newDate: Date | undefined;
}

export function LinkScheduleEditDialog({
  open,
  onOpenChange,
  selectedDate,
  schedules,
  allSchedules,
  clients,
}: LinkScheduleEditDialogProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState('');
  const updateSchedule = useUpdateConsultationSchedule();
  const deleteSchedule = useDeleteConsultationSchedule();
  const queryClient = useQueryClient();

  // Fetch booking links for the athletes shown in this dialog
  const dayClientIds = selectedDate
    ? Array.from(
        new Set(
          schedules
            .filter(
              (s) =>
                s.status === 'pending' &&
                format(parseISO(s.send_link_date), 'yyyy-MM-dd') ===
                  format(selectedDate, 'yyyy-MM-dd')
            )
            .map((s) => s.client_id)
        )
      )
    : [];

  const { data: bookingLinks } = useQuery({
    queryKey: ['booking-links-by-clients', dayClientIds.sort().join(',')],
    queryFn: async () => {
      if (dayClientIds.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from('booking_links')
        .select('client_id, token')
        .in('client_id', dayClientIds)
        .eq('active', true);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((l: any) => {
        if (l.client_id && l.token) map[l.client_id] = l.token;
      });
      return map;
    },
    enabled: open && dayClientIds.length > 0,
  });

  const getBookingUrl = (clientId: string) => {
    const token = bookingLinks?.[clientId];
    if (!token) return null;
    return `${window.location.origin}/booking/${token}`;
  };

  const handleCopyBookingLink = async (clientId: string, clientName: string) => {
    const url = getBookingUrl(clientId);
    if (!url) {
      toast.error('Link de agendamento não disponível para este atleta');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Link de ${clientName} copiado!`);
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  };

  if (!selectedDate) return null;

  const daySchedules = schedules.filter(
    (s) =>
      s.status === 'pending' &&
      format(parseISO(s.send_link_date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
  );

  const getClient = (clientId: string) => clients.find((c) => c.id === clientId);

  const getConsultationNumber = (schedule: ConsultationSchedule) => {
    const clientSchedules = allSchedules
      .filter((s) => s.client_id === schedule.client_id)
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
    const idx = clientSchedules.findIndex((s) => s.id === schedule.id);
    const client = getClient(schedule.client_id);
    if (idx === -1 || !client?.consultation_count) return null;
    return { current: idx + 1, total: client.consultation_count };
  };

  const handleStartEdit = (scheduleId: string) => {
    setEditing({ scheduleId, mode: null, newDate: undefined });
  };

  const handleSelectMode = (mode: EditMode) => {
    if (!editing) return;
    setEditing({ ...editing, mode, newDate: undefined });
  };

  const handleSelectDate = (date: Date | undefined) => {
    if (!date || !editing) return;
    if (getDay(date) !== 1) {
      toast.error('Selecione uma segunda-feira');
      return;
    }
    setEditing({ ...editing, newDate: date });
  };

  const handleSave = async () => {
    if (!editing?.newDate || !editing.mode) return;
    setSaving(true);

    try {
      const schedule = allSchedules.find((s) => s.id === editing.scheduleId);
      if (!schedule) throw new Error('Schedule not found');

      const newDateStr = format(editing.newDate, 'yyyy-MM-dd');

      if (editing.mode === 'change_only') {
        // Only update this specific schedule
        await updateSchedule.mutateAsync({
          id: editing.scheduleId,
          send_link_date: newDateStr,
          scheduled_date: newDateStr,
        });
        toast.success('Data de envio atualizada');
      } else {
        // Adapt pipeline: update this + recalculate all future schedules
        const client = getClient(schedule.client_id);
        if (!client) throw new Error('Client not found');

        const cadenceWeeks = client.consultation_frequency === 'six_weeks' ? 6 : 4;

        // Get all schedules for this client, sorted by date
        const clientSchedules = allSchedules
          .filter((s) => s.client_id === schedule.client_id)
          .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

        const currentIdx = clientSchedules.findIndex((s) => s.id === editing.scheduleId);
        if (currentIdx === -1) throw new Error('Schedule not found in pipeline');

        // Update current schedule
        await supabase
          .from('consultation_schedules')
          .update({ send_link_date: newDateStr, scheduled_date: newDateStr })
          .eq('id', editing.scheduleId);

        // Update all future schedules based on the new date
        let nextDate = editing.newDate;
        for (let i = currentIdx + 1; i < clientSchedules.length; i++) {
          const futureSchedule = clientSchedules[i];
          // Only update pending ones
          if (futureSchedule.status !== 'pending') continue;

          nextDate = addWeeks(nextDate, cadenceWeeks);
          // Ensure it's a Monday
          if (getDay(nextDate) !== 1) {
            nextDate = nextMonday(nextDate);
          }

          const futureDateStr = format(nextDate, 'yyyy-MM-dd');
          await supabase
            .from('consultation_schedules')
            .update({ send_link_date: futureDateStr, scheduled_date: futureDateStr })
            .eq('id', futureSchedule.id);
        }

        // Also update client's next_link_send_date in consultation_schedules view
        queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
        toast.success('Pipeline adaptada com sucesso');
      }

      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      setEditing(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar alteração');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      await deleteSchedule.mutateAsync(scheduleId);
      toast.success('Envio de link removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const handleMarkSent = async (scheduleId: string) => {
    try {
      await updateSchedule.mutateAsync({ id: scheduleId, status: 'sent' });
      toast.success('Marcado como enviado');
    } catch {
      toast.error('Erro ao marcar como enviado');
    }
  };

  const handleConfirmConsultation = async (scheduleId: string, consultDate: string) => {
    setSaving(true);
    try {
      const schedule = allSchedules.find((s) => s.id === scheduleId);
      if (!schedule) throw new Error('Schedule not found');

      // Determine if the consultation date is in the future or past/today
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const isFuture = consultDate > todayStr;
      const targetStatus = isFuture ? 'scheduled' : 'completed';
      const targetApptStatus = isFuture ? 'confirmed' : 'completed';

      // Update schedule status accordingly
      await supabase
        .from('consultation_schedules')
        .update({ status: targetStatus, scheduled_date: consultDate, updated_at: new Date().toISOString() })
        .eq('id', scheduleId);

      // Check if appointment exists
      const { data: existingApt } = await supabase
        .from('appointments')
        .select('id')
        .eq('client_id', schedule.client_id)
        .eq('appointment_date', consultDate)
        .in('status', ['completed', 'confirmed', 'scheduled'])
        .maybeSingle();

      if (!existingApt) {
        // Get admin user_id from the schedule
        const { data: clientData } = await supabase
          .from('clients')
          .select('user_id')
          .eq('id', schedule.client_id)
          .single();

        if (clientData) {
          await supabase.from('appointments').insert({
            client_id: schedule.client_id,
            user_id: clientData.user_id,
            appointment_date: consultDate,
            appointment_time: '09:00',
            duration_minutes: 60,
            status: targetApptStatus,
            notes_admin: isFuture
              ? 'Consulta confirmada manualmente (futura)'
              : 'Consulta confirmada manualmente (retroativa)',
            timezone: 'America/Fortaleza',
          });
        }
      } else {
        await supabase.from('appointments').update({ status: targetApptStatus }).eq('id', existingApt.id);
      }

      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-appointments'] });
      setConfirmingId(null);
      setConfirmDate('');
      toast.success('Consulta confirmada!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao confirmar consulta');
    } finally {
      setSaving(false);
    }
  };

  const editingSchedule = editing
    ? allSchedules.find((s) => s.id === editing.scheduleId)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Links Agendados — {format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
          </DialogTitle>
          <DialogDescription>
            {daySchedules.length} envio{daySchedules.length !== 1 ? 's' : ''} de link programado{daySchedules.length !== 1 ? 's' : ''} para este dia
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px]">
          {daySchedules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum envio de link pendente para este dia</p>
            </div>
          ) : (
            <div className="space-y-3 pr-3">
              {daySchedules.map((schedule) => {
                const consultNum = getConsultationNumber(schedule);
                const client = getClient(schedule.client_id);
                const isEditing = editing?.scheduleId === schedule.id;

                return (
                  <div
                    key={schedule.id}
                    className={cn(
                      'rounded-lg border p-3 transition-all',
                      isEditing
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border bg-card hover:bg-muted/50'
                    )}
                  >
                    {/* Header row */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{schedule.client_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {consultNum && (
                              <Badge variant="outline" className="text-[10px]">
                                Consulta {consultNum.current}/{consultNum.total}
                              </Badge>
                            )}
                            {client?.consultation_frequency && (
                              <Badge variant="secondary" className="text-[10px]">
                                {client.consultation_frequency === 'six_weeks' ? '6 sem' : '4 sem'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          {/* Copy booking link */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-primary hover:text-primary"
                            onClick={() => handleCopyBookingLink(schedule.client_id, schedule.client_name)}
                            title={
                              getBookingUrl(schedule.client_id)
                                ? 'Copiar link de agendamento'
                                : 'Link de agendamento indisponível'
                            }
                            disabled={!getBookingUrl(schedule.client_id)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {/* Show confirm button for overdue items */}
                          {isPast(parseISO(schedule.send_link_date)) && !isToday(parseISO(schedule.send_link_date)) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                              onClick={() => {
                                setConfirmingId(schedule.id);
                                setConfirmDate(schedule.send_link_date);
                              }}
                              title="Confirmar que a consulta ocorreu"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-600"
                            onClick={() => handleMarkSent(schedule.id)}
                            title="Marcar como enviado"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-primary"
                            onClick={() => handleStartEdit(schedule.id)}
                            title="Editar data de envio"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => handleDelete(schedule.id)}
                            title="Remover envio"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}

                      {/* Confirm consultation inline form */}
                      {confirmingId === schedule.id && !isEditing && (
                        <div className="mt-2 p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                          <p className="text-xs text-muted-foreground mb-1.5">Data em que a consulta ocorreu:</p>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="date"
                              value={confirmDate}
                              onChange={e => setConfirmDate(e.target.value)}
                              className="h-7 text-xs flex-1"
                            />
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleConfirmConsultation(schedule.id, confirmDate)}
                              disabled={!confirmDate || saving}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-1.5"
                              onClick={() => { setConfirmingId(null); setConfirmDate(''); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Booking link preview */}
                    {!isEditing && getBookingUrl(schedule.client_id) && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1.5">
                        <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span
                          className="text-[11px] text-muted-foreground truncate flex-1"
                          title={getBookingUrl(schedule.client_id) || ''}
                        >
                          {getBookingUrl(schedule.client_id)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] gap-1"
                          onClick={() => handleCopyBookingLink(schedule.client_id, schedule.client_name)}
                        >
                          <Copy className="h-3 w-3" />
                          Copiar
                        </Button>
                      </div>
                    )}

                    {/* Edit panel */}
                    {isEditing && (
                      <div className="mt-3 space-y-3">
                        <Separator />

                        {/* Mode selection */}
                        {!editing.mode && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Como deseja alterar?
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              <button
                                onClick={() => handleSelectMode('adapt_pipeline')}
                                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                              >
                                <RefreshCw className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium">Adaptar Pipeline</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Move esta data e recalcula todas as datas futuras deste atleta automaticamente
                                  </p>
                                </div>
                              </button>
                              <button
                                onClick={() => handleSelectMode('change_only')}
                                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-amber-500 hover:bg-amber-500/5 transition-all text-left"
                              >
                                <Edit2 className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium">Alterar Apenas Esta Data</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Move somente este envio de link, sem afetar as datas futuras
                                  </p>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Date picker after mode selection */}
                        {editing.mode && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  editing.mode === 'adapt_pipeline'
                                    ? 'border-primary/40 text-primary'
                                    : 'border-amber-500/40 text-amber-600'
                                )}
                              >
                                {editing.mode === 'adapt_pipeline' ? (
                                  <><RefreshCw className="h-3 w-3 mr-1" />Adaptar Pipeline</>
                                ) : (
                                  <><Edit2 className="h-3 w-3 mr-1" />Apenas Esta Data</>
                                )}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs text-muted-foreground"
                                onClick={() => setEditing({ ...editing, mode: null, newDate: undefined })}
                              >
                                Trocar modo
                              </Button>
                            </div>

                            {editing.mode === 'adapt_pipeline' && (
                              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-2">
                                <div className="flex items-start gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                                    Todas as datas futuras deste atleta serão recalculadas com base na cadência de{' '}
                                    {client?.consultation_frequency === 'six_weeks' ? '6' : '4'} semanas.
                                  </p>
                                </div>
                              </div>
                            )}

                            <p className="text-xs font-medium text-muted-foreground">
                              Nova segunda-feira para envio:
                            </p>
                            <Calendar
                              mode="single"
                              selected={editing.newDate}
                              onSelect={handleSelectDate}
                              locale={ptBR}
                              className="rounded-md border pointer-events-auto mx-auto"
                              modifiers={{ monday: (date) => getDay(date) === 1 }}
                              modifiersStyles={{ monday: { fontWeight: 'bold' } }}
                            />

                            {editing.newDate && (
                              <div className="flex items-center justify-between rounded-md bg-muted p-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">
                                    {format(parseISO(schedule.send_link_date), 'dd/MM')}
                                  </span>
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-medium text-primary">
                                    {format(editing.newDate, 'dd/MM/yyyy')}
                                  </span>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={!editing.newDate || saving}
                                className="flex-1"
                              >
                                {saving ? 'Salvando...' : 'Confirmar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
