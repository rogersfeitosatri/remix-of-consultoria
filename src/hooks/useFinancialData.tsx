import { useMemo } from 'react';
import { Payment } from './useClients';
import { 
  startOfMonth, endOfMonth, startOfDay, endOfDay, 
  parseISO, isWithinInterval, format, eachDayOfInterval,
  eachMonthOfInterval, subMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DailyData {
  day: string;
  date: string;
  value: number;
}

export interface MonthlyData {
  month: string;
  monthKey: string;
  value: number;
}

/**
 * Entradas do mês: pagamentos com paid_at dentro do período
 * Fonte de verdade: apenas pagamentos CONFIRMADOS (status = 'paid' e paid_at preenchido)
 */
export function getMonthlyIncomeByPaidAt(
  payments: (Payment & { client_name?: string })[],
  startDate: Date,
  endDate: Date
): number {
  return payments
    .filter(payment => {
      if (payment.status !== 'paid' || !payment.paid_at) return false;
      const paidDate = parseISO(payment.paid_at);
      return isWithinInterval(paidDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
    })
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Lista detalhada de entradas (pagamentos pagos) no período
 */
export function getIncomePaymentsInPeriod(
  payments: (Payment & { client_name?: string })[],
  startDate: Date,
  endDate: Date
) {
  return payments
    .filter(payment => {
      if (payment.status !== 'paid' || !payment.paid_at) return false;
      const paidDate = parseISO(payment.paid_at);
      return isWithinInterval(paidDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
    })
    .sort((a, b) => {
      const dateA = a.paid_at ? parseISO(a.paid_at) : new Date(0);
      const dateB = b.paid_at ? parseISO(b.paid_at) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
}

/**
 * Vencimentos do mês: pagamentos com due_date dentro do período
 * Considera todos os pagamentos (pagos ou não)
 */
export function getDuePaymentsInPeriod(
  payments: (Payment & { client_name?: string })[],
  startDate: Date,
  endDate: Date
) {
  const today = new Date();
  return payments
    .filter(payment => {
      const dueDate = parseISO(payment.due_date);
      return isWithinInterval(dueDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
    })
    .map(payment => ({
      ...payment,
      status: payment.status === 'paid' 
        ? 'paid' as const 
        : parseISO(payment.due_date) < today 
          ? 'overdue' as const 
          : 'pending' as const
    }))
    .sort((a, b) => parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime());
}

/**
 * Total de vencimentos no período (apenas não pagos)
 */
export function getDueAmountInPeriod(
  payments: (Payment & { client_name?: string })[],
  startDate: Date,
  endDate: Date
): number {
  return payments
    .filter(payment => {
      if (payment.status === 'paid') return false;
      const dueDate = parseISO(payment.due_date);
      return isWithinInterval(dueDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
    })
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Gráfico: Entradas por dia no mês atual
 */
export function getDailyIncomeData(
  payments: (Payment & { client_name?: string })[],
  year: number,
  month: number
): DailyData[] {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));
  
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  return days.map(day => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    
    const dayTotal = payments
      .filter(payment => {
        if (payment.status !== 'paid' || !payment.paid_at) return false;
        const paidDate = parseISO(payment.paid_at);
        return isWithinInterval(paidDate, { start: dayStart, end: dayEnd });
      })
      .reduce((sum, p) => sum + p.amount, 0);
    
    return {
      day: format(day, 'd'),
      date: format(day, 'yyyy-MM-dd'),
      value: dayTotal
    };
  });
}

/**
 * Gráfico: Entradas mês a mês (últimos 12 meses)
 */
export function getMonthlyIncomeData(
  payments: (Payment & { client_name?: string })[],
  monthsBack: number = 12
): MonthlyData[] {
  const today = new Date();
  const startDate = startOfMonth(subMonths(today, monthsBack - 1));
  const endDate = endOfMonth(today);
  
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  
  return months.map(monthDate => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    const monthTotal = payments
      .filter(payment => {
        if (payment.status !== 'paid' || !payment.paid_at) return false;
        const paidDate = parseISO(payment.paid_at);
        return isWithinInterval(paidDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, p) => sum + p.amount, 0);
    
    return {
      month: format(monthDate, 'MMM', { locale: ptBR }),
      monthKey: format(monthDate, 'yyyy-MM'),
      value: monthTotal
    };
  });
}

/**
 * Gráfico: Vencimentos por dia no mês atual
 */
export function getDailyDueData(
  payments: (Payment & { client_name?: string })[],
  year: number,
  month: number
): DailyData[] {
  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(new Date(year, month));
  
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  return days.map(day => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    
    const dayTotal = payments
      .filter(payment => {
        const dueDate = parseISO(payment.due_date);
        return isWithinInterval(dueDate, { start: dayStart, end: dayEnd });
      })
      .reduce((sum, p) => sum + p.amount, 0);
    
    return {
      day: format(day, 'd'),
      date: format(day, 'yyyy-MM-dd'),
      value: dayTotal
    };
  });
}

/**
 * Gráfico: Vencimentos mês a mês (últimos 12 meses)
 */
export function getMonthlyDueData(
  payments: (Payment & { client_name?: string })[],
  monthsBack: number = 12
): MonthlyData[] {
  const today = new Date();
  const startDate = startOfMonth(subMonths(today, monthsBack - 1));
  const endDate = endOfMonth(today);
  
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  
  return months.map(monthDate => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    const monthTotal = payments
      .filter(payment => {
        const dueDate = parseISO(payment.due_date);
        return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, p) => sum + p.amount, 0);
    
    return {
      month: format(monthDate, 'MMM', { locale: ptBR }),
      monthKey: format(monthDate, 'yyyy-MM'),
      value: monthTotal
    };
  });
}

/**
 * Hook para dados financeiros com filtros
 */
export function useFinancialData(
  payments: (Payment & { client_name?: string })[],
  filterStartDate?: Date,
  filterEndDate?: Date
) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  // Datas padrão: mês atual
  const defaultStart = startOfMonth(new Date(currentYear, currentMonth));
  const defaultEnd = endOfMonth(new Date(currentYear, currentMonth));
  
  const startDate = filterStartDate || defaultStart;
  const endDate = filterEndDate || defaultEnd;
  
  const incomeTotal = useMemo(() => 
    getMonthlyIncomeByPaidAt(payments, startDate, endDate),
    [payments, startDate, endDate]
  );
  
  const dueTotal = useMemo(() =>
    getDueAmountInPeriod(payments, startDate, endDate),
    [payments, startDate, endDate]
  );
  
  const incomePayments = useMemo(() =>
    getIncomePaymentsInPeriod(payments, startDate, endDate),
    [payments, startDate, endDate]
  );
  
  const duePayments = useMemo(() =>
    getDuePaymentsInPeriod(payments, startDate, endDate),
    [payments, startDate, endDate]
  );
  
  const dailyIncomeData = useMemo(() =>
    getDailyIncomeData(payments, currentYear, currentMonth),
    [payments, currentYear, currentMonth]
  );
  
  const monthlyIncomeData = useMemo(() =>
    getMonthlyIncomeData(payments, 12),
    [payments]
  );
  
  const dailyDueData = useMemo(() =>
    getDailyDueData(payments, currentYear, currentMonth),
    [payments, currentYear, currentMonth]
  );
  
  const monthlyDueData = useMemo(() =>
    getMonthlyDueData(payments, 12),
    [payments]
  );
  
  return {
    incomeTotal,
    dueTotal,
    incomePayments,
    duePayments,
    dailyIncomeData,
    monthlyIncomeData,
    dailyDueData,
    monthlyDueData,
    startDate,
    endDate
  };
}
