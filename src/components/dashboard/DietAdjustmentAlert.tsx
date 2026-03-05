import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Utensils, Check, User, Loader2, ClipboardList, AlertTriangle } from 'lucide-react';
import { usePendingDietAlerts, useMarkDietAdjustmentDone } from '@/hooks/useDietAdjustmentAlerts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const CHECKIN_FREQ_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  biweekly: 'Quinzenal',
};

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
      case 'consultoria': return 'Consultoria';
      case 'consulta_unica': return 'Consulta Única';
      case 'premium': return 'Premium';
      default: return planType;
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
          Atletas com check-in mensal/quinzenal que precisam de ajuste de dieta (ciclo de 4 semanas)
        </p>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {pendingAlerts.map((alert) => (
            <div
              key={alert.client_id}
              className="flex flex-col gap-2 p-3 rounded-lg bg-background border border-border"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{alert.client_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {getPlanLabel(alert.plan_type)}
                    </Badge>
                    {alert.checkin_frequency && (
                      <Badge variant="secondary" className="text-xs">
                        Check-in {CHECKIN_FREQ_LABELS[alert.checkin_frequency] || alert.checkin_frequency}
                      </Badge>
                    )}
                    {alert.days_since_adjustment === null && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                        Nunca ajustado
                      </Badge>
                    )}
                    {alert.days_since_adjustment !== null && alert.days_since_adjustment > 28 && (
                      <Badge variant="destructive" className="text-xs">
                        {alert.days_since_adjustment}d atrás
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {alert.last_adjustment_at ? (
                        <>Último ajuste: {format(parseISO(alert.last_adjustment_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</>
                      ) : (
                        <>Nenhum ajuste registrado</>
                      )}
                    </p>
                    {alert.last_checkin_at && (
                      <p className="text-xs text-muted-foreground">
                        Último check-in: {format(parseISO(alert.last_checkin_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="text-xs" asChild>
                    <Link to={`/checkin?search=${encodeURIComponent(alert.client_name)}`}>
                      <ClipboardList className="h-3 w-3 mr-1" />
                      Check-ins
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" asChild>
                    <Link to={`/clients?search=${encodeURIComponent(alert.client_name)}`}>
                      <User className="h-3 w-3 mr-1" />
                      Atleta
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
