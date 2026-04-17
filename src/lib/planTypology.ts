/**
 * Tipologia de planos: classifica e descreve o tipo de plano de cada atleta
 * para alimentar badges, validações e UX consistente em todo o sistema.
 */

export type PlanTypeKey =
  | 'checkin_only'      // A — Só check-in (sem consultas)
  | 'single_consult'    // B — 1 consulta única
  | 'recurring_4w'      // C1 — Recorrente 4 semanas
  | 'recurring_6w'      // C2 — Recorrente 6 semanas
  | 'premium_4w'        // D1 — Premium ilimitado 4w
  | 'premium_6w'        // D2 — Premium ilimitado 6w
  | 'unconfigured';     // ⚠ Inconsistente / não configurado

export interface PlanTypology {
  key: PlanTypeKey;
  label: string;
  shortLabel: string;
  emoji: string;
  cadenceWeeks: number | null;
  description: string;
}

export interface ClientPlanLike {
  has_consultations?: boolean | null;
  consultation_count?: number | null;
  consultation_frequency?: string | null;
  plan_type?: string | null;
}

export function classifyPlan(client: ClientPlanLike): PlanTypology {
  const hasConsults = client.has_consultations === true;
  const count = client.consultation_count ?? 0;
  const freq = client.consultation_frequency || '';
  const isPremium = client.plan_type === 'premium';

  // A — Só check-in
  if (!hasConsults) {
    return {
      key: 'checkin_only',
      label: 'Só Check-in',
      shortLabel: 'Check-in',
      emoji: '📋',
      cadenceWeeks: null,
      description: 'Plano sem consultas — apenas acompanhamento via check-in',
    };
  }

  // B — 1 consulta única
  if (count === 1) {
    return {
      key: 'single_consult',
      label: '1 Consulta Única',
      shortLabel: '1ª Única',
      emoji: '1️⃣',
      cadenceWeeks: null,
      description: 'Apenas uma consulta — sem recorrência de envio de link',
    };
  }

  const is6w = freq === 'six_weeks' || freq === '6_weeks';
  const cadence = is6w ? 6 : 4;

  // D — Premium ilimitado (count = 0 ou null)
  if (count === 0 || count === null) {
    if (isPremium) {
      return {
        key: is6w ? 'premium_6w' : 'premium_4w',
        label: `Premium ${cadence}w`,
        shortLabel: `⭐ ${cadence}w`,
        emoji: '⭐',
        cadenceWeeks: cadence,
        description: `Premium ilimitado — consultas a cada ${cadence} semanas`,
      };
    }
    // has_consults=true sem count e sem ser premium = inconsistente
    return {
      key: 'unconfigured',
      label: 'Não configurado',
      shortLabel: '⚠ Config',
      emoji: '⚠️',
      cadenceWeeks: null,
      description: 'Plano com consultas habilitadas mas sem nº de consultas definido',
    };
  }

  // C — Recorrente N consultas
  return {
    key: is6w ? 'recurring_6w' : 'recurring_4w',
    label: `${count} Consultas (${cadence}w)`,
    shortLabel: `🔄 ${cadence}w`,
    emoji: '🔄',
    cadenceWeeks: cadence,
    description: `${count} consultas a cada ${cadence} semanas`,
  };
}

/**
 * Verifica se a duração do plano comporta a quantidade × cadência configurada.
 * Retorna `null` se viável, ou string descritiva do problema.
 */
export function validatePlanFeasibility(params: {
  has_consultations: boolean;
  consultation_count: number;
  consultation_frequency: string | null;
  start_date: string;
  end_date: string;
}): string | null {
  if (!params.has_consultations || params.consultation_count <= 1) return null;
  if (!params.start_date || !params.end_date) return null;

  const start = new Date(params.start_date);
  const end = new Date(params.end_date);
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (durationDays <= 0) return null;

  const cadence = params.consultation_frequency === 'six_weeks' || params.consultation_frequency === '6_weeks' ? 6 : 4;
  // Precisa de (count - 1) intervalos completos + alguma folga (consultas começam no dia 0)
  const requiredDays = (params.consultation_count - 1) * cadence * 7;

  if (requiredDays > durationDays) {
    const requiredWeeks = Math.ceil(requiredDays / 7);
    const availableWeeks = Math.floor(durationDays / 7);
    return `Plano inviável: ${params.consultation_count} consultas a cada ${cadence}w precisa de ~${requiredWeeks} semanas, mas o plano tem só ${availableWeeks}.`;
  }
  return null;
}
