import { useMemo } from 'react';
import { Client } from './useClients';
import { differenceInDays, parseISO } from 'date-fns';

export type HealthStatus = 'healthy' | 'attention' | 'critical';

export interface AthleteHealthScore {
  status: HealthStatus;
  label: string;
  reasons: string[];
}

function getGraceDays(frequency: string | null): number {
  switch (frequency) {
    case 'weekly': return 9;
    case 'biweekly': return 16;
    case 'monthly': return 35;
    case 'bimonthly': return 65;
    case 'quarterly': return 95;
    default: return 35;
  }
}

export function calculateHealthScore(
  client: Client,
  lastCheckinDate?: string | null,
  hasPendingMealPlan?: boolean,
  hasScheduledConsultation?: boolean,
): AthleteHealthScore {
  const reasons: string[] = [];
  let worstStatus: HealthStatus = 'healthy';

  const today = new Date();

  // 1. Plan validity
  const daysToEnd = differenceInDays(parseISO(client.end_date), today);
  if (daysToEnd < 0) {
    worstStatus = 'critical';
    reasons.push('Plano vencido');
  } else if (daysToEnd <= 7) {
    if (worstStatus !== 'critical') worstStatus = 'attention';
    reasons.push(`Plano vence em ${daysToEnd}d`);
  }

  // 2. Check-in status
  if (client.has_checkin && client.checkin_frequency) {
    const grace = getGraceDays(client.checkin_frequency);
    if (lastCheckinDate) {
      const daysSinceCheckin = differenceInDays(today, parseISO(lastCheckinDate));
      if (daysSinceCheckin > grace * 1.5) {
        worstStatus = 'critical';
        reasons.push(`Check-in atrasado ${daysSinceCheckin}d`);
      } else if (daysSinceCheckin > grace) {
        if (worstStatus !== 'critical') worstStatus = 'attention';
        reasons.push(`Check-in pendente`);
      }
    } else {
      // Never responded
      const daysSinceStart = differenceInDays(today, parseISO(client.start_date));
      if (daysSinceStart > grace) {
        if (worstStatus !== 'critical') worstStatus = 'attention';
        reasons.push('Sem check-in registrado');
      }
    }
  }

  // 3. Meal plan pending
  if (hasPendingMealPlan) {
    if (worstStatus !== 'critical') worstStatus = 'attention';
    reasons.push('Plano alimentar pendente');
  }

  // 4. Consultation status
  if (client.has_consultations && !hasScheduledConsultation && client.consultation_count > 0) {
    const daysSinceStart = differenceInDays(today, parseISO(client.start_date));
    if (daysSinceStart > 14 && !client.first_consultation_date) {
      if (worstStatus !== 'critical') worstStatus = 'attention';
      reasons.push('Sem consulta realizada');
    }
  }

  const labels: Record<HealthStatus, string> = {
    healthy: 'Em dia',
    attention: 'Atenção',
    critical: 'Crítico',
  };

  return {
    status: worstStatus,
    label: labels[worstStatus],
    reasons,
  };
}

export function useAthleteHealthScores(clients: Client[]) {
  // This hook provides a lightweight batch calculation
  // For individual scores, use calculateHealthScore directly
  return useMemo(() => {
    const map: Record<string, AthleteHealthScore> = {};
    for (const c of clients) {
      if (!c.is_active) continue;
      map[c.id] = calculateHealthScore(c);
    }
    return map;
  }, [clients]);
}
