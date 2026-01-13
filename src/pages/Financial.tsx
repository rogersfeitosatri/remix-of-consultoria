import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { StatCard } from '@/components/dashboard/StatCard';
import { FinancialCharts } from '@/components/financial/FinancialCharts';
import { FinancialFilters } from '@/components/financial/FinancialFilters';
import { IncomeList } from '@/components/financial/IncomeList';
import { DuePaymentsList } from '@/components/financial/DuePaymentsList';
import { ExpensesSection } from '@/components/financial/ExpensesSection';
import { useClients, usePayments, getOverduePayments } from '@/hooks/useClients';
import { 
  getMonthlyIncomeByPaidAt, 
  getDueAmountInPeriod, 
  getIncomePaymentsInPeriod,
  getDuePaymentsInPeriod,
  getDailyIncomeData,
  getMonthlyIncomeData,
  getDailyDueData,
  getMonthlyDueData
} from '@/hooks/useFinancialData';
import { DollarSign, CreditCard, AlertCircle, Loader2 } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';

export default function Financial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';
  
  const today = new Date();
  
  // Filtros de período
  const [filterStartDate, setFilterStartDate] = useState<Date>(startOfMonth(today));
  const [filterEndDate, setFilterEndDate] = useState<Date>(endOfMonth(today));
  const [filter, setFilter] = useState<'all' | 'overdue' | 'upcoming'>(initialFilter as 'all' | 'overdue' | 'upcoming');
  
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();

  // Cálculos baseados no período filtrado
  const incomeTotal = useMemo(() => 
    getMonthlyIncomeByPaidAt(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  const dueTotal = useMemo(() =>
    getDueAmountInPeriod(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  const incomePayments = useMemo(() =>
    getIncomePaymentsInPeriod(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  const duePayments = useMemo(() =>
    getDuePaymentsInPeriod(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  // Dados para gráficos - agora respeitam o período filtrado
  const dailyIncomeData = useMemo(() =>
    getDailyIncomeData(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  const monthlyIncomeData = useMemo(() =>
    getMonthlyIncomeData(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  const dailyDueData = useMemo(() =>
    getDailyDueData(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  const monthlyDueData = useMemo(() =>
    getMonthlyDueData(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  // Pagamentos em atraso (para o card)
  const overduePayments = getOverduePayments(payments);

  const handleDateChange = (start: Date, end: Date) => {
    setFilterStartDate(start);
    setFilterEndDate(end);
  };

  const isLoading = clientsLoading || paymentsLoading;

  const handleFilterClick = (newFilter: 'overdue' | 'upcoming') => {
    setFilter(newFilter);
    navigate(`/financial?filter=${newFilter}`);
  };

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
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Financeiro</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">Controle de recebimentos e pagamentos</p>
        </div>

        {/* Stats - Mobile: single column, Desktop: 3 columns */}
        <div className="grid gap-3 sm:gap-4 lg:gap-4 grid-cols-1 sm:grid-cols-3">
          <StatCard
            title="Entradas do Período"
            value={`R$ ${incomeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="confirmados"
            icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
            variant="success"
          />
          <button 
            onClick={() => handleFilterClick('upcoming')}
            className="text-left transition-transform hover:scale-[1.02] h-full"
          >
            <StatCard
              title="Vencimentos do Período"
              value={`R$ ${dueTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              subtitle={`${duePayments.filter(p => p.status !== 'paid').length} pendentes`}
              icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
              variant="default"
            />
          </button>
          <button 
            onClick={() => handleFilterClick('overdue')}
            className="text-left transition-transform hover:scale-[1.02] h-full"
          >
            <StatCard
              title="Vencidos"
              value={overduePayments.length}
              subtitle="pendentes"
              icon={<AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
              variant="warning"
            />
          </button>
        </div>

        {/* Filtros de período */}
        <div className="glass-card rounded-xl p-3 sm:p-4">
          <FinancialFilters
            startDate={filterStartDate}
            endDate={filterEndDate}
            onDateChange={handleDateChange}
          />
        </div>

        {/* Gráficos */}
        <FinancialCharts
          dailyIncomeData={dailyIncomeData}
          monthlyIncomeData={monthlyIncomeData}
          dailyDueData={dailyDueData}
          monthlyDueData={monthlyDueData}
        />

        {/* Listas detalhadas */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          <IncomeList payments={incomePayments} title="Entradas Confirmadas" />
          <DuePaymentsList payments={duePayments} title="Vencimentos" />
        </div>

        {/* Despesas */}
        <ExpensesSection />
      </div>
    </Layout>
  );
}
