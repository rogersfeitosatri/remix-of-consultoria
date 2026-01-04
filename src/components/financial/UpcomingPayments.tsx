import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, AlertCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Payment {
  id: string;
  client_name: string;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
}

interface UpcomingPaymentsProps {
  payments: Payment[];
  title?: string;
}

export function UpcomingPayments({ payments, title = 'Próximos Vencimentos' }: UpcomingPaymentsProps) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  if (payments.length === 0) {
    return (
      <div className="glass-card rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-4">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-card-foreground">{title}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Pagamentos pendentes</p>
          </div>
        </div>
        <div className="py-6 sm:py-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-success/10">
            <span className="text-xl sm:text-2xl">✓</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Nenhum pagamento pendente para os próximos 30 dias
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      <div className="flex items-start sm:items-center justify-between gap-2 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-card-foreground truncate">{title}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Pagamentos pendentes</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
          <p className="text-base sm:text-lg lg:text-xl font-bold text-card-foreground whitespace-nowrap">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {payments.map((payment) => {
          const today = new Date();
          const dueDate = parseISO(payment.due_date);
          const daysUntilDue = differenceInDays(dueDate, today);
          const isOverdue = daysUntilDue < 0;
          const isUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;

          return (
            <div
              key={payment.id}
              className={cn(
                'flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 rounded-lg border p-3 sm:p-4',
                isOverdue && 'border-destructive/30 bg-destructive/5',
                isUrgent && !isOverdue && 'border-warning/30 bg-warning/5',
                !isUrgent && !isOverdue && 'border-border'
              )}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={cn(
                  'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full flex-shrink-0',
                  isOverdue && 'bg-destructive/10 text-destructive',
                  isUrgent && !isOverdue && 'bg-warning/10 text-warning',
                  !isUrgent && !isOverdue && 'bg-muted text-muted-foreground'
                )}>
                  {isOverdue ? <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" /> : <Clock className="h-4 w-4 sm:h-5 sm:w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-medium text-card-foreground truncate">{payment.client_name}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {format(dueDate, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pl-10 sm:pl-0">
                <span className={cn(
                  'alert-badge text-xs',
                  isOverdue && 'bg-destructive/10 text-destructive',
                  isUrgent && !isOverdue && 'bg-warning/10 text-warning',
                  !isUrgent && !isOverdue && 'bg-muted text-muted-foreground'
                )}>
                  {isOverdue 
                    ? `${Math.abs(daysUntilDue)} dias atrás`
                    : daysUntilDue === 0
                      ? 'Vence hoje'
                      : `em ${daysUntilDue} dias`
                  }
                </span>
                <span className="text-sm sm:text-base font-semibold text-card-foreground whitespace-nowrap">
                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
