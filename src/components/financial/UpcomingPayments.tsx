import { Payment } from '@/types/client';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, AlertCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpcomingPaymentsProps {
  payments: Payment[];
}

export function UpcomingPayments({ payments }: UpcomingPaymentsProps) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  if (payments.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">Próximos Vencimentos</h3>
            <p className="text-sm text-muted-foreground">Próximos 30 dias</p>
          </div>
        </div>
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <span className="text-2xl">✓</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Nenhum pagamento pendente para os próximos 30 dias
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">Próximos Vencimentos</h3>
            <p className="text-sm text-muted-foreground">Próximos 30 dias</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-xl font-bold text-card-foreground">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {payments.map((payment) => {
          const today = new Date();
          const dueDate = parseISO(payment.dueDate);
          const daysUntilDue = differenceInDays(dueDate, today);
          const isOverdue = daysUntilDue < 0;
          const isUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;

          return (
            <div
              key={payment.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-4',
                isOverdue && 'border-destructive/30 bg-destructive/5',
                isUrgent && !isOverdue && 'border-warning/30 bg-warning/5',
                !isUrgent && !isOverdue && 'border-border'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  isOverdue && 'bg-destructive/10 text-destructive',
                  isUrgent && !isOverdue && 'bg-warning/10 text-warning',
                  !isUrgent && !isOverdue && 'bg-muted text-muted-foreground'
                )}>
                  {isOverdue ? <AlertCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-medium text-card-foreground">{payment.clientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(dueDate, "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={cn(
                  'alert-badge',
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
                <span className="text-lg font-semibold text-card-foreground">
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
