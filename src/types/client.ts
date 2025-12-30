export type ServiceType = 'nutrition' | 'training' | 'both';
export type PlanType = 'consultoria' | 'premium';
export type CheckinFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  serviceType: ServiceType;
  planType: PlanType;
  hasCheckin: boolean;
  checkinFrequency?: CheckinFrequency;
  startDate: string;
  endDate: string;
  monthlyValue: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'pending' | 'paid' | 'overdue';
}

export const SERVICE_LABELS: Record<ServiceType, string> = {
  nutrition: 'Nutricional',
  training: 'Treino',
  both: 'Nutricional + Treino',
};

export const PLAN_LABELS: Record<PlanType, string> = {
  consultoria: 'Consultoria',
  premium: 'Premium',
};

export const CHECKIN_LABELS: Record<CheckinFrequency, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
};
