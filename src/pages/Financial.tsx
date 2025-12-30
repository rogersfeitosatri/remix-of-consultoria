import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { MonthlyRevenue } from '@/components/financial/MonthlyRevenue';
import { UpcomingPayments } from '@/components/financial/UpcomingPayments';
import { StatCard } from '@/components/dashboard/StatCard';
import { getMonthlyRevenue, getUpcomingPayments, getTotalMonthlyRecurring, getPayments } from '@/lib/storage';
import { Payment } from '@/types/client';
import { DollarSign, TrendingUp, CreditCard, AlertCircle } from 'lucide-react';

export default function Financial() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [monthlyData, setMonthlyData] = useState<{ total: number; payments: Payment[] }>({ total: 0, payments: [] });
  const [upcomingPayments, setUpcomingPayments] = useState<Payment[]>([]);
  const [monthlyRecurring, setMonthlyRecurring] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    loadData();
  }, [currentYear, currentMonth]);

  const loadData = () => {
    setMonthlyData(getMonthlyRevenue(currentYear, currentMonth));
    setUpcomingPayments(getUpcomingPayments(30));
    setMonthlyRecurring(getTotalMonthlyRecurring());
    
    const allPayments = getPayments();
    const overdue = allPayments.filter(p => {
      if (p.status === 'paid') return false;
      const dueDate = new Date(p.dueDate);
      return dueDate < new Date();
    });
    setOverdueCount(overdue.length);
  };

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const paidThisMonth = monthlyData.payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>
          <p className="mt-1 text-muted-foreground">Controle de recebimentos e pagamentos</p>
        </div>

        {/* Stats */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Receita Recorrente"
            value={`R$ ${monthlyRecurring.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="por mês"
            icon={<TrendingUp className="h-6 w-6" />}
            variant="primary"
          />
          <StatCard
            title="Recebido no Mês"
            value={`R$ ${paidThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="confirmados"
            icon={<DollarSign className="h-6 w-6" />}
            variant="success"
          />
          <StatCard
            title="A Receber (30 dias)"
            value={`R$ ${upcomingPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle={`${upcomingPayments.length} pagamentos`}
            icon={<CreditCard className="h-6 w-6" />}
            variant="default"
          />
          <StatCard
            title="Pagamentos Atrasados"
            value={overdueCount}
            subtitle="pendentes"
            icon={<AlertCircle className="h-6 w-6" />}
            variant="warning"
          />
        </div>

        {/* Content */}
        <div className="grid gap-6 lg:grid-cols-2">
          <MonthlyRevenue
            year={currentYear}
            month={currentMonth}
            payments={monthlyData.payments}
            total={monthlyData.total}
            onMonthChange={handleMonthChange}
            onPaymentUpdate={loadData}
          />
          <UpcomingPayments payments={upcomingPayments} />
        </div>
      </div>
    </Layout>
  );
}
