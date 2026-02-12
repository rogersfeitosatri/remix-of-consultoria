import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFinancialTransactions, normalizeArea } from '@/hooks/useFinancialTransactions';
import { usePayments } from '@/hooks/useClients';
import { parseISO, isWithinInterval, format, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

interface ManagementChartsProps {
  filterStartDate: Date;
  filterEndDate: Date;
}

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16'];

export function ManagementCharts({ filterStartDate, filterEndDate }: ManagementChartsProps) {
  const { data: transactions = [] } = useFinancialTransactions();
  const { data: athletePayments = [] } = usePayments();

  // Category distribution (expenses only in period)
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => {
        if (t.type !== 'expense') return false;
        const d = parseISO(t.date);
        return isWithinInterval(d, { start: filterStartDate, end: filterEndDate });
      })
      .forEach(t => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, filterStartDate, filterEndDate]);

  // Daily cash flow for the period
  const dailyFlowData = useMemo(() => {
    const days = eachDayOfInterval({ start: filterStartDate, end: filterEndDate });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'dd/MM');

      const income = transactions
        .filter(t => t.type === 'income' && t.date === dayStr)
        .reduce((s, t) => s + Number(t.amount), 0);

      const athleteInc = athletePayments
        .filter(p => p.status === 'paid' && p.paid_at && p.paid_at.startsWith(dayStr))
        .reduce((s, p) => s + Number(p.amount), 0);

      const expense = transactions
        .filter(t => t.type === 'expense' && t.date === dayStr)
        .reduce((s, t) => s + Number(t.amount), 0);

      return { name: dayLabel, entradas: income + athleteInc, saidas: expense };
    });
  }, [transactions, athletePayments, filterStartDate, filterEndDate]);

  // Monthly evolution (last 6 months)
  const monthlyEvolution = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(filterEndDate), 5),
      end: endOfMonth(filterEndDate),
    });

    return months.map(m => {
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);

      const income = transactions
        .filter(t => t.type === 'income' && isWithinInterval(parseISO(t.date), { start: mStart, end: mEnd }))
        .reduce((s, t) => s + Number(t.amount), 0);

      const athleteInc = athletePayments
        .filter(p => p.status === 'paid' && p.paid_at && isWithinInterval(parseISO(p.paid_at), { start: mStart, end: mEnd }))
        .reduce((s, p) => s + Number(p.amount), 0);

      const expense = transactions
        .filter(t => t.type === 'expense' && isWithinInterval(parseISO(t.date), { start: mStart, end: mEnd }))
        .reduce((s, t) => s + Number(t.amount), 0);

      return {
        name: format(m, 'MMM/yy', { locale: ptBR }),
        entradas: income + athleteInc,
        saidas: expense,
        resultado: income + athleteInc - expense,
      };
    });
  }, [transactions, athletePayments, filterEndDate]);

  // PF vs Empresa comparison
  const areaComparison = useMemo(() => {
    const periodTxns = transactions.filter(t => isWithinInterval(parseISO(t.date), { start: filterStartDate, end: filterEndDate }));

    const athleteIncome = athletePayments
      .filter(p => p.status === 'paid' && p.paid_at && isWithinInterval(parseISO(p.paid_at), { start: filterStartDate, end: filterEndDate }))
      .reduce((s, p) => s + Number(p.amount), 0);

    return [
      {
        name: 'Pessoa Física',
        entradas: periodTxns.filter(t => t.type === 'income' && normalizeArea(t.area) === 'pessoal').reduce((s, t) => s + Number(t.amount), 0),
        saidas: periodTxns.filter(t => t.type === 'expense' && normalizeArea(t.area) === 'pessoal').reduce((s, t) => s + Number(t.amount), 0),
      },
      {
        name: 'Empresa',
        entradas: periodTxns.filter(t => t.type === 'income' && normalizeArea(t.area) === 'empresa').reduce((s, t) => s + Number(t.amount), 0) + athleteIncome,
        saidas: periodTxns.filter(t => t.type === 'expense' && normalizeArea(t.area) === 'empresa').reduce((s, t) => s + Number(t.amount), 0),
      },
    ];
  }, [transactions, athletePayments, filterStartDate, filterEndDate]);

  const hasData = transactions.length > 0 || athletePayments.some(p => p.status === 'paid');

  if (!hasData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Registre lançamentos para visualizar os gráficos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      {/* Category distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Distribuição por Categoria (Gastos)</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem gastos no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* PF vs Empresa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">PF vs Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={areaComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily cash flow */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Fluxo Diário</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[2, 2, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly evolution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Evolução Mensal (6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="resultado" name="Resultado" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
