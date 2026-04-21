import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, Loader2, Search, Download, Activity, ExternalLink,
  MoreVertical, CalendarClock, RefreshCw, AlertTriangle, Send, History,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePeriodicityControl, type PeriodicityRow, type PeriodicityStatus } from '@/hooks/usePeriodicityControl';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DayCalendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<PeriodicityStatus, string> = {
  on_track: '🟢 Em dia',
  attention: '🟡 Atenção',
  late: '🔴 Atrasado',
  no_data: '⚫ Sem dados',
  frozen: '🔵 Congelado',
  inactive: '⚫ Inativo',
};
const STATUS_CLASSES: Record<PeriodicityStatus, string> = {
  on_track: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  attention: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  late: 'bg-red-500/10 text-red-600 border-red-500/30',
  no_data: 'bg-muted text-muted-foreground border-border',
  frozen: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  inactive: 'bg-muted text-muted-foreground border-border',
};
const FREQ_LABEL: Record<string, string> = {
  '4_weeks': '4w', six_weeks: '6w', monthly: 'mensal',
};
const fmt = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR }); } catch { return '—'; }
};
const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return '—'; }
};

function freqDays(freq: string | null | undefined): number {
  if (freq === 'six_weeks' || freq === '6_weeks') return 42;
  if (freq === '4_weeks') return 28;
  if (freq === 'monthly') return 30;
  return 28;
}

function downloadCSV(rows: PeriodicityRow[]) {
  const headers = [
    'Atleta','Plano','Periodicidade (dias)','Último link enviado','Próximo envio',
    'Dias até próximo','Intervalo real (dias)','Desvio (dias)','Status',
  ];
  const csv = [headers.join(';')]
    .concat(rows.map((r) => [
      `"${r.client_name.replace(/"/g, '""')}"`,
      r.plan_type,
      r.cadence_days ?? '',
      fmt(r.last_link_sent_at),
      fmt(r.next_send_date),
      r.days_to_next_send ?? '',
      r.real_interval_days ?? '',
      r.deviation_days ?? '',
      STATUS_LABELS[r.status],
    ].join(';')))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `periodicidade-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Histórico ──────────────────────────────────────────────────────────────
function CorrectionsHistory() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ['periodicity-corrections', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('whatsapp_message_logs')
        .select('id, created_at, client_id, template_key, metadata, triggered_by, message_type')
        .eq('user_id', user.id)
        .eq('message_type', 'periodicity_correction')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const clientIds = Array.from(new Set(data.map((d: any) => d.client_id).filter(Boolean)));
  const { data: clients = [] } = useQuery({
    queryKey: ['periodicity-corrections-clients', clientIds.join(',')],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const { data } = await supabase.from('clients').select('id, name').in('id', clientIds);
      return data || [];
    },
    enabled: clientIds.length > 0,
  });
  const nameById = new Map(clients.map((c: any) => [c.id, c.name]));

  const TYPE_LABEL: Record<string, string> = {
    adjust_next_date: 'Ajuste de próxima data',
    update_frequency: 'Periodicidade atualizada',
    rebuild_pipeline: 'Pipeline recriada',
    manual_send: 'Envio manual',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Histórico de correções
        </CardTitle>
        <CardDescription>Ações manuais registradas a partir desta página.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma correção registrada ainda.</p>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Atleta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Registros afetados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((log: any) => {
                  const meta = (log.metadata || {}) as any;
                  const type = meta.correction_type || 'manual_send';
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{fmtDateTime(log.created_at)}</TableCell>
                      <TableCell>{nameById.get(log.client_id) || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABEL[type] || type}</Badge>
                        {meta.note && (
                          <span className="ml-2 text-xs text-muted-foreground">{meta.note}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{meta.records_affected ?? 1}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Mutations / log helper ─────────────────────────────────────────────────
async function logCorrection(params: {
  user_id: string;
  client_id: string;
  to_phone: string | null;
  type: 'adjust_next_date' | 'update_frequency' | 'rebuild_pipeline' | 'manual_send';
  records_affected: number;
  note?: string;
  extra?: Record<string, unknown>;
}) {
  await supabase.from('whatsapp_message_logs').insert({
    user_id: params.user_id,
    client_id: params.client_id,
    to_phone: params.to_phone || 'n/a',
    message_type: 'periodicity_correction',
    template_key: `correction.${params.type}`,
    status: 'sent',
    triggered_by: 'manual_admin',
    payload_preview: params.note || null,
    metadata: {
      correction_type: params.type,
      records_affected: params.records_affected,
      note: params.note,
      ...params.extra,
    },
  });
}

// ─── Dialog: ajustar próxima data ───────────────────────────────────────────
function AdjustNextDateDialog({ row, open, onOpenChange }: {
  row: PeriodicityRow | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState<Date | undefined>();
  const [cascade, setCascade] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row || !date || !user?.id) throw new Error('Dados incompletos');
      const newDateStr = format(date, 'yyyy-MM-dd');
      let affected = 0;

      if (cascade) {
        const days = row.cadence_days ?? freqDays(row.consultation_frequency);
        // Atualiza o próximo + recalcula seguintes
        const ids = row.pending_schedule_ids;
        for (let i = 0; i < ids.length; i++) {
          const target = format(addDays(date, i * days), 'yyyy-MM-dd');
          const { error } = await supabase
            .from('consultation_schedules')
            .update({ send_link_date: target, updated_at: new Date().toISOString() })
            .eq('id', ids[i]);
          if (error) throw error;
          affected++;
        }
      } else {
        if (!row.next_pending_schedule_id) throw new Error('Sem registro pendente para ajustar');
        const { error } = await supabase
          .from('consultation_schedules')
          .update({ send_link_date: newDateStr, updated_at: new Date().toISOString() })
          .eq('id', row.next_pending_schedule_id);
        if (error) throw error;
        affected = 1;
      }

      await logCorrection({
        user_id: user.id, client_id: row.client_id, to_phone: null,
        type: 'adjust_next_date', records_affected: affected,
        note: `Nova data ${newDateStr}${cascade ? ' (cascata)' : ''}`,
      });
      return affected;
    },
    onSuccess: (n) => {
      toast.success(`Cadência de ${row?.client_name} atualizada (${n} registro${n > 1 ? 's' : ''}).`);
      qc.invalidateQueries({ queryKey: ['periodicity-control'] });
      qc.invalidateQueries({ queryKey: ['periodicity-corrections'] });
      onOpenChange(false);
      setDate(undefined); setCascade(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao ajustar data'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar data do próximo envio</DialogTitle>
          <DialogDescription>
            {row?.client_name} • Periodicidade: {row?.cadence_label}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Data atual projetada: </span>
            <span className="font-medium">{fmt(row?.next_send_date)}</span>
          </div>

          <div className="space-y-2">
            <Label>Nova data de envio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarClock className="mr-2 h-4 w-4" />
                  {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione…'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DayCalendar
                  mode="single" selected={date} onSelect={setDate}
                  initialFocus className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="cascade" checked={cascade} onCheckedChange={(v) => setCascade(!!v)} />
            <Label htmlFor="cascade" className="text-sm cursor-pointer">
              Recalcular toda a cadeia a partir desta data
            </Label>
          </div>

          {cascade && (
            <p className="text-xs text-muted-foreground">
              {row?.pending_schedule_ids.length || 0} registro(s) pendente(s) serão recalculados em cascata.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!date || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: atualizar periodicidade ────────────────────────────────────────
function UpdateFrequencyDialog({ row, open, onOpenChange }: {
  row: PeriodicityRow | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [freq, setFreq] = useState<string>(row?.consultation_frequency || '4_weeks');
  const [cascade, setCascade] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row || !user?.id) throw new Error('Dados incompletos');
      let affected = 0;
      const { error: e1 } = await supabase
        .from('clients')
        .update({ consultation_frequency: freq })
        .eq('id', row.client_id);
      if (e1) throw e1;

      if (cascade) {
        const days = freqDays(freq);
        const anchor = row.last_link_sent_at ? parseISO(row.last_link_sent_at) : new Date();
        const ids = row.pending_schedule_ids;
        for (let i = 0; i < ids.length; i++) {
          const target = format(addDays(anchor, days * (i + 1)), 'yyyy-MM-dd');
          const { error } = await supabase
            .from('consultation_schedules')
            .update({ send_link_date: target, updated_at: new Date().toISOString() })
            .eq('id', ids[i]);
          if (error) throw error;
          affected++;
        }
      }

      await logCorrection({
        user_id: user.id, client_id: row.client_id, to_phone: null,
        type: 'update_frequency', records_affected: affected,
        note: `Periodicidade ${row.consultation_frequency || '—'} → ${freq}${cascade ? ` (recalculou ${affected})` : ''}`,
      });
      return affected;
    },
    onSuccess: (n) => {
      toast.success(`Periodicidade atualizada.${n > 0 ? ` ${n} datas recalculadas.` : ''}`);
      qc.invalidateQueries({ queryKey: ['periodicity-control'] });
      qc.invalidateQueries({ queryKey: ['periodicity-corrections'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      onOpenChange(false);
      setCascade(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v && row) setFreq(row.consultation_frequency || '4_weeks'); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Corrigir periodicidade cadastrada</DialogTitle>
          <DialogDescription>
            {row?.client_name} • Atual: {FREQ_LABEL[row?.consultation_frequency || ''] || row?.consultation_frequency || '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nova periodicidade</Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="4_weeks">4 semanas (28 dias)</SelectItem>
                <SelectItem value="six_weeks">6 semanas (42 dias)</SelectItem>
                <SelectItem value="monthly">Mensal (30 dias)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="cascade-freq" checked={cascade} onCheckedChange={(v) => setCascade(!!v)} />
            <Label htmlFor="cascade-freq" className="text-sm cursor-pointer">
              Recalcular pipeline inteira com a nova periodicidade
            </Label>
          </div>
          {cascade && (
            <p className="text-xs text-muted-foreground">
              Recalcula a partir do último link enviado ({fmt(row?.last_link_sent_at)}).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: recriar pipeline ───────────────────────────────────────────────
function RebuildPipelineDialog({ row, open, onOpenChange }: {
  row: PeriodicityRow | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmName, setConfirmName] = useState('');

  const { data: pendingCount } = useQuery({
    queryKey: ['rebuild-pipeline-count', row?.client_id],
    queryFn: async () => {
      if (!row) return 0;
      const { count } = await supabase
        .from('consultation_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', row.client_id)
        .eq('status', 'pending');
      return count || 0;
    },
    enabled: !!row && open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row || !user?.id) throw new Error('Dados incompletos');

      // Buscar dados do cliente para a RPC
      const { data: client, error: cErr } = await supabase
        .from('clients')
        .select('start_date, end_date, consultation_count, consultation_frequency')
        .eq('id', row.client_id).single();
      if (cErr) throw cErr;

      // Apaga pendentes
      const { error: dErr, count: deleted } = await supabase
        .from('consultation_schedules')
        .delete({ count: 'exact' })
        .eq('client_id', row.client_id)
        .eq('status', 'pending');
      if (dErr) throw dErr;

      // Anchor = última consulta completed; fallback start_date
      const anchorDate = row.last_completed_at || client.start_date;
      const { data: preview, error: pErr } = await supabase.rpc('preview_consultation_pipeline', {
        p_start_date: anchorDate,
        p_consultation_count: client.consultation_count,
        p_consultation_frequency: client.consultation_frequency,
        p_end_date: client.end_date,
      });
      if (pErr) throw pErr;

      // Insere novos a partir do segundo (o primeiro = anchor já realizado)
      const inserts = (preview || [])
        .filter((p: any) => p.scheduled_date > anchorDate)
        .map((p: any) => ({
          client_id: row.client_id, user_id: user.id,
          scheduled_date: p.scheduled_date, send_link_date: p.send_link_date,
          status: 'pending',
        }));

      let inserted = 0;
      if (inserts.length > 0) {
        const { error: iErr, data } = await supabase
          .from('consultation_schedules').insert(inserts).select('id');
        if (iErr) throw iErr;
        inserted = data?.length || 0;
      }

      await logCorrection({
        user_id: user.id, client_id: row.client_id, to_phone: null,
        type: 'rebuild_pipeline', records_affected: inserted,
        note: `Deletados ${deleted || 0} pending; inseridos ${inserted}`,
        extra: { deleted: deleted || 0, inserted },
      });

      return { deleted: deleted || 0, inserted };
    },
    onSuccess: ({ inserted, deleted }) => {
      toast.success(`Pipeline recriada. Removidos: ${deleted}, criados: ${inserted}.`);
      qc.invalidateQueries({ queryKey: ['periodicity-control'] });
      qc.invalidateQueries({ queryKey: ['periodicity-corrections'] });
      qc.invalidateQueries({ queryKey: ['consultation-schedules'] });
      onOpenChange(false);
      setConfirmName('');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao recriar pipeline'),
  });

  const nameMatches = (confirmName || '').trim().toLowerCase() === (row?.client_name || '').trim().toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setConfirmName(''); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Recriar pipeline do zero
          </DialogTitle>
          <DialogDescription>
            Isso vai apagar todos os registros pending desta pipeline e recriar a partir da
            última consulta realizada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Atleta</span><span className="font-medium">{row?.client_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Última consulta realizada</span><span className="font-medium">{fmt(row?.last_completed_at)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Periodicidade</span><span className="font-medium">{row?.cadence_label}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pending a deletar</span><span className="font-medium text-destructive">{pendingCount ?? '—'}</span></div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-name">
            Para confirmar, digite: <span className="font-semibold">{row?.client_name}</span>
          </Label>
          <Input id="confirm-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" disabled={!nameMatches || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Recriar pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline confirm: enviar agora ───────────────────────────────────────────
function SendNowConfirm({ row, onDone }: { row: PeriodicityRow; onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const send = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Sem sessão');
      const { error } = await supabase.functions.invoke('send-booking-link', {
        body: { client_id: row.client_id, triggered_by: 'manual_admin' },
      });
      if (error) throw error;

      await logCorrection({
        user_id: user.id, client_id: row.client_id, to_phone: null,
        type: 'manual_send', records_affected: 1,
        note: 'Envio fora do ciclo (auditoria de periodicidade)',
      });
    },
    onSuccess: () => {
      toast.success(`Link enviado para ${row.client_name}.`);
      qc.invalidateQueries({ queryKey: ['periodicity-control'] });
      qc.invalidateQueries({ queryKey: ['periodicity-corrections'] });
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar'),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2"><Send className="h-3.5 w-3.5" /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-sm mb-3">Enviar link de agendamento para <strong>{row.client_name}</strong> agora?</p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Confirmar envio
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────
export default function PeriodicityControl() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = usePeriodicityControl();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PeriodicityStatus | 'all'>('all');
  const [freqFilter, setFreqFilter] = useState<string>('all');

  const [adjustRow, setAdjustRow] = useState<PeriodicityRow | null>(null);
  const [freqRow, setFreqRow] = useState<PeriodicityRow | null>(null);
  const [rebuildRow, setRebuildRow] = useState<PeriodicityRow | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (freqFilter !== 'all' && r.consultation_frequency !== freqFilter) return false;
      if (search && !r.client_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, statusFilter, freqFilter, search]);

  const counts = useMemo(() => {
    const c: Record<PeriodicityStatus, number> = {
      on_track: 0, attention: 0, late: 0, no_data: 0, frozen: 0, inactive: 0,
    };
    rows.forEach((r) => { c[r.status]++; });
    return c;
  }, [rows]);

  const Card4 = ({ k, label, color }: { k: PeriodicityStatus; label: string; color: string }) => (
    <Card
      onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)}
      className={cn('cursor-pointer transition hover:shadow-md', statusFilter === k && 'ring-2 ring-primary')}
    >
      <CardContent className="p-4">
        <div className={cn('text-xs font-medium', color)}>{label}</div>
        <div className="text-2xl font-bold mt-1">{counts[k]}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/calendar')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Controle de Periodicidade
            </h1>
            <p className="text-sm text-muted-foreground">
              Auditoria de cadência por atleta e correções manuais.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => downloadCSV(filtered)} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          {/* Cards resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card4 k="on_track" label="🟢 Em dia (±3d)" color="text-emerald-600" />
            <Card4 k="attention" label="🟡 Atenção (4-7d)" color="text-amber-600" />
            <Card4 k="late" label="🔴 Atrasado (>7d)" color="text-red-600" />
            <Card4 k="no_data" label="⚫ Sem dados suficientes" color="text-muted-foreground" />
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome…" className="pl-9"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {(['late','attention','on_track','no_data','frozen','inactive'] as PeriodicityStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={freqFilter} onValueChange={setFreqFilter}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Periodicidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas frequências</SelectItem>
                  <SelectItem value="4_weeks">4 semanas</SelectItem>
                  <SelectItem value="six_weeks">6 semanas</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhum atleta encontrado.</p>
              ) : (
                <ScrollArea className="max-h-[70vh]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Atleta</TableHead>
                        <TableHead>Periodicidade</TableHead>
                        <TableHead>Último envio</TableHead>
                        <TableHead>Próximo envio</TableHead>
                        <TableHead className="text-right">Dias até</TableHead>
                        <TableHead className="text-right">Intervalo real</TableHead>
                        <TableHead className="text-right">Desvio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => {
                        const blocked = r.is_frozen || r.status === 'inactive';
                        return (
                          <TableRow key={r.client_id}>
                            <TableCell>
                              <div className="font-medium">{r.client_name}</div>
                              <div className="text-xs text-muted-foreground">{r.plan_type}</div>
                            </TableCell>
                            <TableCell className="text-sm">{r.cadence_label} {r.cadence_days ? <span className="text-xs text-muted-foreground">({r.cadence_days}d)</span> : null}</TableCell>
                            <TableCell className="text-sm">{fmt(r.last_link_sent_at)}</TableCell>
                            <TableCell className="text-sm">{fmt(r.next_send_date)}</TableCell>
                            <TableCell className={cn('text-right text-sm tabular-nums',
                              r.days_to_next_send !== null && r.days_to_next_send < 0 && 'text-red-600 font-medium')}>
                              {r.days_to_next_send ?? '—'}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {r.real_interval_days ?? '—'}
                              {r.real_interval_days !== null && !r.has_completed_for_interval && (
                                <span title="Sem consulta confirmada associada" className="ml-1">⚠</span>
                              )}
                            </TableCell>
                            <TableCell className={cn('text-right text-sm tabular-nums',
                              r.deviation_days !== null && Math.abs(r.deviation_days) > 7 && 'text-red-600 font-medium',
                              r.deviation_days !== null && Math.abs(r.deviation_days) > 3 && Math.abs(r.deviation_days) <= 7 && 'text-amber-600')}>
                              {r.deviation_days === null ? '—' : (r.deviation_days > 0 ? `+${r.deviation_days}` : r.deviation_days)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_CLASSES[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                                  <Link to={`/clients/${r.client_id}?tab=pipeline`}>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={blocked}>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Corrigir</DropdownMenuLabel>
                                    <DropdownMenuItem
                                      disabled={!r.next_pending_schedule_id}
                                      onClick={() => setAdjustRow(r)}>
                                      <CalendarClock className="h-3.5 w-3.5 mr-2" /> Ajustar próxima data
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setFreqRow(r)}>
                                      <RefreshCw className="h-3.5 w-3.5 mr-2" /> Corrigir periodicidade
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => setRebuildRow(r)}>
                                      <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Recriar pipeline
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                {!blocked && <SendNowConfirm row={r} onDone={() => {}} />}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Rodapé totais */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(['late','attention','on_track','no_data','frozen','inactive'] as PeriodicityStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <Badge variant="outline" className={STATUS_CLASSES[s]}>{STATUS_LABELS[s]}</Badge>
                <span>{counts[s]}</span>
              </span>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <CorrectionsHistory />
        </TabsContent>
      </Tabs>

      <AdjustNextDateDialog row={adjustRow} open={!!adjustRow} onOpenChange={(v) => !v && setAdjustRow(null)} />
      <UpdateFrequencyDialog row={freqRow} open={!!freqRow} onOpenChange={(v) => !v && setFreqRow(null)} />
      <RebuildPipelineDialog row={rebuildRow} open={!!rebuildRow} onOpenChange={(v) => !v && setRebuildRow(null)} />
    </div>
  );
}
