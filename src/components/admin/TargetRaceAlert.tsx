import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Flag, 
  Calendar, 
  AlertTriangle, 
  Check, 
  Loader2,
  TrendingUp,
  Clock
} from 'lucide-react';
import { useTargetRaceAlert } from '@/hooks/useTargetRaceAlert';
import { useMarkDietAdjustmentDone } from '@/hooks/useDietAdjustmentAlerts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface TargetRaceAlertProps {
  clientId: string;
  clientName: string;
}

export function TargetRaceAlert({ clientId, clientName }: TargetRaceAlertProps) {
  const { data: alertData, isLoading } = useTargetRaceAlert(clientId);
  const markDone = useMarkDietAdjustmentDone();

  const handleMarkDone = async () => {
    try {
      await markDone.mutateAsync({ clientId, alertId: null });
      toast.success('Ajuste de dieta marcado como realizado');
    } catch (error) {
      toast.error('Erro ao marcar ajuste como realizado');
    }
  };

  if (isLoading) {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Flag className="h-5 w-5 text-blue-500" />
            Prova Alvo
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

  // Se não tem prova alvo, não exibe nada
  if (!alertData?.hasTargetRace) {
    return null;
  }

  const getReasonLabel = (reason: string | null) => {
    switch (reason) {
      case 'checkin_monthly':
        return 'Check-in mensal';
      case 'checkin_cycle':
        return 'Ciclo de check-ins';
      case 'consultation':
        return 'Consulta recorrente';
      default:
        return 'Acompanhamento';
    }
  };

  const getDaysLabel = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) return 'Prova já realizada';
    if (days === 0) return 'Hoje é a prova!';
    if (days === 1) return '1 dia';
    if (days < 7) return `${days} dias`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} semana${weeks > 1 ? 's' : ''}`;
    }
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    if (remainingDays === 0) {
      return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    }
    return `${months} ${months === 1 ? 'mês' : 'meses'} e ${remainingDays} dias`;
  };

  const isUrgent = alertData.daysToRace !== null && alertData.daysToRace <= 30;
  const borderColor = alertData.needsDietAdjustment 
    ? isUrgent ? 'border-red-500/30 bg-red-500/5' : 'border-orange-500/30 bg-orange-500/5'
    : 'border-blue-500/30 bg-blue-500/5';
  
  const iconColor = alertData.needsDietAdjustment 
    ? isUrgent ? 'text-red-500' : 'text-orange-500'
    : 'text-blue-500';

  return (
    <Card className={borderColor}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base text-foreground">
          <div className="flex items-center gap-2">
            <Flag className={`h-5 w-5 ${iconColor}`} />
            Prova Alvo
          </div>
          {alertData.needsDietAdjustment && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Ajuste Pendente
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prova e Data */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{alertData.targetRace}</span>
          </div>
          
          {alertData.targetDeadline && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(parseISO(alertData.targetDeadline), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              {alertData.daysToRace !== null && alertData.daysToRace >= 0 && (
                <Badge 
                  variant={isUrgent ? "destructive" : "secondary"} 
                  className="text-xs ml-2"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {getDaysLabel(alertData.daysToRace)}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Informações do Ajuste */}
        <div className="pt-2 border-t space-y-2">
          <p className="text-xs text-muted-foreground">
            Tipo de acompanhamento: <span className="font-medium">{getReasonLabel(alertData.adjustmentReason)}</span>
          </p>
          
          {alertData.lastAdjustmentAt && (
            <p className="text-xs text-muted-foreground">
              Último ajuste: {format(parseISO(alertData.lastAdjustmentAt), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          )}
          
          {alertData.nextAdjustmentDue && !alertData.needsDietAdjustment && (
            <p className="text-xs text-muted-foreground">
              Próximo ajuste: {format(parseISO(alertData.nextAdjustmentDue), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          )}
        </div>

        {/* Descrição do Alerta */}
        {alertData.needsDietAdjustment && (
          <div className="bg-muted/50 p-3 rounded-lg space-y-3">
            <p className="text-sm">
              {isUrgent 
                ? `⚠️ Prova em ${getDaysLabel(alertData.daysToRace)}! Ajuste de dieta urgente necessário para otimizar performance.`
                : `Está na hora de fazer um ajuste profundo na dieta rumo à ${alertData.targetRace}.`
              }
            </p>
            
            <Button
              size="sm"
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={handleMarkDone}
              disabled={markDone.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              {markDone.isPending ? 'Salvando...' : 'Marcar Ajuste como Feito'}
            </Button>
          </div>
        )}

        {!alertData.needsDietAdjustment && (
          <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20">
            <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Ajuste de dieta em dia para esta prova
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
