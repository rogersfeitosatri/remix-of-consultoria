import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Client } from '@/hooks/useClients';

const PLAN_LABELS: Record<string, string> = {
  consultoria: 'Consultoria',
  premium: 'Premium',
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
  const endDate = parseISO(client.end_date);
  const daysRemaining = differenceInDays(endDate, today);
  const weeksRemaining = Math.floor(daysRemaining / 7);
  
  // Calcular status do plano
  let planStatus: 'active' | 'expiring' | 'expired' = 'active';
  let statusLabel = 'Ativo';
  let statusVariant: 'default' | 'secondary' | 'destructive' = 'default';
  
  if (daysRemaining < 0) {
    planStatus = 'expired';
    statusLabel = 'Vencido';
    statusVariant = 'destructive';
  } else if (daysRemaining <= 14) {
    planStatus = 'expiring';
    statusLabel = 'A vencer';
    statusVariant = 'secondary';
  }
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Plano & Vigência
          </CardTitle>
          <Badge variant={statusVariant}>
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tipo de Plano */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Plano</span>
          <span className="font-medium">
            {PLAN_LABELS[client.plan_type] || client.plan_type}
            {client.plan_duration && ` - ${DURATION_LABELS[client.plan_duration] || client.plan_duration}`}
          </span>
        </div>
        
        {/* Período */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Período</span>
          <span className="text-sm">
            {format(parseISO(client.start_date), 'dd/MM/yy', { locale: ptBR })} - {format(endDate, 'dd/MM/yy', { locale: ptBR })}
          </span>
        </div>
        
        {/* Tempo Restante */}
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Tempo Restante</p>
          <p className={`text-lg font-bold ${planStatus === 'expired' ? 'text-destructive' : planStatus === 'expiring' ? 'text-warning' : 'text-primary'}`}>
            {planStatus === 'expired' ? (
              `Vencido há ${Math.abs(daysRemaining)} dias`
            ) : (
              <>
                {daysRemaining} dias
                {weeksRemaining > 0 && <span className="text-sm font-normal text-muted-foreground"> ({weeksRemaining} semanas)</span>}
              </>
            )}
          </p>
        </div>
        
        {/* Valor Mensal */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Valor Mensal
          </span>
          <span className="font-semibold text-primary">
            R$ {client.monthly_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        {/* Ações */}
        <div className="flex gap-2 pt-2">
          {onRenewPlan && (
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={onRenewPlan}
            >
              <RefreshCw className="h-3 w-3" />
              Renovar
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-1"
            onClick={() => navigate('/financial')}
          >
            <DollarSign className="h-3 w-3" />
            Financeiro
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
