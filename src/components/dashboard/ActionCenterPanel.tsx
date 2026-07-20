import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle, ChevronDown, ChevronUp, UtensilsCrossed,
  MessageSquare, RefreshCw, ClipboardList, Check, UserPlus,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePendingMealPlans, useUnlinkedAnamneseForMealPlan } from '@/hooks/useMealPlanStatus';
import { parseISO, addDays, isWeekend, differenceInCalendarDays, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

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
  return [
    { label: 'Dados pessoais', done: Boolean(client.name && client.phone) },
    { label: 'Anamnese', done: hasAnamnese },
    { label: 'Financeiro', done: Boolean(client.monthly_value && Number(client.monthly_value) > 0 && client.payment_type) },
    { label: 'Plano alimentar', done: false },
  ];
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
  const { data: pendingPlans = [], isLoading: loadingPlans } = usePendingMealPlans();
  const { data: unlinkedAnamnese = [], isLoading: loadingUnlinked } = useUnlinkedAnamneseForMealPlan();

  const [mealPlansOpen, setMealPlansOpen] = useState(false);
  const [anamnesesOpen, setAnamnesesOpen] = useState(false);
  const [checkinsOpen, setCheckinsOpen] = useState(false);
  const [expiringOpen, setExpiringOpen] = useState(false);
  const [pendingRegOpen, setPendingRegOpen] = useState(false);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || '';

  // Dismiss system: items stay dismissed permanently
  const DISMISS_KEY = 'dashboard-dismissed-v3';
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, number>;
    } catch { return {}; }
  });
  const isDismissed = (key: string) => key in dismissed;
  const dismiss = useCallback((key: string) => {
    setDismissed(prev => {
      const next = { ...prev, [key]: Date.now() };
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    toast.success('Concluído!');
  }, []);

  // All clients for registration progress
  const { data: allClients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['dashboard-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, monthly_value, payment_type')
        .eq('user_id', user.id)
        .eq('is_active', true);
      return (data || []) as any[];
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Recent anamnese responses (within deadline window) for admin's clients
  const { data: recentAnamneses = [], isLoading: loadingAnamneses } = useQuery({
    queryKey: ['dashboard-anamneses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Get admin's client IDs
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (!clients?.length) return [];

      const clientMap = new Map(clients.map(c => [c.id, c.name]));
      const clientIds = clients.map(c => c.id);

      // Get anamnese responses for these clients, recent ones
      const cutoff = format(addDays(new Date(), -10), 'yyyy-MM-dd');
      const { data: responses } = await supabase
        .from('anamnese_responses')
        .select('id, client_id, respondent_name, submitted_at')
        .in('client_id', clientIds)
        .gte('submitted_at', cutoff)
        .order('submitted_at', { ascending: false });

      // Also get unlinked ones (no client_id)
      const { data: unlinkedResponses } = await supabase
        .from('anamnese_responses')
        .select('id, client_id, respondent_name, respondent_email, submitted_at')
        .is('client_id', null)
        .gte('submitted_at', cutoff)
        .order('submitted_at', { ascending: false });

      const items = [
        ...(responses || []).map(r => ({
          id: r.id,
          name: clientMap.get(r.client_id!) || r.respondent_name || 'Sem nome',
          clientId: r.client_id,
          submittedAt: r.submitted_at,
        })),
        ...(unlinkedResponses || []).map(r => ({
          id: r.id,
          name: r.respondent_name || r.respondent_email || 'Sem nome',
          clientId: null as string | null,
          submittedAt: r.submitted_at,
        })),
      ];

      return items.map(item => {
        const refDate = parseISO(item.submittedAt);
        const elapsed = businessDaysSince(refDate);
        const remaining = DEADLINE_DAYS - elapsed;
        return { ...item, remaining, priority: getPriority(remaining), refDate };
      }).sort((a, b) => a.remaining - b.remaining);
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Checkin responses without admin feedback
  const { data: unansweredCheckins = [], isLoading: loadingCheckins } = useQuery({
    queryKey: ['dashboard-unanswered-checkins', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get admin's active clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('is_frozen', false);
      if (!clients?.length) return [];

      const clientMap = new Map(clients.map(c => [c.id, c.name]));
      const clientIds = clients.map(c => c.id);

      // Get recent checkin responses
      const { data: responses } = await supabase
        .from('checkin_responses')
        .select('id, client_id, submitted_at')
        .in('client_id', clientIds)
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (!responses?.length) return [];

      // Get feedback IDs to find which responses already have feedback
      const responseIds = responses.map(r => r.id);
      const { data: feedbacks } = await supabase
        .from('checkin_feedbacks')
        .select('checkin_response_id')
        .in('checkin_response_id', responseIds);

      const answeredIds = new Set((feedbacks || []).map(f => f.checkin_response_id));

      return responses
        .filter(r => !answeredIds.has(r.id))
        .map(r => {
          const daysSince = differenceInCalendarDays(new Date(), parseISO(r.submitted_at));
          return {
            id: r.id,
            name: clientMap.get(r.client_id) || 'N/A',
            clientId: r.client_id,
            daysSince,
            submittedAt: r.submitted_at,
          };
        })
        .sort((a, b) => b.daysSince - a.daysSince);
    },
    enabled: !!user?.id,
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

  // Clients auto-created from anamnese with incomplete registration
  const { data: pendingRegistrations = [], isLoading: loadingPendingReg } = useQuery({
    queryKey: ['dashboard-pending-registrations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, email, phone, monthly_value, payment_type, plan_type, service_type, plan_duration, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('registration_source', 'anamnese_auto');
      if (!clients?.length) return [];

      return clients
        .map((c: any) => {
          const missing: string[] = [];
          if (!c.phone) missing.push('Telefone');
          if (!c.monthly_value || Number(c.monthly_value) <= 0) missing.push('Valor mensal');
          if (!c.plan_type) missing.push('Tipo de plano');
          if (!c.service_type) missing.push('Tipo de serviço');
          if (!c.plan_duration) missing.push('Duração do plano');
          if (!c.payment_type) missing.push('Forma de pagamento');
          if (missing.length === 0) return null;
          return { ...c, missingFields: missing };
        })
        .filter(Boolean) as any[];
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Build meal plan items
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
      type: 'linked' | 'unlinked';
    }> = [];

    for (const plan of pendingPlans) {
      const refDate = plan.anamnese_submitted_at
        ? parseISO(plan.anamnese_submitted_at)
        : parseISO(plan.created_at);
      const elapsed = businessDaysSince(refDate);
      const remaining = DEADLINE_DAYS - elapsed;

      const clientData = allClients.find((c: any) => c.id === plan.client_id);
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
        type: 'unlinked',
      });
    }

    items.sort((a, b) => a.remaining - b.remaining);
    return items;
  }, [pendingPlans, unlinkedAnamnese, allClients]);

  const visibleMealPlans = mealPlanItems.filter(i => !isDismissed(`mp:${i.id}`));
  const visibleAnamneses = recentAnamneses.filter((i: any) => !isDismissed(`an:${i.id}`));
  const visibleCheckins = unansweredCheckins.filter((i: any) => !isDismissed(`ck:${i.id}`));
  const visibleExpiring = expiringAthletes.filter((i: any) => !isDismissed(`ex:${i.id}`));
  const visiblePendingReg = pendingRegistrations.filter((i: any) => !isDismissed(`pr:${i.id}`));

  const isLoading = loadingPlans || loadingUnlinked || loadingCheckins || loadingExpiring || loadingClients || loadingAnamneses || loadingPendingReg;
  const totalActions = visibleMealPlans.length + visibleAnamneses.length + visibleCheckins.length + visibleExpiring.length + visiblePendingReg.length;

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
      {visibleMealPlans.length > 0 && (
        <Section
          icon={<UtensilsCrossed className="h-4 w-4" />}
          title="Planos Alimentares"
          count={visibleMealPlans.length}
          open={mealPlansOpen}
          onToggle={() => setMealPlansOpen(v => !v)}
        >
          <div className="space-y-3">
            {visibleMealPlans.map(item => {
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
                    <div className="shrink-0 flex items-center gap-1">
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
                      <DoneButton onClick={() => dismiss(`mp:${item.id}`)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Section: Anamneses Pendentes */}
      {visibleAnamneses.length > 0 && (
        <Section
          icon={<ClipboardList className="h-4 w-4" />}
          title="Anamneses Pendentes"
          count={visibleAnamneses.length}
          open={anamnesesOpen}
          onToggle={() => setAnamnesesOpen(v => !v)}
        >
          <div className="space-y-3">
            {visibleAnamneses.map((item: any) => {
              const pb = priorityBadge[item.priority as PriorityLevel];
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border border-border/60 bg-card p-4 border-l-4 ${priorityColors[item.priority as PriorityLevel]} transition-all hover:shadow-sm`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <span className="font-medium text-sm block">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Preenchida há {businessDaysSince(item.refDate)} dia{businessDaysSince(item.refDate) !== 1 ? 's' : ''} útei{businessDaysSince(item.refDate) !== 1 ? 's' : 'l'}
                        </span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pb.className}`}>
                          {pb.label(item.remaining)}
                        </Badge>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      <Button
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => navigate(`/anamnese-response/${item.id}`)}
                      >
                        Ver anamnese
                      </Button>
                      <DoneButton onClick={() => dismiss(`an:${item.id}`)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Section: Check-ins sem Resposta */}
      {visibleCheckins.length > 0 && (
        <Section
          icon={<MessageSquare className="h-4 w-4" />}
          title="Check-ins sem Resposta"
          count={visibleCheckins.length}
          open={checkinsOpen}
          onToggle={() => setCheckinsOpen(v => !v)}
        >
          <div className="space-y-3">
            {visibleCheckins.map((item: any) => (
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
                  <div className="shrink-0 flex items-center gap-1">
                    <Button
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => navigate(`/checkin-review/${item.id}`)}
                    >
                      Responder
                    </Button>
                    <DoneButton onClick={() => dismiss(`ck:${item.id}`)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Section: Cadastros Pendentes */}
      {visiblePendingReg.length > 0 && (
        <Section
          icon={<UserPlus className="h-4 w-4" />}
          title="Cadastros Pendentes"
          count={visiblePendingReg.length}
          open={pendingRegOpen}
          onToggle={() => setPendingRegOpen(v => !v)}
        >
          <div className="space-y-3">
            {visiblePendingReg.map((item: any) => (
              <div
                key={item.id}
                className="rounded-lg border border-border/60 bg-card p-4 border-l-4 border-l-yellow-500 transition-all hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <span className="font-medium text-sm block">{item.name}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.missingFields.map((f: string) => (
                        <Badge key={f} variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                          {f}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Cadastrado automaticamente via anamnese</span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => navigate(`/clients/${item.id}`)}
                    >
                      Completar cadastro
                    </Button>
                    <DoneButton onClick={() => dismiss(`pr:${item.id}`)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Section: Planos vencendo */}
      {visibleExpiring.length > 0 && (
        <Section
          icon={<RefreshCw className="h-4 w-4" />}
          title="Planos vencendo"
          count={visibleExpiring.length}
          open={expiringOpen}
          onToggle={() => setExpiringOpen(v => !v)}
        >
          <div className="space-y-3">
            {visibleExpiring.map((a: any) => (
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
                  <div className="shrink-0 flex items-center gap-1">
                    <Button
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => navigate(`/clients/${a.id}`)}
                    >
                      Renovar
                    </Button>
                    <DoneButton onClick={() => dismiss(`ex:${a.id}`)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            <Check className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top"><p className="text-xs">Marcar como feito</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
