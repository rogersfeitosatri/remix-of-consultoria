import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Payment } from '@/hooks/useClients';
import { useUpdatePaymentStatus } from '@/hooks/useClients';

interface DuePaymentsListProps {
  payments: (Payment & { client_name?: string })[];
  title?: string;
}

export function DuePaymentsList({ payments, title = "Vencimentos" }: DuePaymentsListProps) {
  const updatePaymentStatus = useUpdatePaymentStatus();
  const today = new Date();
  
  const totalPending = payments
    .filter(p => p.status !== 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const totalPaid = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const togglePaymentStatus = async (payment: Payment & { client_name?: string }) => {
    const newStatus = payment.status === 'paid' ? 'pending' : 'paid';
    const paid_at = newStatus === 'paid' ? new Date().toISOString() : null;
    await updatePaymentStatus.mutateAsync({ id: payment.id, status: newStatus, paid_at });
  };
  
  const getStatusInfo = (payment: Payment & { client_name?: string }) => {
    if (payment.status === 'paid') {
      return { 
        label: 'Pago', 
        color: 'text-success', 
        bgColor: 'bg-success/10 border-success/20',
        icon: CheckCircle 
      };
    }
    
    const dueDate = parseISO(payment.due_date);
    const daysUntilDue = differenceInDays(dueDate, today);
    
    if (daysUntilDue < 0) {
      return { 
        label: `${Math.abs(daysUntilDue)}d atraso`, 
        color: 'text-destructive', 
        bgColor: 'bg-destructive/10 border-destructive/20',
        icon: AlertCircle 
      };
    }
    
    if (daysUntilDue <= 7) {
      return { 
        label: `${daysUntilDue}d`, 
        color: 'text-warning', 
        bgColor: 'bg-warning/10 border-warning/20',
        icon: Clock 
      };
    }
    
    return { 
      label: 'Pendente', 
      color: 'text-muted-foreground', 
      bgColor: 'bg-muted/50 border-border',
      icon: Clock 
    };
  };
  
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-warning" />
            {title}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-warning/10 text-warning">
              Pendente: R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Badge>
            {totalPaid > 0 && (
              <Badge variant="secondary" className="bg-success/10 text-success">
                Pago: R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum vencimento no período
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {payments.map((payment) => {
              const statusInfo = getStatusInfo(payment);
              const StatusIcon = statusInfo.icon;
              
              return (
                <div
                  key={payment.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3 transition-all",
                    statusInfo.bgColor
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => togglePaymentStatus(payment)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full transition-all flex-shrink-0",
                        payment.status === 'paid'
                          ? "bg-success text-success-foreground"
                          : "border-2 border-muted-foreground/30 hover:border-success hover:bg-success/10"
                      )}
                    >
                      {payment.status === 'paid' && <CheckCircle className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {payment.client_name || 'Cliente'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vencimento: {format(parseISO(payment.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusInfo.label}
                    </Badge>
                    <span className={cn(
                      "text-sm font-semibold whitespace-nowrap",
                      statusInfo.color
                    )}>
                      R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
