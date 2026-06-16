import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, RefreshCw, Archive, Utensils, Dumbbell, UtensilsCrossed, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { Client } from '@/hooks/useClients';
import { PlanHistorySection } from '@/components/clients/PlanHistorySection';
import { PlanFinancialSetupDialog } from '@/components/admin/PlanFinancialSetupDialog';

const PLAN_LABELS: Record<string, string> = {
  consultoria: 'Consultoria',
  premium: 'Premium',
};

const SERVICE_LABELS: Record<string, { label: string; icon: typeof Utensils }> = {
  nutrition: { label: 'Nutrição', icon: Utensils },
  training: { label: 'Treino', icon: Dumbbell },
  both: { label: 'Nutri + Treino', icon: UtensilsCrossed },
};

const DURATION_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  six_weeks: '6 Semanas',
  custom: 'Personalizado',
};

interface AthleteSummaryPlanCardProps {
  client: Client;
  onRenewPlan?: () => void;
}

export function AthleteSummaryPlanCard({ client, onRenewPlan }: AthleteSummaryPlanCardProps) {
  const navigate = useNavigate();
  
  const today = new Date();
  const startDate = parseISO(client.start_date);
  const endDate = parseISO(client.end_date);
  const totalDays = differenceInDays(endDate, startDate);
  const daysRemaining = differenceInDays(endDate, today);
  const daysElapsed = differenceInDays(today, startDate);
  const progressPercent = totalDays > 0 ? Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100)) : 0;
  
  let planStatus: 'active' | 'expiring' | 'expired' = 'active';
  let statusLabel = 'Ativo';
  let statusVariant: 'default' | 'secondary' | 'destructive' = 'default';
  
  if (daysRemaining < 0) {
    planStatus = 'expired';
    statusLabel = 'Vencido';
    statusVariant = 'destructive';
  } else if (daysRemaining <= 14) {
    planStatus = 'expiring';
    statusLabel = `${daysRemaining}d restantes`;
    statusVariant = 'secondary';
  }

  const serviceInfo = SERVICE_LABELS[client.service_type] || SERVICE_LABELS.nutrition;
  const ServiceIcon = serviceInfo.icon;
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Plano & Vigência
          </CardTitle>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tipo + Serviço */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <ServiceIcon className="h-3 w-3" />
            {serviceInfo.label}
          </Badge>
          <Badge variant="outline">
            {PLAN_LABELS[client.plan_type] || client.plan_type}
            {client.plan_duration && ` · ${DURATION_LABELS[client.plan_duration] || client.plan_duration}`}
          </Badge>
        </div>
        
        {/* Barra de progresso do plano */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{format(startDate, 'dd/MM/yy', { locale: ptBR })}</span>
            <span>{format(endDate, 'dd/MM/yy', { locale: ptBR })}</span>
          </div>
          <Progress 
            value={progressPercent} 
            className={`h-2 ${planStatus === 'expired' ? '[&>div]:bg-destructive' : planStatus === 'expiring' ? '[&>div]:bg-yellow-500' : ''}`}
          />
          <p className={`text-center text-sm font-semibold ${
            planStatus === 'expired' ? 'text-destructive' : 
            planStatus === 'expiring' ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary'
          }`}>
            {planStatus === 'expired' 
              ? `Vencido há ${Math.abs(daysRemaining)} dias`
              : `${daysRemaining} dias restantes`
            }
          </p>
        </div>
        
        {/* Valor */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Total
          </span>
          <span className="font-semibold text-primary">
            R$ {client.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <PlanFinancialSetupDialog client={client} />
          {onRenewPlan && (
            <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs h-8" onClick={onRenewPlan}>
              <RefreshCw className="h-3 w-3" />
              Renovar
            </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs h-8">
                <Archive className="h-3 w-3" />
                Histórico
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Histórico de Planos
                </DialogTitle>
              </DialogHeader>
              <PlanHistorySection clientId={client.id} />
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
