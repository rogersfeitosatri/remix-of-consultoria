import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle, ChevronDown, ChevronUp, UtensilsCrossed,
  MessageSquare, RefreshCw, Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePendingMealPlans, useUnlinkedAnamneseForMealPlan, useMarkMealPlanSent, MealPlanStatusWithClient } from '@/hooks/useMealPlanStatus';
import { parseISO, addDays, isWeekend, differenceInCalendarDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { PLAN_LABELS } from '@/types/client';

function businessDaysSince(fromDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  let count = 0;
  let current = new Date(start);
  while (current < today) {
    current = addDays(current, 1);
    if (!isWeekend(current)) count++;
  }
  return count;
}

const DEADLINE_DAYS = 3;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

interface RegistrationStep {
  label: string;
  done: boolean;
}

function getRegistrationSteps(client: any, hasAnamnese: boolean): RegistrationStep[] {
  const steps: RegistrationStep[] = [
    { label: 'Dados pessoais', done: Boolean(client.name && client.phone) },
    { label: 'Anamnese', done: hasAnamnese },
    { label: 'Financeiro', done: Boolean(client.monthly_value && Number(client.monthly_value) > 0 && client.payment_type) },
    { label: 'Plano alimentar', done: false },
  ];
  return steps;
}

function getProgressPercent(steps: RegistrationStep[]): number {
  const done = steps.filter(s => s.done).length;
  return Math.round((done / steps.length) * 100);
}

type PriorityLevel = 'overdue' | 'today' | 'normal';

function getPriority(remaining: number): PriorityLevel {
  if (remaining < 0) return 'overdue';
  if (remaining === 0) return 'today';
  return 'normal';
}

const priorityColors: Record<PriorityLevel, string> = {
  overdue: 'border-l-red-500',
  today: 'border-l-yellow-500',
  normal: 'border-l-muted-foreground/30',
};

const priorityBadge: Record<PriorityLevel, { className: string; label: (n: number) => string }> = {
  overdue: {
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
    label: (n) => `${Math.abs(n)}d atrasado`,
  },
  today: {
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    label: () => 'Último dia',
  },
  normal: {
    className: 'bg-muted text-muted-foreground border-border',
    label: (n) => `${n}d restante${n > 1 ? 's' : ''}`,
  },
};

export function ActionCenterPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: pendingPlans = [], isLoading: loadingPlans } = usePendingMealPlans();
  const { data: unlinkedAnamnese = [], isLoading: loadingUnlinked } = useUnlinkedAnamneseForMealPlan();
  const markAsSent = useMarkMealPlanSent();

  const [mealPlansOpen, setMealPlansOpen] = useState(true);
  const [checkinsOpen, setCheckinsOpen] = useState(true);
  const [expiringOpen, setExpiringOpen] = useState(true);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || '';

  // Pending registrations (incomplete setup after anamnese)
  const { data: pendingRegistrations = [], isLoading: loadingRegistrations } = useQuery({
    queryKey: ['pending-registrations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, email, phone, created_at, plan_type, service_type, monthly_value, payment_type, registration_source')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      return (clients || []) as any[];
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Checkin feedbacks pending admin review
  const { data: pendingCheckinFeedbacks = [], isLoading: loadingCheckins } = useQuery({
    queryKey: ['pending_checkins_dashboard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('checkin_feedbacks')
        .select('id, checkin_response_id, status, created_at, clients!inner(id, name, is_active, is_frozen), checkin_responses(submitted_at)')
        .in('status', ['pending', 'approved'])
        .eq('clients.is_active', true)
        .eq('clients.is_frozen', false)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    refetchInterval: 30000,
  });

  // Expiring plans (≤15 days)
  const { data: expiringAthletes = [], isLoading: loadingExpiring } = useQuery({
    queryKey: ['expiring-athletes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const today = new Date();
      const limit = format(addDays(today, 15), 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');

      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, end_date, plan_type')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('is_frozen', false)
        .lte('end_date', limit)
        .gte('end_date', todayStr)
        .order('end_date');

      return (clients || []).map((c: any) => ({
        ...c,
        days_left: differenceInCalendarDays(new Date(c.end_date), today),
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 300000,
  });

  // Build meal plan items with priority
  const mealPlanItems = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      clientId: string;
      remaining: number;
      priority: PriorityLevel;
      hasAnamnese: boolean;
      anamneseResponseId: string | null;
      steps: RegistrationStep[];
      progressPercent: number;
      isRegistrationIncomplete: boolean;
      referenceDate: Date;
      type: 'linked' | 'unlinked';
    }> = [];

    for (const plan of pendingPlans) {
      const refDate = plan.anamnese_submitted_at
        ? parseISO(plan.anamnese_submitted_at)
        : parseISO(plan.created_at);
      const elapsed = businessDaysSince(refDate);
      const remaining = DEADLINE_DAYS - elapsed;

      const clientData = pendingRegistrations.find((c: any) => c.id === plan.client_id);
      const steps = getRegistrationSteps(clientData || {}, Boolean(plan.anamnese_submitted_at));
      const progressPercent = getProgressPercent(steps);
      const isIncomplete = !steps[0].done || !steps[2].done;

      items.push({
        id: plan.id,
        name: plan.client_name,
        clientId: plan.client_id,
        remaining,
        priority: getPriority(remaining),
        hasAnamnese: Boolean(plan.anamnese_submitted_at),
        anamneseResponseId: plan.anamnese_response_id,
        steps,
        progressPercent,
        isRegistrationIncomplete: isIncomplete,
        referenceDate: refDate,
        type: 'linked',
      });
    }

    for (const item of unlinkedAnamnese) {
      const refDate = parseISO(item.submitted_at);
      const elapsed = businessDaysSince(refDate);
      const remaining = DEADLINE_DAYS - elapsed;

      items.push({
        id: item.id,
        name: item.respondent_name || 'Sem nome',
        clientId: '',
        remaining,
        priority: getPriority(remaining),
        hasAnamnese: true,
        anamneseResponseId: item.id,
        steps: [
          { label: 'Dados pessoais', done: false },
          { label: 'Anamnese', done: true },
          { label: 'Financeiro', done: false },
          { label: 'Plano alimentar', done: false },
        ],
        progressPercent: 25,
        isRegistrationIncomplete: true,
        referenceDate: refDate,
        type: 'unlinked',
      });
    }

    items.sort((a, b) => a.remaining - b.remaining);
    return items;
  }, [pendingPlans, unlinkedAnamnese, pendingRegistrations]);

  const checkinItems = useMemo(() => {
    return pendingCheckinFeedbacks.map((f: any) => {
      const submittedAt = f.checkin_responses?.submitted_at
        ? parseISO(f.checkin_responses.submitted_at)
        : parseISO(f.created_at);
      const daysSince = differenceInCalendarDays(new Date(), submittedAt);
      return {
        id: f.id,
        responseId: f.checkin_response_id,
        name: f.clients?.name || 'N/A',
        daysSince,
        submittedAt,
      };
    }).sort((a: any, b: any) => b.daysSince - a.daysSince);
  }, [pendingCheckinFeedbacks]);

  const isLoading = loadingPlans || loadingUnlinked || loadingCheckins || loadingExpiring || loadingRegistrations;
  const totalActions = mealPlanItems.length + checkinItems.length + expiringAthletes.length;

  if (isLoading) {
    return (
      <div className="space-y-6 py-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {getGreeting()}{firstName ? `, ${firstName}` : ''}.
        </h1>
        {totalActions > 0 ? (
          <p className="text-muted-foreground mt-1">
            Hoje {totalActions === 1 ? 'existe' : 'existem'}{' '}
            <span className="font-medium text-foreground">{totalActions} {totalActions === 1 ? 'ação aguardando' : 'ações aguardando'}</span> você.
          </p>
        ) : (
          <p className="text-muted-foreground mt-1">Nenhuma ação pendente. Tudo em dia!</p>
        )}
      </div>

      {totalActions === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-6">
          <CheckCircle className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="font-medium">Mesa limpa!</p>
            <p className="text-sm text-muted-foreground">Todas as ações foram concluídas.</p>
          </div>
        </div>
      )}

      {/* Section: Planos Alimentares */}
      {mealPlanItems.length > 0 && (
        <Section
          icon={<UtensilsCrossed className="h-4 w-4" />}
          title="Planos Alimentares"
          count={mealPlanItems.length}
          open={mealPlansOpen}
          onToggle={() => setMealPlansOpen(v => !v)}
        >
          <div className="space-y-3">
            {mealPlanItems.map(item => {
              const pb = priorityBadge[item.priority];
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border border-border/60 bg-card p-4 border-l-4 ${priorityColors[item.priority]} transition-all hover:shadow-sm`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{item.name}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pb.className}`}>
                          {pb.label(item.remaining)}
                        </Badge>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium w-8 text-right">
                            {item.progressPercent}%
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {item.steps.map(step => (
                            <span
                              key={step.label}
                              className={`text-[10px] flex items-center gap-0.5 ${step.done ? 'text-emerald-500' : 'text-muted-foreground/60'}`}
                            >
                              {step.done ? '✓' : '✗'} {step.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {item.isRegistrationIncomplete ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8"
                          onClick={() => {
                            if (item.type === 'unlinked') navigate(`/anamnese-response/${item.anamneseResponseId}`);
                            else navigate(`/clients/${item.clientId}`);
                          }}
                        >
                          Finalizar cadastro
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => {
                            if (item.anamneseResponseId) navigate(`/anamnese-response/${item.anamneseResponseId}`);
                            else navigate(`/clients/${item.clientId}`);
                          }}
                        >
                          Criar plano alimentar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Section: Check-ins */}
      {checkinItems.length > 0 && (
        <Section
          icon={<MessageSquare className="h-4 w-4" />}
          title="Check-ins"
          count={checkinItems.length}
          open={checkinsOpen}
          onToggle={() => setCheckinsOpen(v => !v)}
        >
          <div className="space-y-3">
            {checkinItems.map((item: any) => (
              <div
                key={item.id}
                className={`rounded-lg border border-border/60 bg-card p-4 border-l-4 ${
                  item.daysSince >= 3
                    ? 'border-l-red-500'
                    : item.daysSince >= 1
                    ? 'border-l-yellow-500'
                    : 'border-l-muted-foreground/30'
                } transition-all hover:shadow-sm`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <span className="font-medium text-sm block">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.daysSince === 0
                        ? 'Respondeu hoje'
                        : `Aguardando há ${item.daysSince} dia${item.daysSince > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="text-xs h-8 shrink-0"
                    onClick={() => navigate(`/checkin-review/${item.responseId}`)}
                  >
                    Responder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Section: Planos vencendo */}
      {expiringAthletes.length > 0 && (
        <Section
          icon={<RefreshCw className="h-4 w-4" />}
          title="Planos vencendo"
          count={expiringAthletes.length}
          open={expiringOpen}
          onToggle={() => setExpiringOpen(v => !v)}
        >
          <div className="space-y-3">
            {expiringAthletes.map((a: any) => (
              <div
                key={a.id}
                className={`rounded-lg border border-border/60 bg-card p-4 border-l-4 ${
                  a.days_left <= 3
                    ? 'border-l-red-500'
                    : a.days_left <= 7
                    ? 'border-l-yellow-500'
                    : 'border-l-muted-foreground/30'
                } transition-all hover:shadow-sm`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <span className="font-medium text-sm block">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.days_left === 0
                        ? 'Vence hoje'
                        : `${a.days_left} dia${a.days_left > 1 ? 's' : ''} restante${a.days_left > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="text-xs h-8 shrink-0"
                    onClick={() => navigate(`/clients/${a.id}`)}
                  >
                    Renovar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left mb-3 group"
      >
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-5 justify-center">
          {count}
        </Badge>
        <span className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && children}
    </section>
  );
}
