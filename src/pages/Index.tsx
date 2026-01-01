import { Layout } from '@/components/layout/Layout';
import { StatCard } from '@/components/dashboard/StatCard';
import { ExpiringClientsAlert } from '@/components/dashboard/ExpiringClientsAlert';
import { ConsultationCalendar } from '@/components/dashboard/ConsultationCalendar';
import { useClients, usePayments, useConsultationSchedules, getExpiringThisMonth, getMonthlyIncome } from '@/hooks/useClients';
import { Users, DollarSign, AlertTriangle, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const { data: consultations = [], isLoading: consultationsLoading } = useConsultationSchedules();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const activeClients = clients.filter(c => c.is_active);
  const expiringThisMonth = getExpiringThisMonth(clients, currentYear, currentMonth);
  const monthlyIncome = getMonthlyIncome(payments, currentYear, currentMonth);
  

  const isLoading = clientsLoading || paymentsLoading || consultationsLoading;

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
      <div className="space-y-6 lg:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">RF Assessoria Esportiva - Visão geral</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Atletas Ativos"
            value={activeClients.length}
            subtitle="cadastrados"
            icon={<Users className="h-6 w-6" />}
            variant="primary"
          />
          <StatCard
            title="Entradas do Mês"
            value={`R$ ${monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="recebido"
            icon={<DollarSign className="h-6 w-6" />}
            variant="success"
          />
          <StatCard
            title="Vencimentos do Mês"
            value={expiringThisMonth.length}
            subtitle="planos"
            icon={<AlertTriangle className="h-6 w-6" />}
            variant="warning"
          />
        </div>

        {/* Alerts & Calendar */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          <ExpiringClientsAlert clients={expiringThisMonth} />
          <ConsultationCalendar consultations={consultations} clients={activeClients} />
        </div>
      </div>
    </Layout>
  );
}