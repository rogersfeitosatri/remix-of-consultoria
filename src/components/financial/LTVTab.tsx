import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/dashboard/StatCard';
import { useClients, usePayments } from '@/hooks/useClients';
import {
  buildClientLTVData,
  calculateLTVSummary,
  PLAN_DURATION_LABELS,
  SERVICE_TYPE_LABELS,
  PLAN_TYPE_LABELS,
} from '@/lib/ltv';
import { TrendingUp, Users, DollarSign, Target, HelpCircle, Trophy } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4'];

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {fmt(Number(entry.value))}
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
      <p className="text-sm text-primary font-semibold">{fmt(Number(payload[0].value))}</p>
    </div>
  );
};

export function LTVTab() {
  const { data: clients = [] } = useClients();
  const { data: payments = [] } = usePayments();

  const summary = useMemo(() => calculateLTVSummary(clients, payments), [clients, payments]);
  const clientsData = useMemo(() => buildClientLTVData(clients, payments), [clients, payments]);

  if (clientsData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Users className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Nenhum cliente ativo para calcular o LTV</p>
      </div>
    );
  }

  const top10 = clientsData.slice(0, 10).map(c => ({
    name: c.name.split(' ')[0],
    fullName: c.name,
    ltv: c.ltv,
  }));

  return (
    <div className="space-y-6">
      {/* What is LTV - explanation for laypeople */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex gap-3 items-start">
            <HelpCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">O que é LTV?</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">LTV (Lifetime Value — Valor do Cliente)</strong> é o valor total
                que um cliente paga durante todo o período do plano contratado.{' '}
                <span className="text-foreground">Exemplo:</span> um cliente que paga R$&nbsp;500/mês em um plano
                trimestral tem LTV de R$&nbsp;1.500. Acompanhar o LTV ajuda a entender quanto
                cada cliente vale para o negócio e a priorizar renovações.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hero stat cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="LTV Total da Carteira"
          value={fmt(summary.totalLTV)}
          subtitle="valor somado de todos os planos ativos"
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="primary"
        />
        <StatCard
          title="LTV Médio por Cliente"
          value={fmt(summary.averageLTV)}
          subtitle="valor médio de cada plano"
          icon={<Target className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="success"
        />
        <StatCard
          title="Ticket Mensal (MRR)"
          value={fmt(summary.mrr)}
          subtitle="receita mensal recorrente total"
          icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="default"
        />
        <StatCard
          title="Clientes Ativos"
          value={summary.activeClientsCount}
          subtitle="com plano em vigor"
          icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="default"
        />
      </div>

      {/* Realization progress */}
      <Card className="border-green-500/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Receita Realizada vs LTV Projetado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quanto do valor total dos planos já foi efetivamente recebido
              </p>
            </div>
            <Badge variant="outline" className="text-green-400 border-green-500/30 text-xs">
              {summary.overallRealizationRate.toFixed(1)}% realizado
            </Badge>
          </div>
          <Progress value={summary.overallRealizationRate} className="h-3" />
          <div className="flex flex-wrap justify-between mt-2 gap-2 text-xs text-muted-foreground">
            <span>Recebido: <strong className="text-green-400">{fmt(summary.totalRealized)}</strong></span>
            <span>Projetado total: <strong className="text-foreground">{fmt(summary.totalLTV)}</strong></span>
          </div>
          {summary.totalLTV > summary.totalRealized && (
            <p className="text-xs text-muted-foreground mt-1.5 border-t border-border/50 pt-1.5">
              Ainda a receber dos planos ativos:{' '}
              <strong className="text-foreground">{fmt(summary.totalLTV - summary.totalRealized)}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* By Plan Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">LTV por Tipo de Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.byPlanType} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="ltv" name="LTV Total" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-3">
              {summary.byPlanType.map((p, i) => (
                <div key={p.key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">
                    {p.name}: {p.count} {p.count === 1 ? 'cliente' : 'clientes'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Service Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">LTV por Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={summary.byServiceType}
                  dataKey="ltv"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {summary.byServiceType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-3 justify-center">
              {summary.byServiceType.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">{s.name}: {fmt(s.ltv)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Duration - summary cards */}
      {summary.byDuration.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">LTV por Duração de Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {summary.byDuration.map((d) => (
                <div key={d.key} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-0.5">
                  <p className="text-xs text-muted-foreground">{d.name}</p>
                  <p className="text-sm font-bold text-foreground">{fmt(d.ltv)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {d.count} {d.count === 1 ? 'cliente' : 'clientes'}
                  </p>
                  <p className="text-[10px] text-primary">Média: {fmt(d.avgLTV)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top clients chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <CardTitle className="text-sm text-foreground">
              Top {top10.length} Clientes por LTV
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(220, top10.length * 38)}>
            <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                width={72}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const item = top10.find(t => t.name === label);
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                      <p className="text-sm font-medium text-foreground">{item?.fullName ?? label}</p>
                      <p className="text-sm text-green-400 font-semibold">LTV: {fmt(Number(payload[0].value))}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="ltv" name="LTV" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Clients table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-foreground">Detalhamento por Cliente</CardTitle>
            <span className="text-xs text-muted-foreground">{clientsData.length} clientes ativos</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium hidden sm:table-cell">Plano</th>
                  <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Mensalidade</th>
                  <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">LTV</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium hidden md:table-cell">Realização</th>
                </tr>
              </thead>
              <tbody>
                {clientsData.map((client, i) => (
                  <tr
                    key={client.id}
                    className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                      i % 2 !== 0 ? 'bg-muted/10' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground text-xs">{client.name}</p>
                      <p className="text-[10px] text-muted-foreground">{SERVICE_TYPE_LABELS[client.service_type]}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="text-[10px] w-fit py-0 h-4">
                          {PLAN_TYPE_LABELS[client.plan_type]}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {PLAN_DURATION_LABELS[client.plan_duration]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <p className="text-xs font-medium text-foreground">{fmt(client.monthly_value)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        × {client.duration_months % 1 === 0
                          ? client.duration_months
                          : client.duration_months.toFixed(1)} meses
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <p className="text-xs font-bold text-green-400">{fmt(client.ltv)}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <div className="w-36">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">{client.realizationRate.toFixed(0)}%</span>
                          <span className="text-muted-foreground">{fmt(client.realized)}</span>
                        </div>
                        <Progress value={client.realizationRate} className="h-1.5" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
