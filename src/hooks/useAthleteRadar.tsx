import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Radar de atletas: cruza o CONTRATADO (periodicidade de check-in e consulta)
// com o REALIZADO (envios, respostas, devolutivas, consultas) e aponta quem
// está fora do combinado. Só atletas ativos e não congelados.

export type IssueKind =
  | 'nutri_pendente'      // atleta respondeu, você ainda não devolveu
  | 'atleta_nao_respondeu'// você enviou, o atleta não respondeu
  | 'checkin_atrasado'    // passou da periodicidade sem check-in
  | 'consulta_atrasada'   // passou da periodicidade sem consulta
  | 'consulta_nunca';     // contratou consulta e nunca realizou

export interface RadarIssue {
  kind: IssueKind;
  label: string;
  days?: number;
}

export interface RadarRow {
  id: string;
  name: string;
  phone: string | null;
  checkinFrequency: string | null;
  consultationFrequency: string | null;
  lastSentAt: string | null;
  lastAnsweredAt: string | null;
  lastConsultation: string | null;
  pendingResponseId: string | null; // check-in mais antigo aguardando você
  pendingNutriCount: number;
  issues: RadarIssue[];
  severity: number; // maior = mais urgente (para ordenar)
}

// Tolerância (em dias) antes de considerar o check-in atrasado — com folga,
// para não gerar alarme falso logo no dia seguinte ao previsto.
const CHECKIN_TOLERANCE: Record<string, number> = {
  daily: 2, weekly: 10, biweekly: 17, quinzenal: 17,
  three_weeks: 24, monthly: 35, mensal: 35,
};
const CONSULT_TOLERANCE: Record<string, number> = { monthly: 35, six_weeks: 49 };

const DAY = 86_400_000;
const daysSince = (iso: string | null): number | null =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null;

const SEVERITY: Record<IssueKind, number> = {
  nutri_pendente: 100,       // depende de VOCÊ → topo
  atleta_nao_respondeu: 60,
  consulta_atrasada: 40,
  consulta_nunca: 35,
  checkin_atrasado: 20,
};

export function useAthleteRadar() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['athlete-radar', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<RadarRow[]> => {
      const uid = user!.id;
      const since = new Date(Date.now() - 180 * DAY).toISOString();

      const { data: clientsData } = await supabase.from('clients')
        .select('id, name, phone, checkin_frequency, has_checkin, consultation_frequency, has_consultations, last_consultation_at')
        .eq('user_id', uid).eq('is_active', true).eq('is_frozen', false).order('name');
      const clients = clientsData ?? [];
      if (!clients.length) return [];
      // checkin_responses/checkin_feedbacks NÃO têm user_id — o escopo vem dos
      // ids dos atletas do nutri (que já vieram filtrados por user_id).
      const ids = clients.map((c: any) => c.id);

      const [dispatchRes, respRes, apptRes] = await Promise.all([
        (supabase as any).from('checkin_dispatches')
          .select('client_id, sent_at').in('client_id', ids).gte('sent_at', since)
          .order('sent_at', { ascending: false }).limit(2000),
        supabase.from('checkin_responses')
          .select('id, client_id, submitted_at').in('client_id', ids).gte('submitted_at', since)
          .order('submitted_at', { ascending: false }).limit(2000),
        (supabase as any).from('appointments')
          .select('client_id, appointment_date, status').in('client_id', ids)
          .in('status', ['completed', 'confirmed'])
          .order('appointment_date', { ascending: false }).limit(2000),
      ]);

      // Último envio e última resposta por atleta (listas já vêm ordenadas desc).
      const lastSent = new Map<string, string>();
      for (const d of (dispatchRes.data ?? []) as any[]) {
        if (!lastSent.has(d.client_id)) lastSent.set(d.client_id, d.sent_at);
      }
      const responses = (respRes.data ?? []) as any[];
      const lastAnswered = new Map<string, string>();
      for (const r of responses) {
        if (!lastAnswered.has(r.client_id)) lastAnswered.set(r.client_id, r.submitted_at);
      }
      const lastAppt = new Map<string, string>();
      for (const a of (apptRes.data ?? []) as any[]) {
        if (!lastAppt.has(a.client_id)) lastAppt.set(a.client_id, a.appointment_date);
      }

      // Respostas SEM devolutiva enviada pelo nutri.
      const answeredIds = responses.map((r) => r.id);
      const repliedTo = new Set<string>();
      if (answeredIds.length) {
        try {
          const { data: fb } = await (supabase as any)
            .from('checkin_feedbacks')
            .select('checkin_response_id, sent_at')
            .in('checkin_response_id', answeredIds.slice(0, 1000));
          for (const f of (fb ?? [])) if (f.sent_at) repliedTo.add(f.checkin_response_id);
        } catch { /* sem feedbacks → tudo conta como pendente */ }
      }
      const pendingByClient = new Map<string, { count: number; oldest: any }>();
      for (const r of responses) {
        if (repliedTo.has(r.id)) continue;
        const cur = pendingByClient.get(r.client_id);
        // `responses` está desc → o último visto é o mais antigo.
        if (cur) { cur.count += 1; cur.oldest = r; }
        else pendingByClient.set(r.client_id, { count: 1, oldest: r });
      }

      const rows: RadarRow[] = clients.map((c: any) => {
        const sentAt = lastSent.get(c.id) ?? null;
        const answeredAt = lastAnswered.get(c.id) ?? null;
        const consultAt = lastAppt.get(c.id) ?? c.last_consultation_at ?? null;
        const pend = pendingByClient.get(c.id);
        const issues: RadarIssue[] = [];

        // 1) Você ainda não devolveu um check-in respondido.
        if (pend) {
          const d = daysSince(pend.oldest.submitted_at) ?? 0;
          issues.push({
            kind: 'nutri_pendente', days: d,
            label: pend.count > 1
              ? `${pend.count} check-ins aguardando sua devolutiva (mais antigo há ${d}d)`
              : `Check-in aguardando sua devolutiva há ${d}d`,
          });
        }

        // 2) Você enviou e o atleta não respondeu (com 3 dias de folga).
        const dSent = daysSince(sentAt);
        const naoRespondeu = !!sentAt && (!answeredAt || answeredAt < sentAt);
        if (c.has_checkin && naoRespondeu && (dSent ?? 0) >= 3) {
          issues.push({ kind: 'atleta_nao_respondeu', days: dSent!, label: `Atleta não respondeu o check-in (há ${dSent}d)` });
        }

        // 3) Check-in fora da periodicidade contratada.
        const ref = sentAt && answeredAt ? (sentAt > answeredAt ? sentAt : answeredAt) : (sentAt ?? answeredAt);
        const dRef = daysSince(ref);
        const tol = CHECKIN_TOLERANCE[c.checkin_frequency ?? ''] ?? 35;
        if (c.has_checkin && !pend && (dRef == null || dRef > tol)) {
          issues.push({
            kind: 'checkin_atrasado', days: dRef ?? undefined,
            label: dRef == null ? 'Nunca teve check-in' : `Check-in atrasado (${dRef}d sem movimento)`,
          });
        }

        // 4/5) Consultas contratadas.
        if (c.has_consultations) {
          const ctol = CONSULT_TOLERANCE[c.consultation_frequency ?? ''];
          if (!consultAt) {
            issues.push({ kind: 'consulta_nunca', label: 'Contratou consulta e nunca realizou' });
          } else if (ctol) {
            const dc = daysSince(consultAt)!;
            if (dc > ctol) issues.push({ kind: 'consulta_atrasada', days: dc, label: `Consulta atrasada (última há ${dc}d)` });
          }
        }

        const severity = issues.reduce((m, i) => Math.max(m, SEVERITY[i.kind]), 0)
          + Math.min(issues.length, 3); // desempate por quantidade

        return {
          id: c.id, name: c.name, phone: c.phone ?? null,
          checkinFrequency: c.checkin_frequency ?? null,
          consultationFrequency: c.consultation_frequency ?? null,
          lastSentAt: sentAt, lastAnsweredAt: answeredAt, lastConsultation: consultAt,
          pendingResponseId: pend?.oldest?.id ?? null,
          pendingNutriCount: pend?.count ?? 0,
          issues, severity,
        };
      });

      return rows.sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name));
    },
  });

  const rows = query.data ?? [];
  const problems = rows.filter((r) => r.issues.length > 0);
  const ok = rows.filter((r) => r.issues.length === 0);
  const count = (k: IssueKind) => problems.filter((r) => r.issues.some((i) => i.kind === k)).length;

  return {
    rows, problems, ok, total: rows.length, isLoading: query.isLoading,
    counts: {
      nutriPendente: count('nutri_pendente'),
      atletaNaoRespondeu: count('atleta_nao_respondeu'),
      checkinAtrasado: count('checkin_atrasado'),
      consulta: count('consulta_atrasada') + count('consulta_nunca'),
    },
  };
}
