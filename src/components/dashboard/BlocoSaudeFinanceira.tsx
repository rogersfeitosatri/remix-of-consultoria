import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePayments, useClients } from '@/hooks/useClients';
import { getMonthlyIncomeByPaidAt } from '@/hooks/useFinancialData';
import { DollarSign, TrendingUp, Users2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, subMonths, addMonths, format,
  isWithinInterval, parseISO, eachMonthOfInterval,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

const PLAN_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  six_weeks: '6 Semanas',
  custom: 'Personalizado',
};

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' && entry.name !== 'Planos'
            ? fmt(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  );
};

export function BlocoSaudeFinanceira() {
  const navigate = useNavigate();
  const { data: payments = [] } = usePayments();
  const { data: clients = [] } = useClients();
  const [refDate, setRefDate] = useState(new Date());

  const periodStart = startOfMonth(refDate);
  const periodEnd = endOfMonth(refDate);
  const isCurrentMonth = format(refDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const periodoLabel = format(refDate, 'MMMM yyyy', { locale: ptBR });

  // Entradas do período
  const entradas = useMemo(
    () => getMonthlyIncomeByPaidAt(payments, periodStart, periodEnd),
    [payments, periodStart, periodEnd]
  );

  // Planos mais vendidos no período (novos clientes com start_date no período)
  const planosVendidos = useMemo(() => {
    const novosNoPeríodo = clients.filter(c => {
      const d = parseISO(c.start_date);
      return isWithinInterval(d, { start: periodStart, end: periodEnd });
    });
    const map: Record<string, number> = {};
    novosNoPeríodo.forEach(c => {
      map[c.plan_duration] = (map[c.plan_duration] || 0) + 1;
    });
    return Object.entries(map)
      .map(([key, count]) => ({ label: PLAN_LABELS[key] ?? key, count, key }))
      .sort((a, b) => b.count - a.count);
  }, [clients, periodStart, periodEnd]);

  // Evolução dos últimos 6 meses
  const evolucao = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(refDate), 5),
      end: endOfMonth(refDate),
    });
    return months.map(m => {
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      const inc = getMonthlyIncomeByPaidAt(payments, mStart, mEnd);
      const planos = clients.filter(c => {
        const d = parseISO(c.start_date);
        return isWithinInterval(d, { start: mStart, end: mEnd });
      }).length;
      return {
        mes: format(m, 'MMM', { locale: ptBR }),
        entradas: inc,
        planos,
      };
    });
  }, [payments, clients, refDate]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Saúde Financeira
          </h2>
          <p className="text-xs text-muted-foreground">Entradas e planos vendidos no período</p>
        </div>
        {/* Period navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setRefDate(d => subMonths(d, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground capitalize min-w-[120px] text-center">
            {periodoLabel}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={isCurrentMonth}
            onClick={() => setRefDate(d => addMonths(d, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card className="border-green-500/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Entradas do período</p>
            <p className="text-xl font-bold text-green-400">{fmt(entradas)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">pagamentos confirmados</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Novos planos</p>
            <p className="text-xl font-bold text-foreground">
              {planosVendidos.reduce((s, p) => s + p.count, 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">iniciados no período</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 sm:block hidden">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Plano mais vendido</p>
            {planosVendidos[0] ? (
              <>
                <p className="text-sm font-bold text-foreground">{planosVendidos[0].label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{planosVendidos[0].count}x no período</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plans sold breakdown */}
      {planosVendidos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users2 className="h-3.5 w-3.5" />
              Planos vendidos no período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {planosVendidos.map(p => (
                <div key={p.key} className="flex items-center gap-1.5 bg-muted/30 rounded-lg px-3 py-1.5 border border-border/50">
                  <Badge variant="outline" className="text-[10px] py-0 h-4">{p.count}x</Badge>
                  <span className="text-xs text-foreground">{p.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evolution charts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Evolução de Entradas (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={evolucao} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Planos Vendidos / Renovados (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={evolucao} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} />
                <Line type="monotone" dataKey="planos" name="Planos" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          variant="link"
          size="sm"
          className="text-xs text-muted-foreground p-0 h-auto"
          onClick={() => navigate('/financial')}
        >
          Ver financeiro completo →
        </Button>
      </div>
    </div>
  );
}
