import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useClients, usePayments, type Client, type Payment } from '@/hooks/useClients';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  parseISO, differenceInMonths, differenceInDays, format,
  subMonths, startOfMonth, endOfMonth, isWithinInterval, addMonths, min as dateMin, max as dateMax,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, AreaChart, Area
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Repeat, Calendar,
  Trophy, Target, Sparkles, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const brl = (n: number) =>
  `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

type EnrichedClient = Client & {
  client_name?: string;
  payments: Payment[];
  ltv: number;
  planPeriods: number;     // 1 (atual) + nº de planos arquivados em history
  renewals: number;        // = history rows (renovações reais, não parcelas)
  monthsActive: number;
  firstStartDate: Date | null;
  lastPaymentDate: string | null;
  isChurned: boolean;
};

type PlanHistoryRow = {
  id: string;
  client_id: string;
  start_date: string | null;
  end_date: string | null;
  monthly_value: number | null;
  plan_type: string | null;
  renewed_at: string | null;
};

function usePlanHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['client_plan_history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_plan_history')
        .select('id, client_id, start_date, end_date, monthly_value, plan_type, renewed_at');
      if (error) throw error;
      return (data || []) as PlanHistoryRow[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

const ChartTooltip = ({ active, payload, label, currency = true }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2.5 shadow-lg text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} style={{ color: e.color }}>
          {e.name}: {currency ? brl(e.value) : `${Number(e.value).toFixed(1)}%`}
        </p>
      ))}
    </div>
  );
};

function KpiCard({
  title, value, subtitle, icon, trend,
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ReactNode; trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="text-muted-foreground">{icon}</div>
          {trend && (
            <Badge variant={trend.positive ? 'default' : 'destructive'} className="gap-1 text-[10px] h-5">
              {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend.value).toFixed(1)}%
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{title}</p>
        <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export function LtvDashboard() {
  const { data: clients = [] } = useClients();
  const { data: payments = [] } = usePayments();

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'ltv' | 'name' | 'renewals' | 'time'>('ltv');

  // Build per-client enrichment
  const enriched: EnrichedClient[] = useMemo(() => {
    const byClient = new Map<string, Payment[]>();
    for (const p of payments) {
      if (p.status !== 'paid' || !p.paid_at) continue;
      const arr = byClient.get(p.client_id) || [];
      arr.push(p);
      byClient.set(p.client_id, arr);
    }
    return clients.map((c) => {
      const cp = (byClient.get(c.id) || []).sort(
        (a, b) => +parseISO(a.paid_at!) - +parseISO(b.paid_at!),
      );
      const ltv = cp.reduce((s, p) => s + Number(p.amount || 0), 0);
      const renewals = Math.max(0, cp.length - 1);
      const lastPaymentDate = cp.length ? cp[cp.length - 1].paid_at : null;
      const startRef = c.start_date ? parseISO(c.start_date) : (cp[0] ? parseISO(cp[0].paid_at!) : null);
      const endRef = c.is_active
        ? new Date()
        : (lastPaymentDate ? parseISO(lastPaymentDate) : (c.end_date ? parseISO(c.end_date) : new Date()));
      const monthsActive = startRef ? Math.max(0, differenceInMonths(endRef, startRef)) : 0;
      return {
        ...c,
        payments: cp,
        ltv,
        renewals,
        monthsActive,
        lastPaymentDate,
        isChurned: !c.is_active,
      };
    });
  }, [clients, payments]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const withPay = enriched.filter((c) => c.payments.length > 0);
    const totalLtv = withPay.reduce((s, c) => s + c.ltv, 0);
    const avgLtv = withPay.length ? totalLtv / withPay.length : 0;

    const paidPayments = payments.filter((p) => p.status === 'paid' && p.paid_at);
    const totalRevenue = paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const ticketMedio = paidPayments.length ? totalRevenue / paidPayments.length : 0;

    const cutoff30 = subMonths(new Date(), 1);
    const last30 = paidPayments.filter((p) => parseISO(p.paid_at!) >= cutoff30);
    const ticket30 = last30.length ? last30.reduce((s, p) => s + Number(p.amount), 0) / last30.length : 0;

    const activeClients = enriched.filter((c) => c.is_active && !c.is_frozen);
    const mrr = activeClients.reduce((s, c) => s + Number(c.monthly_value || 0), 0);
    const revenuePerActive = activeClients.length ? totalRevenue / activeClients.length : 0;

    const renewedClients = enriched.filter((c) => c.renewals >= 1);
    const churned = enriched.filter((c) => c.isChurned && c.payments.length > 0);
    const renewalRate = withPay.length ? (renewedClients.length / withPay.length) * 100 : 0;
    const churnRate = withPay.length ? (churned.length / withPay.length) * 100 : 0;
    const avgTenure = withPay.length ? withPay.reduce((s, c) => s + c.monthsActive, 0) / withPay.length : 0;
    const avgRenewals = withPay.length ? withPay.reduce((s, c) => s + c.renewals, 0) / withPay.length : 0;

    return {
      avgLtv, ticketMedio, ticket30, mrr, totalRevenue, revenuePerActive,
      renewalRate, churnRate, avgTenure, avgRenewals,
      activeCount: activeClients.length, renewedCount: renewedClients.length,
      churnedCount: churned.length,
    };
  }, [enriched, payments]);

  // Time series: last 12 months
  const monthly = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; start: Date; end: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = subMonths(now, i);
      months.push({
        key: format(m, 'yyyy-MM'),
        label: format(m, 'MMM/yy', { locale: ptBR }),
        start: startOfMonth(m),
        end: endOfMonth(m),
      });
    }
    return months.map((m) => {
      const monthPayments = payments.filter(
        (p) => p.status === 'paid' && p.paid_at &&
          isWithinInterval(parseISO(p.paid_at), { start: m.start, end: m.end }),
      );
      const revenue = monthPayments.reduce((s, p) => s + Number(p.amount), 0);
      const ticket = monthPayments.length ? revenue / monthPayments.length : 0;
      const uniqueClients = new Set(monthPayments.map((p) => p.client_id));
      const ltv = uniqueClients.size ? revenue / uniqueClients.size : 0;

      // retention: clients active during this month
      const activeInMonth = enriched.filter((c) => {
        const start = c.start_date ? parseISO(c.start_date) : null;
        const end = c.is_active ? new Date() : (c.end_date ? parseISO(c.end_date) : null);
        if (!start || !end) return false;
        return start <= m.end && end >= m.start;
      });
      const renewedInMonth = monthPayments.filter((p) => {
        const c = enriched.find((x) => x.id === p.client_id);
        return c && c.renewals >= 1;
      });
      const retention = activeInMonth.length
        ? (renewedInMonth.length / activeInMonth.length) * 100
        : 0;
      return {
        month: m.label, key: m.key,
        ltv: Math.round(ltv), ticket: Math.round(ticket), revenue: Math.round(revenue),
        retention: Math.round(retention),
      };
    });
  }, [payments, enriched]);

  // Insights
  const insights = useMemo(() => {
    const out: { type: 'positive' | 'warning' | 'info'; text: string }[] = [];

    const last3 = monthly.slice(-3);
    const prev3 = monthly.slice(-6, -3);
    const avg = (arr: { ticket: number }[]) => arr.length ? arr.reduce((s, x) => s + x.ticket, 0) / arr.length : 0;
    const a = avg(last3), b = avg(prev3);
    if (b > 0) {
      const delta = ((a - b) / b) * 100;
      if (Math.abs(delta) > 3) {
        out.push({
          type: delta > 0 ? 'positive' : 'warning',
          text: `O ticket médio ${delta > 0 ? 'aumentou' : 'caiu'} ${Math.abs(delta).toFixed(1)}% nos últimos 90 dias.`,
        });
      }
    }

    // LTV por plano
    const groups: Record<string, number[]> = {};
    enriched.filter((c) => c.payments.length).forEach((c) => {
      const k = c.plan_type || 'sem_plano';
      if (!groups[k]) groups[k] = [];
      groups[k].push(c.ltv);
    });
    const avgs = Object.entries(groups).map(([k, vs]) => ({
      plan: k, avg: vs.reduce((s, x) => s + x, 0) / vs.length,
    })).sort((x, y) => y.avg - x.avg);
    if (avgs.length >= 2 && avgs[1].avg > 0) {
      const ratio = avgs[0].avg / avgs[1].avg;
      if (ratio > 1.2) {
        out.push({
          type: 'info',
          text: `Pacientes do plano ${avgs[0].plan} têm LTV ${ratio.toFixed(1)}x maior que o plano ${avgs[1].plan}.`,
        });
      }
    }

    // retention by tenure
    const longTenure = enriched.filter((c) => c.monthsActive >= 3 && c.payments.length);
    const longRenewed = longTenure.filter((c) => c.renewals >= 1);
    if (longTenure.length) {
      const r = (longRenewed.length / longTenure.length) * 100;
      out.push({
        type: 'info',
        text: `Pacientes com mais de 90 dias têm taxa de renovação de ${r.toFixed(0)}%.`,
      });
    }

    if (kpis.churnRate > 30) {
      out.push({ type: 'warning', text: `Taxa de cancelamento alta (${kpis.churnRate.toFixed(1)}%). Considere ações de retenção.` });
    }
    return out;
  }, [monthly, enriched, kpis]);

  // Cohort: rows = month of entry (last 12), cols = month offsets
  const cohort = useMemo(() => {
    const now = new Date();
    const cohortMonths: Date[] = [];
    for (let i = 11; i >= 0; i--) cohortMonths.push(startOfMonth(subMonths(now, i)));

    return cohortMonths.map((cm) => {
      const cohortClients = enriched.filter((c) => {
        if (!c.start_date) return false;
        const s = parseISO(c.start_date);
        return s >= cm && s <= endOfMonth(cm);
      });
      const size = cohortClients.length;
      const offsets = [0, 1, 2, 3, 6, 12];
      const cells = offsets.map((off) => {
        const target = addMonths(cm, off);
        if (target > now) return null;
        if (!size) return 0;
        const stillActive = cohortClients.filter((c) => {
          const end = c.is_active ? new Date() : (c.end_date ? parseISO(c.end_date) : null);
          return end && end >= target;
        }).length;
        return Math.round((stillActive / size) * 100);
      });
      return { label: format(cm, 'MMM/yy', { locale: ptBR }), size, cells };
    });
  }, [enriched]);

  // Forecast next 12 months
  const forecast = useMemo(() => {
    const now = new Date();
    const baseMrr = kpis.mrr;
    const churn = (kpis.churnRate || 0) / 100;
    const months = [];
    let conservative = baseMrr, likely = baseMrr, optimistic = baseMrr;
    for (let i = 1; i <= 12; i++) {
      const m = addMonths(now, i);
      conservative = conservative * (1 - churn * 1.3);
      likely = likely * (1 - churn) * 1.02;
      optimistic = optimistic * (1 - churn * 0.7) * 1.05;
      months.push({
        month: format(m, 'MMM/yy', { locale: ptBR }),
        conservador: Math.round(conservative),
        provavel: Math.round(likely),
        otimista: Math.round(optimistic),
      });
    }
    return months;
  }, [kpis]);

  // Goals (localStorage)
  const [goals, setGoals] = useState({ ltv: 0, ticket: 0, retention: 0, mrr: 0 });
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ltv_goals');
      if (raw) setGoals(JSON.parse(raw));
    } catch {}
  }, []);
  const saveGoals = (g: typeof goals) => {
    setGoals(g);
    localStorage.setItem('ltv_goals', JSON.stringify(g));
  };

  // Tables
  const filtered = useMemo(() => {
    let arr = enriched.filter((c) => c.payments.length > 0);
    if (search) arr = arr.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    if (planFilter !== 'all') arr = arr.filter((c) => c.plan_type === planFilter);
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'renewals': return b.renewals - a.renewals;
        case 'time': return b.monthsActive - a.monthsActive;
        default: return b.ltv - a.ltv;
      }
    });
    return arr;
  }, [enriched, search, planFilter, sortBy]);

  const topRevenue = useMemo(() => [...filtered].sort((a, b) => b.ltv - a.ltv).slice(0, 10), [filtered]);
  const topLoyal = useMemo(
    () => [...enriched.filter((c) => c.payments.length)]
      .sort((a, b) => (b.renewals - a.renewals) || (b.monthsActive - a.monthsActive)).slice(0, 10),
    [enriched],
  );

  const cohortColor = (v: number | null) => {
    if (v == null) return 'bg-muted/20 text-muted-foreground';
    if (v >= 80) return 'bg-green-500/20 text-green-300';
    if (v >= 60) return 'bg-emerald-500/15 text-emerald-300';
    if (v >= 40) return 'bg-yellow-500/15 text-yellow-300';
    if (v >= 20) return 'bg-orange-500/15 text-orange-300';
    return 'bg-red-500/20 text-red-300';
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Receita e LTV</h3>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard title="LTV médio" value={brl(kpis.avgLtv)} icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard title="Ticket médio" value={brl(kpis.ticketMedio)} icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard title="Ticket (30d)" value={brl(kpis.ticket30)} icon={<TrendingUp className="h-4 w-4" />} />
          <KpiCard title="MRR" value={brl(kpis.mrr)} subtitle="receita recorrente" icon={<Repeat className="h-4 w-4" />} />
          <KpiCard title="Receita total" value={brl(kpis.totalRevenue)} icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard title="Receita / ativo" value={brl(kpis.revenuePerActive)} icon={<Users className="h-4 w-4" />} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Retenção</h3>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard title="Taxa de renovação" value={pct(kpis.renewalRate)} icon={<Repeat className="h-4 w-4" />} />
          <KpiCard title="Taxa de cancelamento" value={pct(kpis.churnRate)} icon={<TrendingDown className="h-4 w-4" />} />
          <KpiCard title="Permanência média" value={`${kpis.avgTenure.toFixed(1)} meses`} icon={<Calendar className="h-4 w-4" />} />
          <KpiCard title="Renovações / paciente" value={kpis.avgRenewals.toFixed(2)} icon={<Repeat className="h-4 w-4" />} />
          <KpiCard title="Pacientes ativos" value={String(kpis.activeCount)} icon={<Users className="h-4 w-4" />} />
          <KpiCard title="Já renovaram" value={String(kpis.renewedCount)} subtitle="ao menos 1x" icon={<Trophy className="h-4 w-4" />} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução do LTV (mensal)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="ltv" name="LTV" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ticket médio mensal</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="ticket" name="Ticket" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Curva de retenção (%)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip content={<ChartTooltip currency={false} />} />
                <Line type="monotone" dataKey="retention" name="Retenção" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Previsão de receita (12 meses)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="conservador" stroke="hsl(var(--destructive))" dot={false} />
                <Line type="monotone" dataKey="provavel" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="otimista" stroke="hsl(142 71% 45%)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Insights automáticos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {insights.length === 0 && (
            <p className="text-xs text-muted-foreground">Sem dados suficientes para gerar insights.</p>
          )}
          {insights.map((i, idx) => (
            <div key={idx} className={`text-xs p-2.5 rounded-lg border ${
              i.type === 'positive' ? 'border-green-500/30 bg-green-500/5 text-green-300' :
              i.type === 'warning' ? 'border-red-500/30 bg-red-500/5 text-red-300' :
              'border-border bg-muted/30 text-foreground'
            }`}>{i.text}</div>
          ))}
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Metas de crescimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { key: 'ltv', label: 'LTV médio', current: kpis.avgLtv, fmt: brl },
              { key: 'ticket', label: 'Ticket médio', current: kpis.ticketMedio, fmt: brl },
              { key: 'retention', label: 'Retenção (%)', current: kpis.renewalRate, fmt: (n: number) => `${n.toFixed(1)}%` },
              { key: 'mrr', label: 'MRR', current: kpis.mrr, fmt: brl },
            ].map((g) => {
              const goal = (goals as any)[g.key] || 0;
              const reached = goal > 0 ? Math.min(100, (g.current / goal) * 100) : 0;
              return (
                <div key={g.key} className="space-y-2">
                  <Label className="text-xs">{g.label}</Label>
                  <Input
                    type="number" value={goal || ''}
                    placeholder="Meta"
                    onChange={(e) => saveGoals({ ...goals, [g.key]: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Atual: <span className="text-foreground">{g.fmt(g.current)}</span>
                    {goal > 0 && <> · {reached.toFixed(0)}% da meta</>}
                  </div>
                  {goal > 0 && <Progress value={reached} className="h-1.5" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cohort */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cohort de retenção</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-1">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium px-2">Entrada</th>
                  <th className="font-medium">Nº</th>
                  {['M0', 'M1', 'M2', 'M3', 'M6', 'M12'].map((m) => (
                    <th key={m} className="font-medium">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohort.map((row) => (
                  <tr key={row.label}>
                    <td className="px-2 text-foreground">{row.label}</td>
                    <td className="text-center text-muted-foreground">{row.size}</td>
                    {row.cells.map((v, i) => (
                      <td key={i} className={`text-center px-2 py-1 rounded ${cohortColor(v)}`}>
                        {v == null ? '—' : `${v}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Rankings */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-400" /> Top 10 por receita</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Renov.</TableHead>
                  <TableHead className="text-right">Meses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topRevenue.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{brl(c.ltv)}</TableCell>
                    <TableCell className="text-right">{c.renewals}</TableCell>
                    <TableCell className="text-right">{c.monthsActive}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Top 10 mais fiéis</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="text-right">Renov.</TableHead>
                  <TableHead className="text-right">Meses</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLoyal.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{c.renewals}</TableCell>
                    <TableCell className="text-right">{c.monthsActive}</TableCell>
                    <TableCell className="text-right">{brl(c.ltv)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Individual analysis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Análise individual de pacientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <Input
              placeholder="Buscar por nome..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-sm sm:max-w-xs"
            />
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="h-9 text-sm sm:w-44"><SelectValue placeholder="Plano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="consultoria">Consultoria</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-9 text-sm sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ltv">Ordenar por LTV</SelectItem>
                <SelectItem value="renewals">Ordenar por renovações</SelectItem>
                <SelectItem value="time">Ordenar por tempo</SelectItem>
                <SelectItem value="name">Ordenar por nome</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Mensal</TableHead>
                  <TableHead className="text-right">Renov.</TableHead>
                  <TableHead className="text-right">Meses</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                  <TableHead>Última pgto</TableHead>
                  <TableHead>Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.start_date ? format(parseISO(c.start_date), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.plan_type}</Badge></TableCell>
                    <TableCell className="text-right">{brl(c.monthly_value || 0)}</TableCell>
                    <TableCell className="text-right">{c.renewals}</TableCell>
                    <TableCell className="text-right">{c.monthsActive}</TableCell>
                    <TableCell className="text-right font-semibold">{brl(c.ltv)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastPaymentDate ? format(parseISO(c.lastPaymentDate), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.end_date ? format(parseISO(c.end_date), 'dd/MM/yy') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground text-xs py-6">Nenhum paciente encontrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
