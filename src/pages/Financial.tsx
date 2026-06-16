import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/dashboard/StatCard';
import { FinancialCharts } from '@/components/financial/FinancialCharts';
import { FinancialFilters } from '@/components/financial/FinancialFilters';
import { IncomeList } from '@/components/financial/IncomeList';
import { AthletePaymentSearch } from '@/components/financial/AthletePaymentSearch';
import { ExpiringPlansList } from '@/components/financial/ExpiringPlansList';
import { ExpensesSection } from '@/components/financial/ExpensesSection';
import { AddPaymentDialog } from '@/components/financial/AddPaymentDialog';
import { FinancialOverview } from '@/components/financial/FinancialOverview';
import { ManagementCharts } from '@/components/financial/ManagementCharts';
import { ReceiptScanDialog } from '@/components/financial/ReceiptScanDialog';
import { FinancialInsightsPanel } from '@/components/financial/FinancialInsightsPanel';
import { TransactionsList } from '@/components/financial/TransactionsList';
import { DebtsList } from '@/components/financial/DebtsList';
import { MonthlyCostsPanel } from '@/components/financial/MonthlyCostsPanel';
import { LtvDashboard } from '@/components/financial/LtvDashboard';
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
import { DollarSign, CreditCard, AlertCircle, Loader2, Plus, Users, Wallet, Camera } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

export default function Financial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';
  const initialTab = searchParams.get('tab') || 'gestao';
  
  const today = new Date();
  
  const [filterStartDate, setFilterStartDate] = useState<Date>(startOfMonth(today));
  const [filterEndDate, setFilterEndDate] = useState<Date>(endOfMonth(today));
  const [filter, setFilter] = useState<'all' | 'overdue' | 'upcoming'>(initialFilter as any);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showReceiptScan, setShowReceiptScan] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const addPaymentMutation = useAddPayment();

  const incomeTotal = useMemo(() => 
    getMonthlyIncomeByPaidAt(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  const incomePayments = useMemo(() =>
    getIncomePaymentsInPeriod(payments, filterStartDate, filterEndDate),
    [payments, filterStartDate, filterEndDate]
  );
  
  const expiringPlans = useMemo(() =>
    getExpiringPlansInPeriod(clients, payments, filterStartDate, filterEndDate),
    [clients, payments, filterStartDate, filterEndDate]
  );
  
  const expiringTotal = useMemo(() =>
    getExpiringPlansTotal(clients, payments, filterStartDate, filterEndDate),
    [clients, payments, filterStartDate, filterEndDate]
  );
  
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
  
  const overduePayments = getOverduePayments(payments);

  const handleDateChange = (start: Date, end: Date) => {
    setFilterStartDate(start);
    setFilterEndDate(end);
  };

  const isLoading = clientsLoading || paymentsLoading;

  const handleFilterClick = (newFilter: 'overdue' | 'upcoming') => {
    setFilter(newFilter);
    navigate(`/financial?filter=${newFilter}&tab=atletas`);
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
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">Controle financeiro completo</p>
        </div>

        {/* Period filter (shared) */}
        <div className="glass-card rounded-xl p-3 sm:p-4">
          <FinancialFilters
            startDate={filterStartDate}
            endDate={filterEndDate}
            onDateChange={handleDateChange}
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="gestao" className="gap-2">
              <Wallet className="h-4 w-4" />
              Gestão Financeira
            </TabsTrigger>
            <TabsTrigger value="atletas" className="gap-2">
              <Users className="h-4 w-4" />
              Atletas
            </TabsTrigger>
          </TabsList>

          {/* Gestão Financeira Tab */}
          <TabsContent value="gestao" className="space-y-6 mt-4">
            <FinancialOverview filterStartDate={filterStartDate} filterEndDate={filterEndDate} />

            {/* Quick actions */}
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowReceiptScan(true)} variant="outline" className="gap-2">
                <Camera className="h-4 w-4" />
                Escanear Comprovante
              </Button>
            </div>

            {/* Custos do Mês (Fixed vs Variable) */}
            <MonthlyCostsPanel 
              filterStartDate={filterStartDate} 
              filterEndDate={filterEndDate}
              onAddNew={() => setShowAddExpense(true)}
            />

            <ManagementCharts filterStartDate={filterStartDate} filterEndDate={filterEndDate} />

            <FinancialInsightsPanel filterStartDate={filterStartDate} filterEndDate={filterEndDate} />

            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              <TransactionsList filterStartDate={filterStartDate} filterEndDate={filterEndDate} />
              <DebtsList />
            </div>
          </TabsContent>

          {/* Atletas Tab */}
          <TabsContent value="atletas" className="space-y-6 mt-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
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

            <div className="flex justify-end">
              <Button onClick={() => setShowAddPayment(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Registrar Entrada
              </Button>
            </div>

            <FinancialCharts
              dailyIncomeData={dailyIncomeData}
              monthlyIncomeData={monthlyIncomeData}
              dailyDueData={dailyDueData}
              monthlyDueData={monthlyDueData}
            />

            <AthletePaymentSearch payments={payments} />

            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              <IncomeList payments={incomePayments} title="Entradas Confirmadas" />
              <ExpiringPlansList clients={expiringPlans} title="Planos Expirando" />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ReceiptScanDialog
        open={showReceiptScan}
        onOpenChange={setShowReceiptScan}
      />

      <AddPaymentDialog
        open={showAddPayment}
        onOpenChange={setShowAddPayment}
        clients={clients}
        onSubmit={handleAddPayment}
        isSubmitting={addPaymentMutation.isPending}
      />

      {/* Reuse ExpensesSection dialog for adding expenses */}
      <ExpensesSection 
        filterStartDate={filterStartDate} 
        filterEndDate={filterEndDate}
        dialogOnly={showAddExpense}
        onCloseDialog={() => setShowAddExpense(false)}
      />
    </Layout>
  );
}