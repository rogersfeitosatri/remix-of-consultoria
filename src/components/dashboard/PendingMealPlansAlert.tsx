import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, ChevronRight, Loader2, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { usePendingMealPlans, useMarkMealPlanSent, MealPlanStatusWithClient } from '@/hooks/useMealPlanStatus';
import { useNavigate } from 'react-router-dom';
import { ptBR } from 'date-fns/locale';
import { differenceInCalendarDays, format, parseISO, isWeekend, addDays } from 'date-fns';

/**
 * Calculate business days elapsed since a date (excludes weekends).
 */
function businessDaysSince(fromDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  let count = 0;
  let current = new Date(start);
  while (current < today) {
    current = addDays(current, 1);
    if (!isWeekend(current)) {
      count++;
    }
  }
  return count;
}

function getDeadlineInfo(plan: MealPlanStatusWithClient) {
  const DEADLINE_DAYS = 4; // 4 business days
  const referenceDate = plan.anamnese_submitted_at
    ? parseISO(plan.anamnese_submitted_at)
    : parseISO(plan.created_at);

  const businessDaysElapsed = businessDaysSince(referenceDate);
  const remaining = DEADLINE_DAYS - businessDaysElapsed;

  return {
    referenceDate,
    businessDaysElapsed,
    remaining,
    isOverdue: remaining < 0,
    isLastDay: remaining === 0,
    isOnTrack: remaining > 0,
    label: plan.anamnese_submitted_at ? 'Anamnese respondida' : 'Cadastrado',
  };
}

function sortByUrgency(a: MealPlanStatusWithClient, b: MealPlanStatusWithClient) {
  const infoA = getDeadlineInfo(a);
  const infoB = getDeadlineInfo(b);
  return infoA.remaining - infoB.remaining; // most overdue first
}

export function PendingMealPlansAlert() {
  const navigate = useNavigate();
  const { data: pendingPlans = [], isLoading } = usePendingMealPlans();
  const markAsSent = useMarkMealPlanSent();

  if (isLoading) {
    return (
      <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
        <CardContent className="pt-4">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingPlans.length === 0) {
    return null;
  }

  const sortedPlans = [...pendingPlans].sort(sortByUrgency);

  const handleMarkSent = async (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsSent.mutate(clientId);
  };

  return (
    <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium text-orange-800 dark:text-orange-200">
          <UtensilsCrossed className="h-5 w-5" />
          Planos Alimentares Pendentes
          <Badge variant="secondary" className="ml-auto bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            {sortedPlans.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Prazo: 4 dias úteis a partir da resposta da anamnese
        </p>
        {sortedPlans.slice(0, 5).map((plan) => {
          const info = getDeadlineInfo(plan);
          return (
            <div
              key={plan.id}
              className="flex items-center justify-between rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-background p-3 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={false}
                  onCheckedChange={() => {}}
                  onClick={(e) => handleMarkSent(plan.client_id, e)}
                  disabled={markAsSent.isPending}
                  className="border-orange-400 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-foreground">{plan.client_name}</p>
                    {info.isOverdue && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                        {Math.abs(info.remaining)}d atrasado
                      </Badge>
                    )}
                    {info.isLastDay && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500 text-white border-yellow-500">
                        <Clock className="h-3 w-3 mr-0.5" />
                        Último dia
                      </Badge>
                    )}
                    {info.isOnTrack && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                        <CheckCircle className="h-3 w-3 mr-0.5" />
                        {info.remaining}d restante{info.remaining > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {info.label} em {format(info.referenceDate, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-700 hover:text-orange-900 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30"
                onClick={() => navigate(`/clients/${plan.client_id}`)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {sortedPlans.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-orange-700 hover:text-orange-900 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30"
            onClick={() => navigate('/tasks')}
          >
            Ver todos ({sortedPlans.length})
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
