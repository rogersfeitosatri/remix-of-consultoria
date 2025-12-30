import { Client } from '@/hooks/useClients';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Bell, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SERVICE_LABELS = {
  nutrition: 'Nutrição',
  training: 'Treino',
  both: 'Ambos',
};

const PLAN_LABELS = {
  consultoria: 'Consultoria',
  premium: 'Premium',
};

interface ExpiringClientsAlertProps {
  clients: Client[];
}

export function ExpiringClientsAlert({ clients }: ExpiringClientsAlertProps) {
  if (clients.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
            <Bell className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">Modo Babá</h3>
            <p className="text-sm text-muted-foreground">Alertas de vencimento</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-8 text-center">
          <div>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Nenhum plano vencendo nos próximos 30 dias
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 animate-pulse-slow">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Modo Babá Ativo</h3>
          <p className="text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? 'plano vencendo' : 'planos vencendo'} em breve
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {clients.map((client) => {
          const daysUntilExpiry = differenceInDays(parseISO(client.end_date), new Date());
          const isUrgent = daysUntilExpiry <= 7;
          const isExpired = daysUntilExpiry < 0;

          return (
            <div
              key={client.id}
              className={cn(
                'rounded-lg border p-4 transition-all',
                isExpired && 'border-destructive/50 bg-destructive/5',
                isUrgent && !isExpired && 'border-warning/50 bg-warning/5',
                !isUrgent && !isExpired && 'border-border bg-card'
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-card-foreground truncate">{client.name}</h4>
                    <span className={cn(
                      'alert-badge text-xs whitespace-nowrap',
                      isExpired && 'bg-destructive/10 text-destructive',
                      isUrgent && !isExpired && 'bg-warning/10 text-warning',
                      !isUrgent && !isExpired && 'bg-primary/10 text-primary'
                    )}>
                      {isExpired 
                        ? `Vencido há ${Math.abs(daysUntilExpiry)} dias`
                        : daysUntilExpiry === 0 
                          ? 'Vence hoje!'
                          : `${daysUntilExpiry} dias restantes`
                      }
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span>{SERVICE_LABELS[client.service_type]}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{PLAN_LABELS[client.plan_type]}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Vence: {format(parseISO(client.end_date), "dd 'de' MMM", { locale: ptBR })}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {client.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => window.open(`tel:${client.phone}`)}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  )}
                  {client.email && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => window.open(`mailto:${client.email}`)}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
