import { Layout } from '@/components/layout/Layout';
import { StatCard } from '@/components/dashboard/StatCard';
import { ExpiringClientsAlert } from '@/components/dashboard/ExpiringClientsAlert';
import { UpcomingPayments } from '@/components/financial/UpcomingPayments';
import { useClients, usePayments, getExpiringClients, getUpcomingPayments, getTotalMonthlyRecurring } from '@/hooks/useClients';
import { Users, DollarSign, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();

  const activeClients = clients.filter(c => c.is_active);
  const expiringClients = getExpiringClients(clients, 30);
  const upcomingPayments = getUpcomingPayments(payments, 30);
  const monthlyRecurring = getTotalMonthlyRecurring(clients);

  const isLoading = clientsLoading || paymentsLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Visão geral da sua consultoria</p>
        </div>

        {/* Stats */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Atletas Ativos"
            value={activeClients.length}
            subtitle="cadastrados"
            icon={<Users className="h-6 w-6" />}
            variant="primary"
          />
          <StatCard
            title="Receita Mensal"
            value={`R$ ${monthlyRecurring.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="recorrente"
            icon={<DollarSign className="h-6 w-6" />}
            variant="success"
          />
          <StatCard
            title="Vencendo em 30 dias"
            value={expiringClients.length}
            subtitle="planos"
            icon={<AlertTriangle className="h-6 w-6" />}
            variant="warning"
          />
          <StatCard
            title="A Receber"
            value={`R$ ${upcomingPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="próximos 30 dias"
            icon={<TrendingUp className="h-6 w-6" />}
            variant="default"
          />
        </div>

        {/* Alerts & Upcoming */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ExpiringClientsAlert clients={expiringClients} />
          <UpcomingPayments payments={upcomingPayments} />
        </div>
      </div>
    </Layout>
  );
}
