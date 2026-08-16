/**
 * ETAPA 5C — Área autenticada do atleta.
 *
 * Este hook é APENAS CONSUMIDOR das fontes canônicas já existentes:
 *  - Plano alimentar  -> meal_plan_versions (status = 'published')   [Etapa 3A]
 *  - Check-ins        -> checkin_dispatches + checkin_responses      [Etapa 3B]
 *  - Feedback         -> checkin_feedbacks (publication_status published)
 *  - Consultas        -> appointments + consultation_schedules + booking_links
 *  - Prova-alvo       -> np_athlete_races (is_active)
 *
 * NÃO cria novas fontes de verdade, não grava nada, não duplica dados.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getAthleteState, type AthleteStateInput } from '@/lib/athleteState';

const db = supabase as any;

export interface AthletePendingCheckin {
  id: string;
  link: string | null;
  sentAt: string | null;
  dueAt: string | null;
  occurrenceDate: string | null;
  isLate: boolean;
}

export interface AthleteFeedbackItem {
  id: string;
  responseId: string | null;
  text: string;
  publishedAt: string | null;
}

export interface AthleteAppointmentItem {
  id: string;
  date: string;
  time: string | null;
  status: string;
  meetLink: string | null;
}

export type AthleteActionKind =
  | 'anamnese'
  | 'checkin'
  | 'agendar'
  | 'consulta'
  | 'feedback'
  | 'plano';

export interface AthleteAction {
  kind: AthleteActionKind;
  title: string;
  description: string;
  ctaLabel: string;
  /** Link externo (form público / booking / meet). */
  href?: string | null;
  /** Tela interna do app do atleta. */
  screen?: 'checkins' | 'consultas' | 'plano' | 'perfil';
  urgent?: boolean;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function useAthleteAreaData(clientId?: string | null) {
  return useQuery({
    queryKey: ['athlete-area', clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [dispatchesRes, responsesRes, feedbacksRes, appointmentsRes, schedulesRes, bookingRes, raceRes, planRes] =
        await Promise.all([
          db
            .from('checkin_dispatches')
            .select('id, status, link_checkin, sent_at, due_at, occurrence_date, response_deadline')
            .eq('client_id', clientId)
            .order('sent_at', { ascending: false, nullsFirst: false })
            .limit(20),
          db
            .from('checkin_responses')
            .select('id, submitted_at, dispatch_id')
            .eq('client_id', clientId)
            .order('submitted_at', { ascending: false })
            .limit(30),
          db
            .from('checkin_feedbacks')
            .select('id, checkin_response_id, final_feedback, published_at, publication_status')
            .eq('client_id', clientId)
            .eq('publication_status', 'published')
            .order('published_at', { ascending: false })
            .limit(20),
          db
            .from('appointments')
            .select('id, appointment_date, appointment_time, status, google_meet_link')
            .eq('client_id', clientId)
            .order('appointment_date', { ascending: true })
            .limit(50),
          db
            .from('consultation_schedules')
            .select('id, scheduled_date, status, confirmation_status, appointment_id')
            .eq('client_id', clientId)
            .order('scheduled_date', { ascending: true })
            .limit(20),
          db
            .from('booking_links')
            .select('id, token, active, expires_at')
            .eq('client_id', clientId)
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1),
          db
            .from('np_athlete_races')
            .select('id, race_name, race_date, race_distance_km, race_type')
            .eq('client_id', clientId)
            .eq('is_active', true)
            .order('race_date', { ascending: true })
            .limit(1),
          db
            .from('meal_plan_versions')
            .select('id, published_at, version_number')
            .eq('client_id', clientId)
            .eq('status', 'published')
            .limit(1),
        ]);

      const today = todayISO();
      const now = Date.now();

      const responses = responsesRes.data || [];
      const lastResponseAt: string | null = responses[0]?.submitted_at ?? null;

      // Check-in pendente = dispatch enviado sem resposta posterior ao envio.
      const dispatches = dispatchesRes.data || [];
      const answeredDispatchIds = new Set(responses.map((r: any) => r.dispatch_id).filter(Boolean));
      const pending: AthletePendingCheckin | null = (() => {
        const candidate = dispatches.find((d: any) => {
          if (!['sent', 'pending'].includes(String(d.status))) return false;
          if (answeredDispatchIds.has(d.id)) return false;
          if (d.sent_at && lastResponseAt && new Date(lastResponseAt) > new Date(d.sent_at)) return false;
          return true;
        });
        if (!candidate) return null;
        const due = candidate.response_deadline || candidate.due_at || null;
        return {
          id: candidate.id,
          link: candidate.link_checkin ?? null,
          sentAt: candidate.sent_at ?? null,
          dueAt: due,
          occurrenceDate: candidate.occurrence_date ?? null,
          isLate: !!due && new Date(due).getTime() < now,
        };
      })();

      const feedbacks: AthleteFeedbackItem[] = (feedbacksRes.data || [])
        .filter((f: any) => !!f.final_feedback)
        .map((f: any) => ({
          id: f.id,
          responseId: f.checkin_response_id ?? null,
          text: f.final_feedback as string,
          publishedAt: f.published_at ?? null,
        }));

      const allAppointments: AthleteAppointmentItem[] = (appointmentsRes.data || [])
        .filter((a: any) => a.status !== 'cancelled')
        .map((a: any) => ({
          id: a.id,
          date: a.appointment_date,
          time: a.appointment_time ?? null,
          status: a.status,
          meetLink: a.google_meet_link ?? null,
        }));
      const upcomingAppointments = allAppointments.filter((a) => a.date >= today);
      const pastAppointments = allAppointments.filter((a) => a.date < today).reverse();
      const nextAppointment = upcomingAppointments[0] ?? null;

      const schedules = schedulesRes.data || [];
      const awaitingSchedule = schedules.find(
        (s: any) => !s.appointment_id && !['completed', 'cancelled'].includes(String(s.status)),
      ) ?? null;

      const bookingLink = (bookingRes.data || [])[0] ?? null;
      const bookingValid =
        bookingLink && (!bookingLink.expires_at || new Date(bookingLink.expires_at).getTime() > now)
          ? bookingLink
          : null;

      const race = (raceRes.data || [])[0] ?? null;
      const publishedPlan = (planRes.data || [])[0] ?? null;

      return {
        pendingCheckin: pending,
        checkinHistory: dispatches,
        responses,
        feedbacks,
        upcomingAppointments,
        pastAppointments,
        nextAppointment,
        awaitingSchedule,
        bookingUrl: bookingValid ? `${window.location.origin}/booking/${bookingValid.token}` : null,
        race,
        publishedPlan,
      };
    },
  });
}

/** Estado de leitura local (não cria fonte de verdade no banco). */
function readKey(clientId: string, kind: string) {
  return `athlete-read:${kind}:${clientId}`;
}

export function getLastSeen(clientId?: string | null, kind = 'feedback'): number {
  if (!clientId) return 0;
  const raw = localStorage.getItem(readKey(clientId, kind));
  return raw ? Number(raw) || 0 : 0;
}

export function markSeen(clientId?: string | null, kind = 'feedback') {
  if (!clientId) return;
  localStorage.setItem(readKey(clientId, kind), String(Date.now()));
}

/**
 * Próximas ações do atleta, na ordem canônica de prioridade.
 * Atleta congelado/encerrado NÃO recebe ações operacionais.
 */
export function useAthleteActions(params: {
  client: AthleteStateInput | null | undefined;
  clientId?: string | null;
  anamnesePending?: boolean;
  data: ReturnType<typeof useAthleteAreaData>['data'];
}): { actions: AthleteAction[]; state: ReturnType<typeof getAthleteState> } {
  const { client, clientId, anamnesePending, data } = params;
  const state = useMemo(() => getAthleteState(client), [client]);

  const actions = useMemo<AthleteAction[]>(() => {
    const list: AthleteAction[] = [];
    if (!data) return list;

    if (anamnesePending) {
      list.push({
        kind: 'anamnese',
        title: 'Complete sua anamnese',
        description: 'É o primeiro passo para o seu nutricionista montar seu plano.',
        ctaLabel: 'Preencher agora',
        urgent: true,
      });
    }

    if (!state.isOperational) return list;

    if (data.pendingCheckin) {
      list.push({
        kind: 'checkin',
        title: data.pendingCheckin.isLate ? 'Check-in atrasado' : 'Check-in disponível',
        description: data.pendingCheckin.dueAt
          ? `Responda até ${new Date(data.pendingCheckin.dueAt).toLocaleDateString('pt-BR')}.`
          : 'Seu check-in está aberto para resposta.',
        ctaLabel: 'Responder check-in',
        href: data.pendingCheckin.link,
        screen: 'checkins',
        urgent: data.pendingCheckin.isLate,
      });
    }

    if (data.awaitingSchedule && data.bookingUrl && !data.nextAppointment) {
      list.push({
        kind: 'agendar',
        title: 'Agende sua consulta',
        description: 'Seu link de agendamento está liberado.',
        ctaLabel: 'Escolher horário',
        href: data.bookingUrl,
        screen: 'consultas',
      });
    }

    if (data.nextAppointment) {
      const d = new Date(`${data.nextAppointment.date}T12:00:00`);
      const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
      if (days <= 7) {
        list.push({
          kind: 'consulta',
          title: days <= 0 ? 'Consulta hoje' : `Consulta em ${days} dia${days > 1 ? 's' : ''}`,
          description: `${d.toLocaleDateString('pt-BR')}${data.nextAppointment.time ? ` às ${String(data.nextAppointment.time).slice(0, 5)}` : ''}`,
          ctaLabel: data.nextAppointment.meetLink ? 'Abrir link da consulta' : 'Ver detalhes',
          href: data.nextAppointment.meetLink,
          screen: 'consultas',
        });
      }
    }

    const lastSeenFeedback = getLastSeen(clientId, 'feedback');
    const newFeedback = data.feedbacks.find(
      (f) => f.publishedAt && new Date(f.publishedAt).getTime() > lastSeenFeedback,
    );
    if (newFeedback) {
      list.push({
        kind: 'feedback',
        title: 'Novo feedback do seu nutricionista',
        description: 'Resposta do seu último check-in já está disponível.',
        ctaLabel: 'Ler feedback',
        screen: 'checkins',
      });
    }

    const lastSeenPlan = getLastSeen(clientId, 'plano');
    if (data.publishedPlan?.published_at && new Date(data.publishedPlan.published_at).getTime() > lastSeenPlan) {
      list.push({
        kind: 'plano',
        title: 'Plano alimentar atualizado',
        description: `Publicado em ${new Date(data.publishedPlan.published_at).toLocaleDateString('pt-BR')}.`,
        ctaLabel: 'Ver plano',
        screen: 'plano',
      });
    }

    return list;
  }, [data, anamnesePending, state.isOperational, clientId]);

  return { actions, state };
}
