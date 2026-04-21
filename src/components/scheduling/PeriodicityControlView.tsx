import { useMemo, useState } from 'react';
import { usePeriodicityControl, type PeriodicityRow, type PeriodicityStatus } from '@/hooks/usePeriodicityControl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Download, Activity, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<PeriodicityStatus, string> = {
  on_track: '🟢 Em dia',
  attention: '🟡 Atenção',
  late: '🔴 Atrasado',
  no_data: '⚫ Sem dados',
  frozen: '⚫ Congelado',
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

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

function downloadCSV(rows: PeriodicityRow[]) {
  const headers = [
    'Atleta',
    'Plano',
    'Periodicidade',
    'Último link enviado',
    'Próximo envio',
    'Dias até próximo envio',
    'Status',
    'Última consulta realizada',
    'Intervalo real (dias)',
    'Desvio (dias)',
  ];
  const lines = rows.map((r) => [
    r.client_name,
    r.plan_type,
    r.cadence_label,
    fmtDate(r.last_link_sent_at),
    fmtDate(r.next_send_date),
    r.days_to_next_send ?? '',
    STATUS_LABELS[r.status].replace(/[🟢🟡🔴⚫]\s*/g, ''),
    fmtDate(r.last_completed_at),
    r.real_interval_days ?? '',
    r.deviation_days ?? '',
  ]);
  const csv = [headers, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `controle-periodicidade-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PeriodicityControlView() {
  const { data: rows = [], isLoading } = usePeriodicityControl();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cadenceFilter, setCadenceFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.client_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (cadenceFilter !== 'all' && r.cadence_label !== cadenceFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter, cadenceFilter]);

  const totals = useMemo(() => {
    return {
      on_track: rows.filter((r) => r.status === 'on_track').length,
      attention: rows.filter((r) => r.status === 'attention').length,
      late: rows.filter((r) => r.status === 'late').length,
      inactive: rows.filter((r) => r.status === 'inactive').length,
    };
  }, [rows]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Controle de Periodicidade
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Compare a cadência cadastrada com a real e identifique atletas em atraso
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 lg:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar atleta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="on_track">🟢 Em dia</SelectItem>
              <SelectItem value="attention">🟡 Atenção</SelectItem>
              <SelectItem value="late">🔴 Atrasado</SelectItem>
              <SelectItem value="inactive">⚫ Inativo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cadenceFilter} onValueChange={setCadenceFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Cadência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="4w">4 semanas</SelectItem>
              <SelectItem value="6w">6 semanas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(filtered)} className="gap-1">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="text-xs text-muted-foreground">Em dia</div>
            <div className="text-2xl font-bold text-emerald-600">{totals.on_track}</div>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="text-xs text-muted-foreground">Atenção</div>
            <div className="text-2xl font-bold text-amber-600">{totals.attention}</div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <div className="text-xs text-muted-foreground">Atrasados</div>
            <div className="text-2xl font-bold text-red-600">{totals.late}</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Inativos</div>
            <div className="text-2xl font-bold text-muted-foreground">{totals.inactive}</div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs font-semibold text-foreground">
                <th className="p-2">Atleta</th>
                <th className="p-2">Plano</th>
                <th className="p-2">Cadência</th>
                <th className="p-2">Último link</th>
                <th className="p-2">Próximo envio</th>
                <th className="p-2 text-center">Dias</th>
                <th className="p-2">Status</th>
                <th className="p-2">Última consulta</th>
                <th className="p-2 text-center">Real (d)</th>
                <th className="p-2 text-center">Desvio</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-muted-foreground">
                    Nenhum atleta encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const deviationHigh = r.deviation_days !== null && r.deviation_days > 7;
                  return (
                    <tr key={r.client_id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-2 font-medium text-foreground">{r.client_name}</td>
                      <td className="p-2 text-muted-foreground">{r.plan_type}</td>
                      <td className="p-2 text-muted-foreground">{r.cadence_label}</td>
                      <td className="p-2 text-muted-foreground">{fmtDate(r.last_link_sent_at)}</td>
                      <td className="p-2 text-muted-foreground">{fmtDate(r.next_send_date)}</td>
                      <td className="p-2 text-center text-muted-foreground">
                        {r.days_to_next_send !== null ? `${r.days_to_next_send}d` : '—'}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className={cn('text-xs', STATUS_CLASSES[r.status])}>
                          {STATUS_LABELS[r.status]}
                        </Badge>
                      </td>
                      <td className="p-2 text-muted-foreground">{fmtDate(r.last_completed_at)}</td>
                      <td className="p-2 text-center text-muted-foreground">
                        {r.real_interval_days !== null ? `${r.real_interval_days}` : '—'}
                      </td>
                      <td className={cn('p-2 text-center', deviationHigh && 'text-red-600 font-semibold')}>
                        {r.deviation_days !== null ? `${r.deviation_days}d` : '—'}
                      </td>
                      <td className="p-2">
                        <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                          <Link to={`/clients/${r.client_id}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
