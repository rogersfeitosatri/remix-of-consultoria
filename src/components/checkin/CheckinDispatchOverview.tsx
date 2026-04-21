import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CHECKIN_LABELS, CheckinFrequency } from '@/types/client';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, XCircle, Send, Search, RefreshCw, Loader2, Play, Activity, CalendarIcon, AlertCircle, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

type PeriodPreset = 'today' | '7d' | '15d' | '30d' | 'this_month' | 'custom';
type SortOrder = 'newest' | 'oldest';

interface DispatchRow {
  id: string;
  client_id: string;
  client_name: string;
  checkin_frequency: string | null;
  sent_at: string;
  status: string;
  error_message: string | null;
  responded_at: string | null;
  response_hours: number | null;
}

export function CheckinDispatchOverview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodPreset>('30d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [pendingOnly, setPendingOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Resolve period to date range
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case '7d':
        return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
      case '15d':
        return { from: startOfDay(subDays(now, 14)), to: endOfDay(now) };
      case '30d':
        return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
      case 'this_month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'custom':
        return customRange?.from
          ? { from: startOfDay(customRange.from), to: endOfDay(customRange.to || customRange.from) }
          : null;
    }
  }, [period, customRange]);

  const handleResend = async (dispatchId: string, clientName: string) => {
    setResendingId(dispatchId);
    try {
      const { error } = await supabase.functions.invoke('resend-checkin-dispatch', {
        body: { dispatchId },
      });
      if (error) throw error;
      toast.success(`Check-in reenviado para ${clientName}`);
      await queryClient.invalidateQueries({ queryKey: ['checkin-dispatch-overview'] });
    } catch (err: any) {
      toast.error(`Falha ao reenviar: ${err.message || 'erro desconhecido'}`);
    } finally {
      setResendingId(null);
    }
  };

  const [reprocessing, setReprocessing] = useState(false);
  const handleReprocess = async () => {
    if (!confirm('Reprocessar check-ins de hoje? Vai disparar envios para atletas elegíveis ainda não enviados.')) return;
    setReprocessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-checkin-dispatches', {
        body: { source: 'manual', forceReprocess: false },
      });
      if (error) throw error;
      toast.success(`Concluído: ${data?.dispatched || 0} enviados, ${data?.failed || 0} falhas`);
      await queryClient.invalidateQueries({ queryKey: ['checkin-dispatch-overview'] });
      await queryClient.invalidateQueries({ queryKey: ['checkin-dispatch-runs'] });
    } catch (err: any) {
      toast.error(`Falha ao reprocessar: ${err.message || 'erro'}`);
    } finally {
      setReprocessing(false);
    }
  };

  const { data: lastRun } = useQuery({
    queryKey: ['checkin-dispatch-runs', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('checkin_dispatch_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Auditoria: envios via Z-API sem dispatch correspondente (últimos 90 dias)
  const { data: auditMissing } = useQuery({
    queryKey: ['checkin-audit-missing-dispatch', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('checkin_send_audit' as any)
        .select('log_id, client_name, sent_at, audit_status')
        .eq('user_id', user.id)
        .eq('audit_status', 'missing_dispatch')
        .gte('sent_at', since)
        .order('sent_at', { ascending: false })
        .limit(50);
      if (error) return [];
      return (data || []) as any[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['checkin-dispatch-overview', user?.id],
    queryFn: async (): Promise<DispatchRow[]> => {
      if (!user?.id) return [];

      const { data: dispatches, error } = await supabase
        .from('checkin_dispatches')
        .select('id, client_id, checkin_form_id, sent_at, status, error_message, clients(name, checkin_frequency)')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      if (!dispatches?.length) return [];

      const clientIds = Array.from(new Set(dispatches.map((d: any) => d.client_id)));
      const { data: responses } = await supabase
        .from('checkin_responses')
        .select('client_id, form_id, submitted_at')
        .in('client_id', clientIds)
        .order('submitted_at', { ascending: true });

      const respList = responses || [];

      return dispatches.map((d: any) => {
        const sentAt = new Date(d.sent_at);
        const match = respList.find(
          (r: any) =>
            r.client_id === d.client_id &&
            r.form_id === d.checkin_form_id &&
            new Date(r.submitted_at) >= sentAt &&
            new Date(r.submitted_at) <= new Date(sentAt.getTime() + 14 * 24 * 60 * 60 * 1000),
        );
        const respondedAt = match?.submitted_at || null;
        const hours = respondedAt
          ? Math.round(((new Date(respondedAt).getTime() - sentAt.getTime()) / 3600000) * 10) / 10
          : null;

        return {
          id: d.id,
          client_id: d.client_id,
          client_name: d.clients?.name || 'Atleta removido',
          checkin_frequency: d.clients?.checkin_frequency || null,
          sent_at: d.sent_at,
          status: d.status,
          error_message: d.error_message,
          responded_at: respondedAt,
          response_hours: hours,
        };
      });
    },
    enabled: !!user?.id,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const fromMs = dateRange?.from.getTime();
    const toMs = dateRange?.to.getTime();
    const result = data.filter((d) => {
      if (fromMs && toMs) {
        const t = new Date(d.sent_at).getTime();
        if (t < fromMs || t > toMs) return false;
      }
      if (search && !d.client_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (frequencyFilter !== 'all' && d.checkin_frequency !== frequencyFilter) return false;
      if (pendingOnly) {
        if (d.responded_at || d.status === 'failed') return false;
      } else if (statusFilter !== 'all') {
        if (statusFilter === 'responded' && !d.responded_at) return false;
        if (statusFilter === 'pending' && (d.responded_at || d.status === 'failed')) return false;
        if (statusFilter === 'failed' && d.status !== 'failed') return false;
      }
      return true;
    });
    result.sort((a, b) => {
      const diff = new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime();
      return sortOrder === 'oldest' ? diff : -diff;
    });
    return result;
  }, [data, search, frequencyFilter, statusFilter, dateRange, pendingOnly, sortOrder]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const responded = filtered.filter((d) => d.responded_at).length;
    const failed = filtered.filter((d) => d.status === 'failed').length;
    const pending = total - responded - failed;
    const rate = total > 0 ? Math.round((responded / total) * 100) : 0;
    return { total, responded, failed, pending, rate };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="text-sm font-semibold">Cron Automático — Diário 07:00 (Fortaleza)</div>
              {lastRun ? (
                <div className="text-xs text-muted-foreground mt-1">
                  Última execução: {formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true, locale: ptBR })}
                  {' · '}
                  <Badge variant={lastRun.status === 'success' ? 'default' : lastRun.status === 'error' ? 'destructive' : 'secondary'} className="ml-1">
                    {lastRun.status}
                  </Badge>
                  {' · '}
                  Analisados {lastRun.total_analyzed} · Enviados {lastRun.total_dispatched} · Falhas {lastRun.total_failed} · Ignorados {lastRun.total_skipped}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-1">Nenhuma execução registrada ainda.</div>
              )}
            </div>
          </div>
          <Button onClick={handleReprocess} disabled={reprocessing} size="sm">
            {reprocessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Reprocessar check-ins de hoje
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Send className="h-3 w-3" />Enviados</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600 text-xs"><CheckCircle2 className="h-3 w-3" />Respondidos</div>
            <div className="text-2xl font-bold mt-1">{stats.responded} <span className="text-sm text-muted-foreground">({stats.rate}%)</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 text-xs"><Clock className="h-3 w-3" />Pendentes</div>
            <div className="text-2xl font-bold mt-1">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive text-xs"><XCircle className="h-3 w-3" />Falhas</div>
            <div className="text-2xl font-bold mt-1">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Envios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por atleta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger className="md:w-48"><SelectValue placeholder="Frequência" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas frequências</SelectItem>
                {Object.entries(CHECKIN_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="responded">Respondidos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="failed">Falhas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum envio encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atleta</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Respondido</TableHead>
                    <TableHead>Tempo de resposta</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => {
                    const canResend = d.status === 'failed' && !d.responded_at;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.client_name}</TableCell>
                        <TableCell>
                          {d.checkin_frequency
                            ? <Badge variant="outline">{CHECKIN_LABELS[d.checkin_frequency as CheckinFrequency] || d.checkin_frequency}</Badge>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(d.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {d.status === 'failed' ? (
                            <Badge variant="destructive">Falha</Badge>
                          ) : d.responded_at ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Respondido</Badge>
                          ) : (
                            <Badge variant="secondary">Pendente</Badge>
                          )}
                          {d.error_message && <div className="text-xs text-destructive mt-1">{d.error_message}</div>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {d.responded_at
                            ? format(new Date(d.responded_at), "dd/MM HH:mm", { locale: ptBR })
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {d.response_hours !== null
                            ? d.response_hours < 24
                              ? `${d.response_hours}h`
                              : `${Math.round(d.response_hours / 24)}d`
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {canResend && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resendingId === d.id}
                              onClick={() => handleResend(d.id, d.client_name)}
                              className="gap-1.5"
                            >
                              {resendingId === d.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Reenviar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
