import { Client, Payment } from '@/hooks/useClients';
import { parseISO, differenceInCalendarMonths } from 'date-fns';

export const PLAN_DURATION_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
  six_weeks: 1.5,
};

export const PLAN_DURATION_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  six_weeks: '6 Semanas',
  custom: 'Personalizado',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  nutrition: 'Nutrição',
  training: 'Treino',
  both: 'Nutrição + Treino',
};

export const PLAN_TYPE_LABELS: Record<string, string> = {
  consultoria: 'Consultoria',
  premium: 'Premium',
  zona_nutri_diet: 'Zona Nutri Diet',
};

export function getClientDurationMonths(client: Client): number {
  if (client.plan_duration !== 'custom') {
    return PLAN_DURATION_MONTHS[client.plan_duration] ?? 1;
  }
  // For custom plans, derive months from start_date → end_date
  if (client.start_date && client.end_date) {
    const months = differenceInCalendarMonths(parseISO(client.end_date), parseISO(client.start_date)) + 1;
    return Math.max(months, 1);
  }
  return 1;
}

export function calculateClientLTV(client: Client): number {
  return client.monthly_value * getClientDurationMonths(client);
}

export function calculateClientRealizedRevenue(client: Client, payments: Payment[]): number {
  return payments
    .filter(p => p.client_id === client.id && p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
}

export interface ClientLTVData {
  id: string;
  name: string;
  plan_type: string;
  plan_duration: string;
  service_type: string;
  monthly_value: number;
  duration_months: number;
  ltv: number;
  realized: number;
  realizationRate: number;
  start_date: string;
  end_date: string;
}

export function buildClientLTVData(clients: Client[], payments: Payment[]): ClientLTVData[] {
  return clients
    .filter(c => c.is_active && !c.is_frozen)
    .map(client => {
      const duration_months = getClientDurationMonths(client);
      const ltv = client.monthly_value * duration_months;
      const realized = calculateClientRealizedRevenue(client, payments);
      const realizationRate = ltv > 0 ? Math.min((realized / ltv) * 100, 100) : 0;
      return {
        id: client.id,
        name: client.name,
        plan_type: client.plan_type,
        plan_duration: client.plan_duration,
        service_type: client.service_type,
        monthly_value: client.monthly_value,
        duration_months,
        ltv,
        realized,
        realizationRate,
        start_date: client.start_date,
        end_date: client.end_date,
      };
    })
    .sort((a, b) => b.ltv - a.ltv);
}

export interface LTVSummary {
  totalLTV: number;
  averageLTV: number;
  totalRealized: number;
  overallRealizationRate: number;
  activeClientsCount: number;
  mrr: number;
  byPlanType: { key: string; name: string; ltv: number; count: number }[];
  byServiceType: { key: string; name: string; ltv: number; count: number }[];
  byDuration: { key: string; name: string; ltv: number; count: number; avgLTV: number }[];
}

export function calculateLTVSummary(clients: Client[], payments: Payment[]): LTVSummary {
  const data = buildClientLTVData(clients, payments);

  const totalLTV = data.reduce((sum, c) => sum + c.ltv, 0);
  const totalRealized = data.reduce((sum, c) => sum + c.realized, 0);
  const activeClientsCount = data.length;
  const averageLTV = activeClientsCount > 0 ? totalLTV / activeClientsCount : 0;
  const overallRealizationRate = totalLTV > 0 ? Math.min((totalRealized / totalLTV) * 100, 100) : 0;
  const mrr = clients
    .filter(c => c.is_active && !c.is_frozen)
    .reduce((sum, c) => sum + c.monthly_value, 0);

  const planTypeMap: Record<string, { ltv: number; count: number }> = {};
  data.forEach(c => {
    if (!planTypeMap[c.plan_type]) planTypeMap[c.plan_type] = { ltv: 0, count: 0 };
    planTypeMap[c.plan_type].ltv += c.ltv;
    planTypeMap[c.plan_type].count += 1;
  });
  const byPlanType = Object.entries(planTypeMap).map(([key, val]) => ({
    key,
    name: PLAN_TYPE_LABELS[key] ?? key,
    ltv: val.ltv,
    count: val.count,
  }));

  const serviceTypeMap: Record<string, { ltv: number; count: number }> = {};
  data.forEach(c => {
    if (!serviceTypeMap[c.service_type]) serviceTypeMap[c.service_type] = { ltv: 0, count: 0 };
    serviceTypeMap[c.service_type].ltv += c.ltv;
    serviceTypeMap[c.service_type].count += 1;
  });
  const byServiceType = Object.entries(serviceTypeMap).map(([key, val]) => ({
    key,
    name: SERVICE_TYPE_LABELS[key] ?? key,
    ltv: val.ltv,
    count: val.count,
  }));

  const durationMap: Record<string, { ltv: number; count: number }> = {};
  data.forEach(c => {
    if (!durationMap[c.plan_duration]) durationMap[c.plan_duration] = { ltv: 0, count: 0 };
    durationMap[c.plan_duration].ltv += c.ltv;
    durationMap[c.plan_duration].count += 1;
  });
  const byDuration = Object.entries(durationMap)
    .map(([key, val]) => ({
      key,
      name: PLAN_DURATION_LABELS[key] ?? key,
      ltv: val.ltv,
      count: val.count,
      avgLTV: val.count > 0 ? val.ltv / val.count : 0,
    }))
    .sort((a, b) => b.ltv - a.ltv);

  return {
    totalLTV,
    averageLTV,
    totalRealized,
    overallRealizationRate,
    activeClientsCount,
    mrr,
    byPlanType,
    byServiceType,
    byDuration,
  };
}
