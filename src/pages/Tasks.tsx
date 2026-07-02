import { useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { parseISO, addDays, isWeekend, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DEADLINE_BUSINESS_DAYS = 3;
const ANAMNESE_CUTOFF = '2026-06-28';

function addBusinessDays(from: Date, days: number): Date {
  let current = new Date(from);
  let added = 0;
  while (added < days) {
    current = addDays(current, 1);
    if (!isWeekend(current)) added++;
  }
  return current;
}

function businessDaysBetween(from: Date, to: Date): number {
  let count = 0;
  let current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (current < end) {
    current = addDays(current, 1);
    if (!isWeekend(current)) count++;
  }
  return count;
}

interface PendingPlanTask {
  id: string;
  clientId: string;
  clientName: string;
  planType: string;
  anamneseSubmittedAt: Date;
  deadlineDate: Date;
  businessDaysRemaining: number;
  isOverdue: boolean;
  isLastDay: boolean;
  anamneseResponseId: string;
}

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks-pending-plans', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get consultoria/zona_nutri_diet clients without consultations
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, plan_type, has_consultations, consultation_count')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('plan_type', ['consultoria', 'zona_nutri_diet']);

      if (!clients?.length) return [];

      // Filter: no consultations (0 or has_consultations=false)
      const eligible = clients.filter(c => {
        const count = c.has_consultations ? Number(c.consultation_count || 0) : 0;
        return count === 0;
      });

      if (!eligible.length) return [];

      const clientIds = eligible.map(c => c.id);
      const clientMap = new Map(eligible.map(c => [c.id, c]));

      // Get anamnese responses for these clients, from cutoff date onwards
      const { data: responses } = await supabase
        .from('anamnese_responses')
        .select('id, client_id, submitted_at')
        .in('client_id', clientIds)
        .gte('submitted_at', ANAMNESE_CUTOFF)
        .order('submitted_at', { ascending: false });

      if (!responses?.length) return [];

      // Check which clients already have meal_plan_status = 'sent'
      const { data: sentPlans } = await supabase
        .from('meal_plan_status')
        .select('client_id')
        .in('client_id', clientIds)
        .eq('status', 'sent');

      const sentClientIds = new Set((sentPlans || []).map(p => p.client_id));

      // One anamnese per client (most recent)
      const seenClients = new Set<string>();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const items: PendingPlanTask[] = [];

      for (const r of responses) {
        if (!r.client_id || seenClients.has(r.client_id)) continue;
        if (sentClientIds.has(r.client_id)) continue;
        seenClients.add(r.client_id);

        const client = clientMap.get(r.client_id);
        if (!client) continue;

        const submittedAt = parseISO(r.submitted_at);
        const deadlineDate = addBusinessDays(submittedAt, DEADLINE_BUSINESS_DAYS);
        const remaining = businessDaysBetween(today, deadlineDate);
        const isOverdue = today > deadlineDate;
        const isLastDay = !isOverdue && deadlineDate.getTime() === today.getTime();

        items.push({
          id: r.id,
          clientId: r.client_id,
          clientName: client.name,
          planType: client.plan_type,
          anamneseSubmittedAt: submittedAt,
          deadlineDate,
          businessDaysRemaining: isOverdue ? -businessDaysBetween(deadlineDate, today) : remaining,
          isOverdue,
          isLastDay,
          anamneseResponseId: r.id,
        });
      }

      items.sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime());
      return items;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const planTypeLabel = (pt: string) => {
    if (pt === 'zona_nutri_diet') return 'Zona Nutri Diet';
    return 'Consultoria';
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planos alimentares pendentes — atletas que preencheram a anamnese e aguardam envio do plano.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : tasks.length === 0 ? (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="flex items-center gap-3 py-6">
              <CheckCircle className="h-6 w-6 text-emerald-500" />
              <div>
                <p className="font-medium">Nenhum plano pendente</p>
                <p className="text-sm text-muted-foreground">Todos os planos alimentares foram enviados.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {tasks.length} {tasks.length === 1 ? 'plano pendente' : 'planos pendentes'} — prazo de 3 dias úteis a partir da anamnese
            </p>

            {tasks.map(task => (
              <div
                key={task.id}
                className={`rounded-lg border border-border/60 bg-card p-4 border-l-4 ${
                  task.isOverdue
                    ? 'border-l-red-500'
                    : task.isLastDay
                    ? 'border-l-yellow-500'
                    : 'border-l-muted-foreground/30'
                } transition-all hover:shadow-sm`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{task.clientName}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {planTypeLabel(task.planType)}
                      </Badge>
                      {task.isOverdue ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          <AlertTriangle className="h-3 w-3 mr-0.5" />
                          {Math.abs(task.businessDaysRemaining)}d atrasado
                        </Badge>
                      ) : task.isLastDay ? (
                        <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500 text-white border-yellow-500">
                          <Clock className="h-3 w-3 mr-0.5" />
                          Último dia
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                          {task.businessDaysRemaining}d restante{task.businessDaysRemaining > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Anamnese: {format(task.anamneseSubmittedAt, "dd/MM/yyyy", { locale: ptBR })}</span>
                      <span>→</span>
                      <span className={task.isOverdue ? 'text-red-500 font-medium' : task.isLastDay ? 'text-yellow-600 font-medium' : ''}>
                        Prazo: {format(task.deadlineDate, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="text-xs h-8 shrink-0"
                    onClick={() => navigate(`/anamnese-response/${task.anamneseResponseId}`)}
                  >
                    Ver anamnese
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
