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
    <div className="glass-card rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-card-foreground">Recebimentos Mensais</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center font-medium text-card-foreground capitalize">
            {format(new Date(year, month), 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Total Esperado</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg bg-success/10 p-4">
          <p className="text-sm text-success">Recebido</p>
          <p className="mt-1 text-2xl font-bold text-success">
            R$ {paidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg bg-warning/10 p-4">
          <p className="text-sm text-warning">Pendente</p>
          <p className="mt-1 text-2xl font-bold text-warning">
            R$ {pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        {newPlans && (
          <div className="rounded-lg bg-primary/10 p-4">
            <p className="text-sm text-primary">Novos Planos ({newPlans.count})</p>
            <p className="mt-1 text-2xl font-bold text-primary">
              R$ {newPlans.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Payments List */}
      {payments.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          Nenhum pagamento para este mês
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-4 transition-all',
                payment.status === 'paid' && 'border-success/30 bg-success/5',
                payment.status === 'pending' && 'border-border bg-card',
                payment.status === 'overdue' && 'border-destructive/30 bg-destructive/5'
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => togglePaymentStatus(payment)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                    payment.status === 'paid'
                      ? 'bg-success text-success-foreground'
                      : 'border-2 border-muted-foreground/30 hover:border-success hover:bg-success/10'
                  )}
                >
                  {payment.status === 'paid' && <CheckCircle className="h-5 w-5" />}
                </button>
                <div>
                  <p className="font-medium text-card-foreground">{payment.client_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {format(parseISO(payment.due_date), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {payment.status === 'overdue' && (
                  <span className="alert-badge bg-destructive/10 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    Atrasado
                  </span>
                )}
                {payment.status === 'pending' && (
                  <span className="alert-badge bg-muted text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Pendente
                  </span>
                )}
                <span className={cn(
                  'text-lg font-semibold',
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
