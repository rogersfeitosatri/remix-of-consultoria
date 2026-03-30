import { Layout } from '@/components/layout/Layout';
import { StatCard } from '@/components/dashboard/StatCard';

import { PendingCheckinsAlert } from '@/components/dashboard/PendingCheckinsAlert';
import { DietAdjustmentAlert } from '@/components/dashboard/DietAdjustmentAlert';
import { GoogleOAuthAlert } from '@/components/dashboard/GoogleOAuthAlert';
import { PendingMealPlansAlert } from '@/components/dashboard/PendingMealPlansAlert';
import { PeriodizationPhaseAlert } from '@/components/dashboard/PeriodizationPhaseAlert';
import { PeriodizationOverview } from '@/components/dashboard/PeriodizationOverview';
import { UnresponsiveAthletesAlert } from '@/components/checkin/UnresponsiveAthletesAlert';
import { MyDayTodayPanel } from '@/components/dashboard/MyDayTodayPanel';
import { InactivityAlertsPanel } from '@/components/dashboard/InactivityAlertsPanel';
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
  
  // Período do mês atual
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const activeClients = clients.filter(c => c.is_active);
  const expiringThisMonth = getExpiringThisMonth(clients, currentYear, currentMonth);
  
  // Entradas do mês: apenas pagamentos com paid_at no mês atual
  const monthlyIncome = useMemo(() => 
    getMonthlyIncomeByPaidAt(payments, monthStart, monthEnd),
    [payments, monthStart, monthEnd]
  );
  
  // Vencimentos do mês: pagamentos com due_date no mês atual (não pagos)
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
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">Rogers Feitosa - Nutrição & Treinamento</p>
          </div>
          <GoogleOAuthAlert />
        </div>

        {/* Stats - Mobile: 2 columns (stacked look), Desktop: 4 columns */}
        <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
              title="Vencimentos do Mês"
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

        {/* My Day Today */}
        <MyDayTodayPanel />

        {/* Alerts Section */}
        <div className="space-y-4">
          <UnresponsiveAthletesAlert />
          <PendingMealPlansAlert />
          <PeriodizationPhaseAlert />
          <PendingCheckinsAlert />
          <DietAdjustmentAlert />
        </div>

        {/* Periodization Control Panel */}
        <PeriodizationOverview />
      </div>
    </Layout>
  );
}
