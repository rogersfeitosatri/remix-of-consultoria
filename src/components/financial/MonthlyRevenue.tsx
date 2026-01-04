import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUpdatePaymentStatus } from '@/hooks/useClients';

interface Payment {
  id: string;
  client_name: string;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
}

interface MonthlyRevenueProps {
  year: number;
  month: number;
  payments: Payment[];
  total: number;
  newPlans?: { count: number; total: number };
  onMonthChange: (year: number, month: number) => void;
}

export function MonthlyRevenue({ year, month, payments, total, newPlans, onMonthChange }: MonthlyRevenueProps) {
  const updatePaymentStatus = useUpdatePaymentStatus();

  const handlePreviousMonth = () => {
    if (month === 0) {
      onMonthChange(year - 1, 11);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      onMonthChange(year + 1, 0);
    } else {
      onMonthChange(year, month + 1);
    }
  };

  const togglePaymentStatus = async (payment: Payment) => {
    const newStatus = payment.status === 'paid' ? 'pending' : 'paid';
    const paid_at = newStatus === 'paid' ? new Date().toISOString() : null;
    await updatePaymentStatus.mutateAsync({ id: payment.id, status: newStatus, paid_at });
  };

  const paidTotal = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const pendingTotal = payments.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-card-foreground">Recebimentos Mensais</h3>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth} className="h-7 w-7 sm:h-8 sm:w-8">
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <span className="min-w-24 sm:min-w-32 text-center text-sm sm:text-base font-medium text-card-foreground capitalize">
            {format(new Date(year, month), 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-7 w-7 sm:h-8 sm:w-8">
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="rounded-lg bg-muted/50 p-2.5 sm:p-3">
          <p className="text-xs sm:text-sm text-muted-foreground">Total Esperado</p>
          <p className="mt-0.5 text-sm sm:text-base lg:text-lg font-bold text-card-foreground whitespace-nowrap">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg bg-success/10 p-2.5 sm:p-3">
          <p className="text-xs sm:text-sm text-success">Recebido</p>
          <p className="mt-0.5 text-sm sm:text-base lg:text-lg font-bold text-success whitespace-nowrap">
            R$ {paidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg bg-warning/10 p-2.5 sm:p-3">
          <p className="text-xs sm:text-sm text-warning">Pendente</p>
          <p className="mt-0.5 text-sm sm:text-base lg:text-lg font-bold text-warning whitespace-nowrap">
            R$ {pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        {newPlans && (
          <div className="rounded-lg bg-primary/10 p-2.5 sm:p-3">
            <p className="text-xs sm:text-sm text-primary">Novos Planos ({newPlans.count})</p>
            <p className="mt-0.5 text-sm sm:text-base lg:text-lg font-bold text-primary whitespace-nowrap">
              R$ {newPlans.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Payments List */}
      {payments.length === 0 ? (
        <div className="py-6 sm:py-8 text-center text-sm text-muted-foreground">
          Nenhum pagamento para este mês
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 rounded-lg border p-3 sm:p-4 transition-all',
                payment.status === 'paid' && 'border-success/30 bg-success/5',
                payment.status === 'pending' && 'border-border bg-card',
                payment.status === 'overdue' && 'border-destructive/30 bg-destructive/5'
              )}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => togglePaymentStatus(payment)}
                  className={cn(
                    'flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-all flex-shrink-0',
                    payment.status === 'paid'
                      ? 'bg-success text-success-foreground'
                      : 'border-2 border-muted-foreground/30 hover:border-success hover:bg-success/10'
                  )}
                >
                  {payment.status === 'paid' && <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
                </button>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-medium text-card-foreground truncate">{payment.client_name}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Vencimento: {format(parseISO(payment.due_date), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pl-9 sm:pl-0">
                {payment.status === 'overdue' && (
                  <span className="alert-badge text-xs bg-destructive/10 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    Atrasado
                  </span>
                )}
                {payment.status === 'pending' && (
                  <span className="alert-badge text-xs bg-muted text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Pendente
                  </span>
                )}
                <span className={cn(
                  'text-sm sm:text-base font-semibold whitespace-nowrap',
                  payment.status === 'paid' && 'text-success',
                  payment.status === 'pending' && 'text-card-foreground',
                  payment.status === 'overdue' && 'text-destructive'
                )}>
                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
