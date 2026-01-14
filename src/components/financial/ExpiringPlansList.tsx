import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Client } from '@/hooks/useClients';

interface ExpiringPlan {
  id: string;
  name: string;
  end_date: string;
  monthly_value: number;
  plan_type: string;
  is_active: boolean;
}

interface ExpiringPlansListProps {
  clients: ExpiringPlan[];
  title?: string;
}

export function ExpiringPlansList({ clients, title = "Planos Expirando" }: ExpiringPlansListProps) {
  const today = new Date();
  
  const totalValue = clients.reduce((sum, c) => sum + c.monthly_value, 0);
  const activeCount = clients.filter(c => c.is_active).length;
  
  const getStatusInfo = (client: ExpiringPlan) => {
    const endDate = parseISO(client.end_date);
    const daysUntilEnd = differenceInDays(endDate, today);
    
    if (!client.is_active) {
      return { 
        label: 'Inativo', 
        color: 'text-muted-foreground', 
        bgColor: 'bg-muted/50 border-border',
        icon: Clock 
      };
    }
    
    if (daysUntilEnd < 0) {
      return { 
        label: 'Expirado', 
        color: 'text-destructive', 
        bgColor: 'bg-destructive/10 border-destructive/20',
        icon: AlertCircle 
      };
    }
    
    if (daysUntilEnd <= 7) {
      return { 
        label: `${daysUntilEnd}d restantes`, 
        color: 'text-warning', 
        bgColor: 'bg-warning/10 border-warning/20',
        icon: Clock 
      };
    }
    
    if (daysUntilEnd <= 30) {
      return { 
        label: `${daysUntilEnd}d restantes`, 
        color: 'text-orange-500', 
        bgColor: 'bg-orange-500/10 border-orange-500/20',
        icon: Clock 
      };
    }
    
    return { 
      label: 'Ativo', 
      color: 'text-success', 
      bgColor: 'bg-success/10 border-success/20',
      icon: Calendar 
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
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              {clients.length} planos
            </Badge>
            {activeCount > 0 && (
              <Badge variant="secondary" className="bg-success/10 text-success">
                {activeCount} ativos
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum plano expirando no período
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {clients.map((client) => {
              const statusInfo = getStatusInfo(client);
              const StatusIcon = statusInfo.icon;
              
              return (
                <div
                  key={client.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border p-3 transition-all",
                    statusInfo.bgColor
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0",
                      client.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {client.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Término: {format(parseISO(client.end_date), "dd/MM/yyyy", { locale: ptBR })}
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
                      "text-foreground"
                    )}>
                      R$ {client.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
