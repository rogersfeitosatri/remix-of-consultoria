import { Layout } from '@/components/layout/Layout';
import { StatCard } from '@/components/dashboard/StatCard';
import { GoogleOAuthAlert } from '@/components/dashboard/GoogleOAuthAlert';
import { ActionCenterPanel } from '@/components/dashboard/ActionCenterPanel';
import { DietAdjustmentAlert } from '@/components/dashboard/DietAdjustmentAlert';
import { PeriodizationOverview } from '@/components/dashboard/PeriodizationOverview';
import { WeeklyReportPanel } from '@/components/dashboard/WeeklyReportPanel';
import { useClients, usePayments, getExpiringThisMonth } from '@/hooks/useClients';
import { getMonthlyIncomeByPaidAt, getDueAmountInPeriod } from '@/hooks/useFinancialData';
import { Users, DollarSign, AlertTriangle, Loader2, CreditCard } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const activeClients = clients.filter(c => c.is_active);
  const expiringThisMonth = getExpiringThisMonth(clients, currentYear, currentMonth);
  
  const monthlyIncome = useMemo(() => 
    getMonthlyIncomeByPaidAt(payments, monthStart, monthEnd),
    [payments, monthStart, monthEnd]
  );
  
  const monthlyDue = useMemo(() =>
    getDueAmountInPeriod(payments, monthStart, monthEnd),
    [payments, monthStart, monthEnd]
  );

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
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Visão geral e ações do dia</p>
          </div>
          <GoogleOAuthAlert />
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Atletas Ativos"
            value={activeClients.length}
            subtitle="cadastrados"
            icon={<Users className="h-5 w-5 sm:h-6 sm:w-6" />}
            variant="primary"
          />
          <button 
            onClick={() => navigate('/financial')}
            className="text-left transition-transform hover:scale-[1.02]"
          >
            <StatCard
              title="Entradas do Mês"
              value={`R$ ${monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              subtitle="recebido"
              icon={<DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />}
              variant="success"
            />
          </button>
          <button 
            onClick={() => navigate('/financial?filter=upcoming')}
            className="text-left transition-transform hover:scale-[1.02]"
          >
            <StatCard
              title="Vencimentos"
              value={`R$ ${monthlyDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              subtitle="pendentes"
              icon={<CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />}
              variant="warning"
            />
          </button>
          <StatCard
            title="Planos Vencendo"
            value={expiringThisMonth.length}
            subtitle="no mês"
            icon={<AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />}
            variant="default"
          />
        </div>

        {/* Action Center — replaces all scattered alerts */}
        <ActionCenterPanel />

        {/* Diet Adjustments — stays separate (has its own complex grouping) */}
        <DietAdjustmentAlert />

        {/* Weekly Report + Periodization */}
        <div className="grid gap-4 lg:grid-cols-2">
          <WeeklyReportPanel />
          <PeriodizationOverview />
        </div>
      </div>
    </Layout>
  );
}
