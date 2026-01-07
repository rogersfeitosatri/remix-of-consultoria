import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { MonthlyRevenue } from '@/components/financial/MonthlyRevenue';
import { UpcomingPayments } from '@/components/financial/UpcomingPayments';
import { StatCard } from '@/components/dashboard/StatCard';
import { ExpiringClientsAlert } from '@/components/dashboard/ExpiringClientsAlert';
import { useClients, usePayments, getMonthlyRevenue, getUpcomingPayments, getTotalMonthlyRecurring, getOverduePayments, getNewPlansThisMonth, getExpiringClients } from '@/hooks/useClients';
import { DollarSign, TrendingUp, CreditCard, AlertCircle, Loader2 } from 'lucide-react';
import { parseISO } from 'date-fns';

export default function Financial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';
  
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [filter, setFilter] = useState<'all' | 'overdue' | 'upcoming'>(initialFilter as 'all' | 'overdue' | 'upcoming');
  
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();

  const monthlyData = getMonthlyRevenue(payments, currentYear, currentMonth);
  const upcomingPayments = getUpcomingPayments(payments, 30);
  const overduePayments = getOverduePayments(payments);
  const monthlyRecurring = getTotalMonthlyRecurring(clients);
  const newPlans = getNewPlansThisMonth(clients, currentYear, currentMonth);
  const expiringClients = getExpiringClients(clients, 30);

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const paidThisMonth = monthlyData.payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

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

  const displayPayments = filter === 'overdue' 
    ? overduePayments 
    : filter === 'upcoming' 
      ? upcomingPayments 
      : [...overduePayments, ...upcomingPayments];

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Financeiro</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">Controle de recebimentos e pagamentos</p>
        </div>

        {/* Stats */}
        <div className="grid gap-2 sm:gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Receita Recorrente"
            value={`R$ ${monthlyRecurring.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="por mês"
            icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            variant="primary"
          />
          <StatCard
            title="Recebido no Mês"
            value={`R$ ${paidThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="confirmados"
            icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />}
            variant="success"
          />
          <button 
            onClick={() => handleFilterClick('upcoming')}
            className="text-left transition-transform hover:scale-[1.02] h-full"
          >
            <StatCard
              title="A Receber (30 dias)"
              value={`R$ ${upcomingPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              subtitle={`${upcomingPayments.length} pagamentos`}
              icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
              variant="default"
            />
          </button>
          <button 
            onClick={() => handleFilterClick('overdue')}
            className="text-left transition-transform hover:scale-[1.02] h-full"
          >
            <StatCard
              title="Pagamentos Atrasados"
              value={overduePayments.length}
              subtitle="pendentes"
              icon={<AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
              variant="warning"
            />
          </button>
        </div>

        {/* Content */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          <MonthlyRevenue
            year={currentYear}
            month={currentMonth}
            payments={monthlyData.payments}
            total={monthlyData.total}
            newPlans={newPlans}
            onMonthChange={handleMonthChange}
          />
          <UpcomingPayments 
            payments={displayPayments} 
            title={
              filter === 'overdue' 
                ? 'Pagamentos Atrasados' 
                : filter === 'upcoming' 
                  ? 'A Receber (30 dias)' 
                  : 'Todos os Pagamentos'
            }
          />
        </div>

        {/* Modo Babá - Planos vencendo */}
        <ExpiringClientsAlert clients={expiringClients} />
      </div>
    </Layout>
  );
}