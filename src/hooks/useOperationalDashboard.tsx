/**
 * ETAPA 2B — Fonte ÚNICA das operações do dashboard.
 *
 * Reúne todas as pendências reais do sistema (check-in, plano alimentar,
 * anamnese, convite de consulta, renovação e tarefas) em um único fluxo
 * normalizado, já filtrado pelo estado operacional canônico do atleta
 * (`getAthleteState`) e com SLA em dias úteis (`businessDays` + feriados).
 *
 * Nada é escondido por "dismiss": um item some quando é resolvido na origem.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHolidays } from '@/hooks/useHolidays';
import { getAthleteState } from '@/lib/athleteState';
import {
  dedupeOperations,
  groupOperations,
  slaDueDate,
  sortOperations,
  toDateKey,
  SLA_BUSINESS_DAYS,
  type Operation,
} from '@/lib/dashboardOperations';
import type { HolidaySet } from '@/lib/businessDays';

interface DashboardClient {
  id: string;
  name: string;
  phone: string | null;
  end_date: string | null;
  state: ReturnType<typeof getAthleteState>;
}

async function fetchOperations(userId: string, holidays: HolidaySet): Promise<Operation[]> {
  const today = new Date();
  const todayKey = toDateKey(today);
  const ops: Operation[] = [];

  // ---------- Atletas + estado canônico ----------
  const { data: rawClients, error: clientsError } = await supabase
    .from('clients')
    .select(
      'id, name, phone, is_active, is_frozen, archived_at, ended_at, end_date, start_date, service_type, has_checkin, has_consultations, athlete_status',
    )
    .eq('user_id', userId);
  if (clientsError) throw clientsError;

  const clients: DashboardClient[] = (rawClients || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? null,
    end_date: c.end_date ?? null,
    state: getAthleteState(c, today),
  }));
  const byId = new Map(clients.map((c) => [c.id, c]));
  const operational = clients.filter((c) => c.state.canAppearInOperationalQueues);
  const operationalIds = operational.map((c) => c.id);

  // ---------- 1. Check-ins respondidos sem devolutiva ----------
  if (operationalIds.length) {
    const { data: responses } = await supabase
      .from('checkin_responses')
      .select('id, client_id, submitted_at')
      .in('client_id', operationalIds)
      .order('submitted_at', { ascending: false })
      .limit(200);

    const ids = (responses || []).map((r: any) => r.id);
    let answered = new Set<string>();
    if (ids.length) {
      const { data: feedbacks } = await supabase
        .from('checkin_feedbacks')
        .select('checkin_response_id')
        .in('checkin_response_id', ids);
      answered = new Set((feedbacks || []).map((f: any) => f.checkin_response_id));
    }

    for (const r of responses || []) {
      const row = r as any;
      if (answered.has(row.id)) continue;
      const c = byId.get(row.client_id);
      if (!c) continue;
      ops.push({
        id: `checkin_review:${row.id}`,
        kind: 'checkin_review',
        clientId: row.client_id,
        clientName: c.name,
        clientPhone: c.phone,
        title: 'Devolutiva do check-in',
        dueDate: slaDueDate(row.submitted_at, SLA_BUSINESS_DAYS.checkin_review!, holidays),
        createdAt: row.submitted_at,
        route: `/checkin-review/${row.id}`,
        sourceType: 'checkin_response',
        sourceId: row.id,
      });
    }
  }

  // ---------- 2. Planos alimentares pendentes ----------
  const { data: pendingPlans } = await supabase
    .from('meal_plan_status')
    .select('id, client_id, created_at')
    .eq('user_id', userId)
    .eq('status', 'pending');

  const planClientIds = (pendingPlans || []).map((p: any) => p.client_id);
  const anamneseByClient = new Map<string, { id: string; submitted_at: string }>();
  if (planClientIds.length) {
    const { data: anamneses } = await supabase
      .from('anamnese_responses')
      .select('id, client_id, submitted_at')
      .in('client_id', planClientIds)
      .order('submitted_at', { ascending: false });
    for (const a of anamneses || []) {
      const row = a as any;
      if (row.client_id && !anamneseByClient.has(row.client_id)) {
        anamneseByClient.set(row.client_id, { id: row.id, submitted_at: row.submitted_at });
      }
    }
  }

  for (const p of pendingPlans || []) {
    const row = p as any;
    const c = byId.get(row.client_id);
    if (!c || !c.state.canReceiveMealPlanActions) continue;
    const anamnese = anamneseByClient.get(row.client_id);
    const ref = anamnese?.submitted_at || row.created_at;
    ops.push({
      id: `meal_plan:${row.id}`,
      kind: 'meal_plan',
      clientId: row.client_id,
      clientName: c.name,
      clientPhone: c.phone,
      title: 'Montar e enviar plano alimentar',
      subtitle: anamnese ? 'Anamnese respondida' : 'Sem anamnese vinculada',
      dueDate: slaDueDate(ref, SLA_BUSINESS_DAYS.meal_plan!, holidays),
      createdAt: ref,
      route: `/meal-plans/${row.client_id}`,
      sourceType: 'meal_plan_status',
      sourceId: row.id,
    });
  }

  // ---------- 3. Anamneses sem atleta vinculado ----------
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: unlinked } = await supabase
    .from('anamnese_responses')
    .select('id, respondent_name, respondent_email, submitted_at')
    .is('client_id', null)
    .gte('submitted_at', cutoff)
    .order('submitted_at', { ascending: false });

  for (const a of unlinked || []) {
    const row = a as any;
    ops.push({
      id: `anamnese_review:${row.id}`,
      kind: 'anamnese_review',
      clientId: null,
      clientName: row.respondent_name || row.respondent_email || 'Sem nome',
      clientPhone: null,
      title: 'Anamnese sem atleta vinculado',
      subtitle: 'Vincular ou cadastrar o atleta',
      dueDate: slaDueDate(row.submitted_at, SLA_BUSINESS_DAYS.anamnese_review!, holidays),
      createdAt: row.submitted_at,
      route: `/anamnese-response/${row.id}`,
      sourceType: 'anamnese_response',
      sourceId: row.id,
    });
  }

  // ---------- 4. Convites de consulta a enviar ----------
  const { data: schedules } = await supabase
    .from('consultation_schedules')
    .select('id, client_id, send_link_date, scheduled_date')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .not('send_link_date', 'is', null)
    .lte('send_link_date', toDateKey(new Date(Date.now() + 7 * 86_400_000)))
    .order('send_link_date');

  for (const s of schedules || []) {
    const row = s as any;
    const c = byId.get(row.client_id);
    if (!c || !c.state.canReceiveConsultationInvites) continue;
    ops.push({
      id: `booking_invite:${row.id}`,
      kind: 'booking_invite',
      clientId: row.client_id,
      clientName: c.name,
      clientPhone: c.phone,
      title: 'Enviar link de agendamento',
      subtitle: row.scheduled_date ? `Consulta prevista para ${row.scheduled_date}` : undefined,
      dueDate: row.send_link_date,
      createdAt: null,
      route: '/scheduling/periodicity',
      sourceType: 'consultation_schedule',
      sourceId: row.id,
    });
  }

  // ---------- 4b. Revisão estrutural do plano (ETAPA 5A — ciclo fixo de 28 dias) ----------
  // Só existe para atletas SEM consulta recorrente. Quando o check-in do ciclo é
  // o próprio check-in de revisão, o dashboard mostra UMA pendência só:
  // "Revisão do plano" (a devolutiva do check-in é feita dentro dela).
  const { data: reviews } = await (supabase as any)
    .from('nutrition_reviews')
    .select('id, client_id, scheduled_for, status, missing_information, checkin_dispatch_id, checkin_response_id')
    .eq('user_id', userId)
    .in('status', ['scheduled', 'pending', 'waiting_information', 'in_review'])
    .lte('scheduled_for', todayKey);

  const structuralResponseIds = new Set<string>();

  for (const rv of reviews || []) {
    const row = rv as any;
    const c = byId.get(row.client_id);
    if (!c || !c.state.canReceiveMealPlanActions) continue;
    if (row.checkin_response_id) structuralResponseIds.add(row.checkin_response_id);
    const checkinNote = row.checkin_response_id
      ? 'Check-in de revisão respondido'
      : row.checkin_dispatch_id
        ? 'Check-in de revisão ainda não respondido'
        : undefined;
    ops.push({
      id: `nutrition_review:${row.id}`,
      kind: 'nutrition_review',
      clientId: row.client_id,
      clientName: c.name,
      clientPhone: c.phone,
      title: 'Revisão do plano (ciclo de 4 semanas)',
      subtitle: row.missing_information ? `Falta: ${row.missing_information}` : checkinNote,
      dueDate: row.scheduled_for,
      createdAt: null,
      route: row.checkin_response_id ? `/checkin-review/${row.checkin_response_id}` : '/adjustments',
      sourceType: 'nutrition_review',
      sourceId: row.id,
    });
  }

  // Evita duplicidade: "Devolutiva do check-in" + "Revisão do plano" do MESMO check-in.
  if (structuralResponseIds.size) {
    for (let i = ops.length - 1; i >= 0; i--) {
      const op = ops[i];
      if (op.kind === 'checkin_review' && op.sourceId && structuralResponseIds.has(op.sourceId)) {
        ops.splice(i, 1);
      }
    }
  }



  // ---------- 5. Renovações (plano vencendo em até 15 dias) ----------
  const renewalLimit = toDateKey(new Date(Date.now() + 15 * 86_400_000));
  for (const c of operational) {
    if (!c.end_date) continue;
    const end = c.end_date.slice(0, 10);
    if (end < todayKey || end > renewalLimit) continue;
    ops.push({
      id: `renewal:${c.id}:${end}`,
      kind: 'renewal',
      clientId: c.id,
      clientName: c.name,
      clientPhone: c.phone,
      title: 'Plano vencendo — tratar renovação',
      subtitle: `Vence em ${end.split('-').reverse().join('/')}`,
      dueDate: end,
      createdAt: null,
      route: `/clients/${c.id}`,
      sourceType: 'client_renewal',
      sourceId: c.id,
    });
  }

  // ---------- 6. Tarefas (manuais e legadas) ----------
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, client_id, due_date, completion_mode, source_type, source_id, priority')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .in('status', ['pending', 'in_progress'])
    .order('due_date', { nullsFirst: false });

  for (const t of tasks || []) {
    const row = t as any;
    const c = row.client_id ? byId.get(row.client_id) : null;
    if (row.client_id && (!c || !c.state.canAppearInOperationalQueues)) continue;
    const legacy = row.completion_mode === 'derived';
    ops.push({
      id: `${legacy ? 'legacy_task' : 'manual_task'}:${row.id}`,
      kind: legacy ? 'legacy_task' : 'manual_task',
      clientId: row.client_id ?? null,
      clientName: c?.name || 'Sem atleta',
      clientPhone: c?.phone ?? null,
      title: row.title,
      subtitle: row.description || undefined,
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
      createdAt: null,
      route: '/tasks',
      sourceType: row.source_type ?? null,
      sourceId: row.source_id ?? null,
    });
  }

  return sortOperations(dedupeOperations(ops));
}

export function useOperationalDashboard() {
  const { user } = useAuth();
  const { data: holidays } = useHolidays();

  const query = useQuery({
    queryKey: ['operational-dashboard', user?.id, holidays ? holidays.size : 0],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: () => fetchOperations(user!.id, holidays ?? new Set()),
  });

  const all = query.data ?? [];
  const operations = all.filter((o) => o.kind !== 'legacy_task');
  const legacy = all.filter((o) => o.kind === 'legacy_task');
  const groups = groupOperations(operations);

  return {
    operations,
    legacy,
    groups,
    total: operations.length,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    holidays: holidays ?? new Set<string>(),
  };
}
