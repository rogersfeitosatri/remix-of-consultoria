import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { StatCard } from '@/components/dashboard/StatCard';
import { FinancialCharts } from '@/components/financial/FinancialCharts';
import { FinancialFilters } from '@/components/financial/FinancialFilters';
import { IncomeList } from '@/components/financial/IncomeList';
import { ExpiringPlansList } from '@/components/financial/ExpiringPlansList';
import { ExpensesSection } from '@/components/financial/ExpensesSection';
import { AddPaymentDialog } from '@/components/financial/AddPaymentDialog';
import { Button } from '@/components/ui/button';
import { useClients, usePayments, getOverduePayments, useAddPayment } from '@/hooks/useClients';
import { 
  getMonthlyIncomeByPaidAt, 
  getIncomePaymentsInPeriod,
  getDailyIncomeData,
  getMonthlyIncomeData,
  getDailyDueData,
  getMonthlyDueData,
  getExpiringPlansInPeriod,
  getExpiringPlansTotal
} from '@/hooks/useFinancialData';
import { DollarSign, CreditCard, AlertCircle, Loader2, Plus } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

export default function Financial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';
  
  const today = new Date();
  
  // Filtros de período
  const [filterStartDate, setFilterStartDate] = useState<Date>(startOfMonth(today));
  const [filterEndDate, setFilterEndDate] = useState<Date>(endOfMonth(today));
  const [filter, setFilter] = useState<'all' | 'overdue' | 'upcoming'>(initialFilter as 'all' | 'overdue' | 'upcoming');
  const [showAddPayment, setShowAddPayment] = useState(false);
  
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const addPaymentMutation = useAddPayment();

  // Cálculos de entradas baseados no período filtrado (data de pagamento - paid_at)
  const incomeTotal = useMemo(() => 
    getMonthlyIncomeByPaidAt(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  const incomePayments = useMemo(() =>
    getIncomePaymentsInPeriod(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  // Cálculos de planos expirando (end_date do cliente)
  const expiringPlans = useMemo(() =>
    getExpiringPlansInPeriod(clients, filterStartDate, filterEndDate),
    [clients, filterStartDate, filterEndDate]
  );
  
  const expiringTotal = useMemo(() =>
    getExpiringPlansTotal(clients, filterStartDate, filterEndDate),
    [clients, filterStartDate, filterEndDate]
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

  const handleAddPayment = async (data: {
    client_id: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    notes?: string;
    plan_start_date?: string;
    plan_end_date?: string;
  }) => {
    try {
      await addPaymentMutation.mutateAsync(data);
      toast.success('Entrada registrada com sucesso!');
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      toast.error('Erro ao registrar entrada');
      throw error;
    }
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
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Financeiro</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">Controle de recebimentos e pagamentos</p>
          </div>
          <Button onClick={() => setShowAddPayment(true)} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Registrar Entrada
          </Button>
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
          <StatCard
            title="Planos Expirando"
            value={`R$ ${expiringTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle={`${expiringPlans.length} planos`}
            icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
            variant="default"
          />
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
          <ExpiringPlansList clients={expiringPlans} title="Planos Expirando" />
        </div>

        {/* Despesas */}
        <ExpensesSection />
      </div>

      {/* Dialog para registrar entrada */}
      <AddPaymentDialog
        open={showAddPayment}
        onOpenChange={setShowAddPayment}
        clients={clients}
        onSubmit={handleAddPayment}
        isSubmitting={addPaymentMutation.isPending}
      />
    </Layout>
  );
}
