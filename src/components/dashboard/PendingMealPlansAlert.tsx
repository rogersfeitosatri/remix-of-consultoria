import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, ChevronRight, Loader2, Clock, AlertTriangle, CheckCircle, Link2Off } from 'lucide-react';
import { usePendingMealPlans, useMarkMealPlanSent, useUnlinkedAnamneseForMealPlan, MealPlanStatusWithClient, UnlinkedAnamneseItem } from '@/hooks/useMealPlanStatus';
import { useNavigate } from 'react-router-dom';
import { ptBR } from 'date-fns/locale';
import { format, parseISO, isWeekend, addDays } from 'date-fns';

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

const DEADLINE_DAYS = 4;

function getDeadlineInfoForPlan(plan: MealPlanStatusWithClient) {
  const referenceDate = plan.anamnese_submitted_at
    ? parseISO(plan.anamnese_submitted_at)
    : parseISO(plan.created_at);

  const businessDaysElapsed = businessDaysSince(referenceDate);
  const remaining = DEADLINE_DAYS - businessDaysElapsed;

  return {
    referenceDate,
    remaining,
    isOverdue: remaining < 0,
    isLastDay: remaining === 0,
    isOnTrack: remaining > 0,
    label: plan.anamnese_submitted_at ? 'Anamnese respondida' : 'Cadastrado',
  };
}

function getDeadlineInfoForUnlinked(item: UnlinkedAnamneseItem) {
  const referenceDate = parseISO(item.submitted_at);
  const businessDaysElapsed = businessDaysSince(referenceDate);
  const remaining = DEADLINE_DAYS - businessDaysElapsed;

  return {
    referenceDate,
    remaining,
    isOverdue: remaining < 0,
    isLastDay: remaining === 0,
    isOnTrack: remaining > 0,
  };
}

type CombinedItem =
  | { type: 'linked'; data: MealPlanStatusWithClient; remaining: number }
  | { type: 'unlinked'; data: UnlinkedAnamneseItem; remaining: number };

export function PendingMealPlansAlert() {
  const navigate = useNavigate();
  const { data: pendingPlans = [], isLoading: loadingPlans } = usePendingMealPlans();
  const { data: unlinkedAnamnese = [], isLoading: loadingUnlinked } = useUnlinkedAnamneseForMealPlan();
  const markAsSent = useMarkMealPlanSent();

  const isLoading = loadingPlans || loadingUnlinked;

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

  // Combine linked and unlinked into a single sorted list
  const combined: CombinedItem[] = [];

  for (const plan of pendingPlans) {
    const info = getDeadlineInfoForPlan(plan);
    combined.push({ type: 'linked', data: plan, remaining: info.remaining });
  }

  for (const item of unlinkedAnamnese) {
    const info = getDeadlineInfoForUnlinked(item);
    combined.push({ type: 'unlinked', data: item, remaining: info.remaining });
  }

  combined.sort((a, b) => a.remaining - b.remaining);

  if (combined.length === 0) {
    return null;
  }

  const handleMarkSent = async (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsSent.mutate(clientId);
  };

  const renderDeadlineBadge = (remaining: number) => {
    if (remaining < 0) {
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          <AlertTriangle className="h-3 w-3 mr-0.5" />
          {Math.abs(remaining)}d atrasado
        </Badge>
      );
    }
    if (remaining === 0) {
      return (
        <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500 text-white border-yellow-500">
          <Clock className="h-3 w-3 mr-0.5" />
          Último dia
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
        <CheckCircle className="h-3 w-3 mr-0.5" />
        {remaining}d restante{remaining > 1 ? 's' : ''}
      </Badge>
    );
  };

  return (
    <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium text-orange-800 dark:text-orange-200">
          <UtensilsCrossed className="h-5 w-5" />
          Planos Alimentares Pendentes
          <Badge variant="secondary" className="ml-auto bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            {combined.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Prazo: 4 dias úteis a partir da resposta da anamnese
        </p>
        {combined.slice(0, 8).map((item) => {
          if (item.type === 'linked') {
            const plan = item.data;
            const info = getDeadlineInfoForPlan(plan);
            return (
              <div
                key={`linked-${plan.id}`}
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
                      {renderDeadlineBadge(info.remaining)}
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
          } else {
            const anamnese = item.data;
            const info = getDeadlineInfoForUnlinked(anamnese);
            return (
              <div
                key={`unlinked-${anamnese.id}`}
                className="flex items-center justify-between rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 p-3 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Link2Off className="h-4 w-4 text-amber-600 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground">
                        {anamnese.respondent_name || 'Sem nome'}
                      </p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-300">
                        Não vinculado
                      </Badge>
                      {renderDeadlineBadge(info.remaining)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Anamnese respondida em {format(info.referenceDate, "dd/MM/yyyy", { locale: ptBR })}
                      {anamnese.respondent_email && ` • ${anamnese.respondent_email}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
                  onClick={() => navigate(`/forms?tab=reviews`)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            );
          }
        })}

        {combined.length > 8 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-orange-700 hover:text-orange-900 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30"
            onClick={() => navigate('/tasks')}
          >
            Ver todos ({combined.length})
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
