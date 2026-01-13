import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, DollarSign } from 'lucide-react';
import { Payment } from '@/hooks/useClients';

interface IncomeListProps {
  payments: (Payment & { client_name?: string })[];
  title?: string;
}

export function IncomeList({ payments, title = "Entradas Confirmadas" }: IncomeListProps) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-success" />
            {title}
          </CardTitle>
          <Badge variant="secondary" className="bg-success/10 text-success">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum pagamento confirmado no período
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-success/20 bg-success/5 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-success-foreground flex-shrink-0">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {payment.client_name || 'Cliente'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pago em: {payment.paid_at ? format(parseISO(payment.paid_at), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-success whitespace-nowrap">
                  R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
