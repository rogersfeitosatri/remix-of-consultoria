import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, ChevronRight, Loader2 } from 'lucide-react';
import { usePendingMealPlans, useMarkMealPlanSent } from '@/hooks/useMealPlanStatus';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
            {pendingPlans.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendingPlans.slice(0, 5).map((plan) => (
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
                <p className="font-medium text-sm text-foreground">{plan.client_name}</p>
                <p className="text-xs text-muted-foreground">
                  Cadastrado há {formatDistanceToNow(new Date(plan.created_at), { locale: ptBR })}
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
        ))}

        {pendingPlans.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-orange-700 hover:text-orange-900 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30"
            onClick={() => navigate('/tasks')}
          >
            Ver todos ({pendingPlans.length})
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
