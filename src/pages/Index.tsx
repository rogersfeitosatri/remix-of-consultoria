import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { StatCard } from '@/components/dashboard/StatCard';
import { ExpiringClientsAlert } from '@/components/dashboard/ExpiringClientsAlert';
import { UpcomingPayments } from '@/components/financial/UpcomingPayments';
import { 
  getClients, 
  getClientsExpiringWithin, 
  getUpcomingPayments,
  getTotalMonthlyRecurring 
} from '@/lib/storage';
import { Client, Payment } from '@/types/client';
import { Users, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [expiringClients, setExpiringClients] = useState<Client[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<Payment[]>([]);
  const [monthlyRecurring, setMonthlyRecurring] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allClients = getClients();
    const activeClients = allClients.filter(c => c.isActive);
    setClients(activeClients);
    setExpiringClients(getClientsExpiringWithin(30));
    setUpcomingPayments(getUpcomingPayments(30));
    setMonthlyRecurring(getTotalMonthlyRecurring());
  };

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
            value={clients.length}
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
