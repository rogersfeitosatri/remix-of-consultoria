import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Utensils, Check, User, Loader2 } from 'lucide-react';
import { usePendingDietAlerts, useMarkDietAdjustmentDone } from '@/hooks/useDietAdjustmentAlerts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export function DietAdjustmentAlert() {
  const { data: pendingAlerts = [], isLoading } = usePendingDietAlerts();
  const markDone = useMarkDietAdjustmentDone();

  const handleMarkDone = async (clientId: string, alertId: string | null, clientName: string) => {
    try {
      await markDone.mutateAsync({ clientId, alertId });
      toast.success(`Ajuste de dieta marcado como realizado para ${clientName}`);
    } catch (error) {
      toast.error('Erro ao marcar ajuste como realizado');
    }
  };

  if (isLoading) {
    return (
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Utensils className="h-5 w-5 text-orange-500" />
            Ajustes de Dieta Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingAlerts.length === 0) {
    return null;
  }

  const getPlanLabel = (planType: string) => {
    switch (planType) {
      case 'consultoria':
        return 'Consultoria';
      case 'premium':
        return 'Premium';
      default:
        return planType;
    }
  };

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <Utensils className="h-5 w-5 text-orange-500" />
          Ajustes de Dieta Pendentes ({pendingAlerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Atletas que precisam de ajuste profundo de dieta mensal (ciclo de 4 semanas)
        </p>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {pendingAlerts.map((alert) => (
            <div
              key={alert.client_id}
              className="flex items-center justify-between p-3 rounded-lg bg-background border border-border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{alert.client_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {getPlanLabel(alert.plan_type)}
                  </Badge>
                  {(alert.consultation_count === 0 || alert.consultation_count === null) && (
                    <Badge variant="secondary" className="text-xs">
                      0 consultas
                    </Badge>
                  )}
                  {alert.consultation_count === 1 && (
                    <Badge variant="secondary" className="text-xs">
                      1 consulta
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {alert.last_adjustment_at ? (
                    <>Último ajuste: {format(parseISO(alert.last_adjustment_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</>
                  ) : (
                    <>Nenhum ajuste registrado</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  asChild
                >
                  <Link to={`/clients?search=${encodeURIComponent(alert.client_name)}`}>
                    <User className="h-3 w-3 mr-1" />
                    Ver atleta
                  </Link>
                </Button>
                <Button
                  size="sm"
                  className="text-xs bg-orange-500 hover:bg-orange-600"
                  onClick={() => handleMarkDone(alert.client_id, alert.alert_id, alert.client_name)}
                  disabled={markDone.isPending}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Feito
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
