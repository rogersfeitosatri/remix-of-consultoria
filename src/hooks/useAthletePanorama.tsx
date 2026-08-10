import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Panorama do acompanhamento de UM atleta: o que foi CONTRATADO (modalidade e
// periodicidade) x o que está ACONTECENDO (consultas, check-ins, pendências).
// Mesma semântica de pendências do Radar do dashboard, para o nutri aprender
// um único vocabulário.

export type PendKind = 'nutri_pendente' | 'atleta_nao_respondeu' | 'checkin_atrasado' | 'consulta_atrasada' | 'consulta_nunca';

export interface Pend {
  kind: PendKind;
  label: string;
  responseId?: string | null; // check-in a responder, quando aplicável
}

export interface Panorama {
  // contrato
  planType: string | null;
  planDuration: string | null;
  startDate: string | null;
  endDate: string | null;
  daysToEnd: number | null;
  isFrozen: boolean;
  hasConsultations: boolean;
  consultationFrequency: string | null;
  consultationCount: number | null;
  consultationsDone: number;
  hasCheckin: boolean;
  checkinFrequency: string | null;
  // realizado
  lastConsultation: string | null;
  nextConsultation: string | null;
  lastCheckinSent: string | null;
  lastCheckinAnswered: string | null;
  // corredor
  targetRace: string | null;
  targetDate: string | null;
  weeksToRace: number | null;
  // diagnóstico
  pendings: Pend[];
}

const DAY = 86_400_000;
const dSince = (v: string | null) => (v ? Math.floor((Date.now() - new Date(v).getTime()) / DAY) : null);
const dUntil = (v: string | null) => (v ? Math.ceil((new Date(v).getTime() - Date.now()) / DAY) : null);

export const CHECKIN_LABEL: Record<string, string> = {
  daily: 'diário', weekly: 'semanal', biweekly: 'quinzenal', quinzenal: 'quinzenal',
  three_weeks: 'a cada 3 semanas', monthly: 'mensal', mensal: 'mensal',
};
export const CONSULT_LABEL: Record<string, string> = {
  monthly: 'mensal', six_weeks: 'a cada 6 semanas', once: 'única',
};
const CHECKIN_TOL: Record<string, number> = {
  daily: 2, weekly: 10, biweekly: 17, quinzenal: 17, three_weeks: 24, monthly: 35, mensal: 35,
};
const CONSULT_TOL: Record<string, number> = { monthly: 35, six_weeks: 49 };

export function useAthletePanorama(clientId?: string) {
  return useQuery({
    queryKey: ['athlete-panorama', clientId],
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async (): Promise<Panorama | null> => {
      const { data: c } = await supabase.from('clients')
        .select('plan_type, plan_duration, start_date, end_date, is_frozen, has_consultations, consultation_frequency, consultation_count, consultations_completed, last_consultation_at, has_checkin, checkin_frequency')
        .eq('id', clientId!).maybeSingle();
      if (!c) return null;

      const today = new Date().toISOString().slice(0, 10);
      const [dispatch, resp, apptDone, apptNext, profile] = await Promise.all([
        (supabase as any).from('checkin_dispatches').select('sent_at')
          .eq('client_id', clientId).order('sent_at', { ascending: false }).limit(1),
        supabase.from('checkin_responses').select('id, submitted_at')
          .eq('client_id', clientId).order('submitted_at', { ascending: false }).limit(20),
        (supabase as any).from('appointments').select('appointment_date')
          .eq('client_id', clientId).in('status', ['completed', 'confirmed'])
          .lte('appointment_date', today).order('appointment_date', { ascending: false }).limit(1),
        (supabase as any).from('appointments').select('appointment_date')
          .eq('client_id', clientId).in('status', ['scheduled', 'confirmed'])
          .gte('appointment_date', today).order('appointment_date', { ascending: true }).limit(1),
        (supabase as any).from('athlete_profiles').select('target_race, target_deadline')
          .eq('client_id', clientId).maybeSingle(),
      ]);

      const responses = (resp.data ?? []) as any[];
      const lastSent = dispatch.data?.[0]?.sent_at ?? null;
      const lastAnswered = responses[0]?.submitted_at ?? null;

      // Check-ins respondidos sem devolutiva enviada.
      let firstPending: any = null;
      let pendingCount = 0;
      if (responses.length) {
        const { data: fb } = await (supabase as any).from('checkin_feedbacks')
          .select('checkin_response_id, sent_at').in('checkin_response_id', responses.map((r) => r.id));
        const replied = new Set((fb ?? []).filter((f: any) => f.sent_at).map((f: any) => f.checkin_response_id));
        const open = responses.filter((r) => !replied.has(r.id));
        pendingCount = open.length;
        firstPending = open[open.length - 1] ?? null; // mais antigo
      }

      const lastConsultation = apptDone.data?.[0]?.appointment_date ?? (c as any).last_consultation_at ?? null;
      const nextConsultation = apptNext.data?.[0]?.appointment_date ?? null;
      const targetDate = profile.data?.target_deadline ?? null;

      const pendings: Pend[] = [];
      if (pendingCount > 0) {
        const d = dSince(firstPending?.submitted_at) ?? 0;
        pendings.push({
          kind: 'nutri_pendente',
          label: pendingCount > 1
            ? `${pendingCount} check-ins esperando sua devolutiva (o mais antigo há ${d}d)`
            : `Check-in esperando sua devolutiva há ${d}d`,
          responseId: firstPending?.id ?? null,
        });
      }
      const dSent = dSince(lastSent);
      if ((c as any).has_checkin && lastSent && (!lastAnswered || lastAnswered < lastSent) && (dSent ?? 0) >= 3) {
        pendings.push({ kind: 'atleta_nao_respondeu', label: `Atleta não respondeu o check-in enviado há ${dSent}d` });
      }
      const ref = lastSent && lastAnswered ? (lastSent > lastAnswered ? lastSent : lastAnswered) : (lastSent ?? lastAnswered);
      const dRef = dSince(ref);
      const tol = CHECKIN_TOL[(c as any).checkin_frequency ?? ''] ?? 35;
      if ((c as any).has_checkin && pendingCount === 0 && (dRef == null || dRef > tol)) {
        pendings.push({
          kind: 'checkin_atrasado',
          label: dRef == null ? 'Nunca teve check-in' : `Check-in atrasado — ${dRef}d sem movimento`,
        });
      }
      if ((c as any).has_consultations) {
        const ctol = CONSULT_TOL[(c as any).consultation_frequency ?? ''];
        if (!lastConsultation) pendings.push({ kind: 'consulta_nunca', label: 'Plano com consulta e nenhuma realizada' });
        else if (ctol && !nextConsultation) {
          const dc = dSince(lastConsultation)!;
          if (dc > ctol) pendings.push({ kind: 'consulta_atrasada', label: `Consulta atrasada — última há ${dc}d, nenhuma agendada` });
        }
      }

      return {
        planType: (c as any).plan_type ?? null,
        planDuration: (c as any).plan_duration ?? null,
        startDate: (c as any).start_date ?? null,
        endDate: (c as any).end_date ?? null,
        daysToEnd: dUntil((c as any).end_date ?? null),
        isFrozen: !!(c as any).is_frozen,
        hasConsultations: !!(c as any).has_consultations,
        consultationFrequency: (c as any).consultation_frequency ?? null,
        consultationCount: (c as any).consultation_count ?? null,
        consultationsDone: Number((c as any).consultations_completed) || 0,
        hasCheckin: !!(c as any).has_checkin,
        checkinFrequency: (c as any).checkin_frequency ?? null,
        lastConsultation, nextConsultation,
        lastCheckinSent: lastSent, lastCheckinAnswered: lastAnswered,
        targetRace: profile.data?.target_race ?? null,
        targetDate,
        weeksToRace: targetDate ? Math.ceil((dUntil(targetDate) ?? 0) / 7) : null,
        pendings,
      };
    },
  });
}
