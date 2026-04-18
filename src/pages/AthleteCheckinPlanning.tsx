import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCheckinForms } from '@/hooks/useCheckinForms';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, MessageSquareText, Pencil, Send, Trash2, AlertCircle, Plus } from 'lucide-react';
import { format, parseISO, addDays, addWeeks, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { AthleteCheckinSchedules } from '@/components/admin/AthleteCheckinSchedules';

interface DispatchRow {
  id: string;
  client_id: string;
  user_id: string;
  checkin_form_id: string;
  schedule_id: string | null;
  sent_at: string;
  due_at: string | null;
  status: string;
  link_checkin: string | null;
  checkin_forms?: { title: string } | null;
}

interface ResponseRow {
  id: string;
  form_id: string;
  submitted_at: string;
}

interface FeedbackRow {
  id: string;
  checkin_response_id: string;
  status: string;
  sent_at: string | null;
}

interface ScheduleRow {
  id: string;
  checkin_form_id: string;
  start_date: string;
  send_time: string;
  frequency_type: string;
  weekly_days: number[] | null;
  is_active: boolean;
  due_in_hours: number | null;
  checkin_forms?: { title: string } | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  sent: { label: 'Enviado', cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  failed: { label: 'Falhou', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  pending: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  scheduled: { label: 'Programado', cls: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
};

function projectFutureDates(schedule: ScheduleRow, fromDate: Date, weeksAhead = 12, endDate?: Date | null): Date[] {
  const out: Date[] = [];
  const start = parseISO(schedule.start_date);
  const horizonByWeeks = addWeeks(fromDate, weeksAhead);
  // Respect plan end_date: never project beyond plan vigency
  const horizon = endDate && isBefore(endDate, horizonByWeeks) ? endDate : horizonByWeeks;

  const stepWeeks = (() => {
    switch (schedule.frequency_type) {
      case 'weekly': return 1;
      case 'biweekly': return 2;
      case 'three_weeks': return 3;
      case 'monthly': return 4;
      case 'bimonthly': return 8;
      case 'quarterly': return 12;
      default: return 1;
    }
  })();

  // Always honor weekly_days when present (defaults to Monday)
  const days = schedule.weekly_days?.length ? schedule.weekly_days : [1];
  // Anchor cursor to the FIRST configured weekday on/after start_date,
  // so monthly/bimonthly/quarterly cadences land on the configured day, not on start_date's weekday.
  const startDay = startOfDay(start);
  const firstDow = days[0];
  const initialOffset = (firstDow - startDay.getDay() + 7) % 7;
  let cursor = addDays(startDay, initialOffset);

  while (isBefore(cursor, horizon)) {
    for (const dow of days) {
      const offset = (dow - cursor.getDay() + 7) % 7;
      const d = addDays(cursor, offset);
      if (!isBefore(d, fromDate) && isBefore(d, horizon)) out.push(d);
    }
    cursor = addWeeks(cursor, stepWeeks);
  }

  const map = new Map<string, Date>();
  out.forEach(d => map.set(d.toISOString().slice(0, 10), d));
  return Array.from(map.values()).sort((a, b) => a.getTime() - b.getTime());
}

export default function AthleteCheckinPlanning() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: forms = [] } = useCheckinForms();

  // Edit existing dispatch (any status)
  const [editing, setEditing] = useState<DispatchRow | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editFormId, setEditFormId] = useState('');
  const [deleting, setDeleting] = useState<DispatchRow | null>(null);

  // Add manual override (creates a 'scheduled' dispatch)
  const [adding, setAdding] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [addFormId, setAddFormId] = useState('');
  const [addScheduleId, setAddScheduleId] = useState<string | null>(null);

  const { data: client } = useQuery({
    queryKey: ['client-name', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name, checkin_frequency, user_id, end_date').eq('id', clientId!).maybeSingle();
      return data;
    },
  });

  const { data: dispatches = [], isLoading: loadingDispatches } = useQuery({
    queryKey: ['planning-dispatches', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_dispatches')
        .select('id, client_id, user_id, checkin_form_id, schedule_id, sent_at, due_at, status, link_checkin, checkin_forms(title)')
        .eq('client_id', clientId!)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DispatchRow[];
    },
  });

  const { data: responses = [] } = useQuery({
    queryKey: ['planning-responses', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from('checkin_responses')
        .select('id, form_id, submitted_at')
        .eq('client_id', clientId!)
        .order('submitted_at', { ascending: false });
      return (data || []) as ResponseRow[];
    },
  });

  const { data: feedbacks = [] } = useQuery({
    queryKey: ['planning-feedbacks', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from('checkin_feedbacks')
        .select('id, checkin_response_id, status, sent_at')
        .eq('client_id', clientId!);
      return (data || []) as FeedbackRow[];
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['planning-schedules', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_checkin_schedules')
        .select('id, checkin_form_id, start_date, send_time, frequency_type, weekly_days, is_active, due_in_hours, checkin_forms(title)')
        .eq('client_id', clientId!);
      return (data || []) as unknown as ScheduleRow[];
    },
  });

  const updateDispatch = useMutation({
    mutationFn: async ({ id, sent_at, checkin_form_id }: { id: string; sent_at: string; checkin_form_id: string }) => {
      const { error } = await supabase
        .from('checkin_dispatches')
        .update({ sent_at, checkin_form_id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-dispatches', clientId] });
      toast.success('Envio atualizado');
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDispatch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checkin_dispatches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-dispatches', clientId] });
      toast.success('Envio excluído');
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createOverride = useMutation({
    mutationFn: async ({ sent_at, checkin_form_id, schedule_id }: { sent_at: string; checkin_form_id: string; schedule_id: string | null }) => {
      const sched = schedules.find(s => s.id === schedule_id);
      const dueInHours = sched?.due_in_hours || 48;
      const dueAt = new Date(new Date(sent_at).getTime() + dueInHours * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('checkin_dispatches').insert({
        client_id: clientId!,
        user_id: client?.user_id || user?.id,
        checkin_form_id,
        schedule_id,
        sent_at,
        due_at: dueAt,
        status: 'scheduled',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning-dispatches', clientId] });
      toast.success('Envio programado');
      setAdding(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const planningRows = useMemo(() => {
    return dispatches.map(d => {
      const sentDate = parseISO(d.sent_at);
      const matchedResponse = responses.find(r =>
        r.form_id === d.checkin_form_id && parseISO(r.submitted_at) >= sentDate
      );
      const fb = matchedResponse ? feedbacks.find(f => f.checkin_response_id === matchedResponse.id) : null;
      return { dispatch: d, response: matchedResponse, feedback: fb };
    });
  }, [dispatches, responses, feedbacks]);

  const futureRows = useMemo(() => {
    const now = new Date();
    const planEnd = client?.end_date ? parseISO(client.end_date) : null;
    const items: { date: Date; formTitle: string; formId: string; scheduleId: string }[] = [];
    schedules.filter(s => s.is_active).forEach(s => {
      projectFutureDates(s, now, 12, planEnd).forEach(d => {
        const exists = dispatches.some(disp =>
          disp.checkin_form_id === s.checkin_form_id &&
          format(parseISO(disp.sent_at), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')
        );
        if (!exists) items.push({ date: d, formTitle: s.checkin_forms?.title || 'Check-in', formId: s.checkin_form_id, scheduleId: s.id });
      });
    });
    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 20);
  }, [schedules, dispatches, client?.end_date]);

  const openEdit = (d: DispatchRow) => {
    setEditing(d);
    setEditDate(format(parseISO(d.sent_at), "yyyy-MM-dd'T'HH:mm"));
    setEditFormId(d.checkin_form_id);
  };

  const openAddOverride = (initialDate?: Date, initialFormId?: string, initialScheduleId?: string | null) => {
    const base = initialDate || new Date();
    setAddDate(format(base, "yyyy-MM-dd'T'HH:mm"));
    setAddFormId(initialFormId || forms[0]?.id || '');
    setAddScheduleId(initialScheduleId ?? null);
    setAdding(true);
  };

  const activeForms = forms.filter(f => f.is_active);

  return (
    <Layout>
      <div className="container mx-auto p-4 lg:p-6 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${clientId}`)} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Planejamento de Check-ins</h1>
            <p className="text-sm text-muted-foreground">
              {client?.name || 'Atleta'} • Frequência: {client?.checkin_frequency || '—'}
            </p>
          </div>
        </div>

        {clientId && <AthleteCheckinSchedules clientId={clientId} />}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Linha do tempo de envios
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => openAddOverride()} className="gap-1">
                <Plus className="h-3 w-3" />
                Programar envio
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingDispatches && (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            )}

            {!loadingDispatches && planningRows.length === 0 && futureRows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum check-in programado ou enviado ainda.
              </p>
            )}

            {planningRows.map(({ dispatch, response, feedback }) => {
              const stat = STATUS_LABEL[dispatch.status] || { label: dispatch.status, cls: '' };
              const responded = !!response;
              const feedbackSent = feedback?.status === 'sent' || !!feedback?.sent_at;
              const isFuture = dispatch.status === 'scheduled';
              return (
                <div key={dispatch.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm truncate">{dispatch.checkin_forms?.title || 'Check-in'}</span>
                      <Badge variant="outline" className={stat.cls}>{stat.label}</Badge>
                      {!isFuture && (responded ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Respondido
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">Sem resposta</Badge>
                      ))}
                      {responded && (
                        feedbackSent ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            <MessageSquareText className="h-3 w-3 mr-1" /> Feedback enviado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                            <AlertCircle className="h-3 w-3 mr-1" /> Feedback pendente
                          </Badge>
                        )
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Send className="h-3 w-3" />
                        {isFuture ? 'Programado para' : 'Enviado'} {format(parseISO(dispatch.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {dispatch.due_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Prazo {format(parseISO(dispatch.due_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                      )}
                      {response && (
                        <span>Respondido em {format(parseISO(response.submitted_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {response && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/checkin-review/${response.id}`)}>
                        Revisar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(dispatch)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(dispatch)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {futureRows.length > 0 && (
              <div className="pt-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Próximos envios projetados pela automação</p>
                <div className="space-y-2">
                  {futureRows.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-dashed bg-muted/20">
                      <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium truncate">{f.formTitle}</span>
                        <span className="text-muted-foreground truncate">
                          {format(f.date, "EEEE, dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">Projetado</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const d = new Date(f.date);
                            d.setHours(9, 0, 0, 0);
                            openAddOverride(d, f.formId, f.scheduleId);
                          }}
                          title="Personalizar este envio"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* EDIT EXISTING DISPATCH */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar envio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de check-in</Label>
              <Select value={editFormId} onValueChange={setEditFormId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeForms.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              disabled={updateDispatch.isPending || !editDate || !editFormId}
              onClick={() => editing && updateDispatch.mutate({
                id: editing.id,
                sent_at: new Date(editDate).toISOString(),
                checkin_form_id: editFormId,
              })}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE OVERRIDE */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programar envio personalizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de check-in</Label>
              <Select value={addFormId} onValueChange={setAddFormId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {activeForms.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data e hora do envio</Label>
              <Input type="datetime-local" value={addDate} onChange={e => setAddDate(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                Será enviado automaticamente na data/hora selecionada.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button
              disabled={createOverride.isPending || !addDate || !addFormId}
              onClick={() => createOverride.mutate({
                sent_at: new Date(addDate).toISOString(),
                checkin_form_id: addFormId,
                schedule_id: addScheduleId,
              })}
            >
              Programar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir envio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o registro do envio. Caso o atleta já tenha respondido, a resposta permanece preservada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteDispatch.mutate(deleting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
