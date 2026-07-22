import { Badge } from '@/components/ui/badge';
import type { ZnSubscriptionStatus, ZnPaymentStatus, ZnAthleteStatus, ZnPlanCode } from '@/hooks/useZnAssessoria';

const SUB_LABELS: Record<ZnSubscriptionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  active: { label: 'Ativa', variant: 'default' },
  overdue: { label: 'Atrasada', variant: 'destructive' },
  suspended: { label: 'Suspensa', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'outline' },
  expired: { label: 'Expirada', variant: 'outline' },
};

const PAY_LABELS: Record<ZnPaymentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  confirmed: { label: 'Confirmado', variant: 'default' },
  received: { label: 'Recebido', variant: 'default' },
  overdue: { label: 'Vencido', variant: 'destructive' },
  refunded: { label: 'Reembolsado', variant: 'outline' },
  failed: { label: 'Falha', variant: 'destructive' },
  deleted: { label: 'Excluído', variant: 'outline' },
};

const ATH_LABELS: Record<ZnAthleteStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  active: { label: 'Ativo', variant: 'default' },
  inactive: { label: 'Inativo', variant: 'outline' },
};

const PLAN_LABELS: Record<ZnPlanCode, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export function ZnSubscriptionStatusBadge({ status }: { status: ZnSubscriptionStatus }) {
  const s = SUB_LABELS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ZnPaymentStatusBadge({ status }: { status: ZnPaymentStatus }) {
  const s = PAY_LABELS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ZnAthleteStatusBadge({ status }: { status: ZnAthleteStatus }) {
  const s = ATH_LABELS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ZnPlanBadge({ plan }: { plan: ZnPlanCode }) {
  return <Badge variant="outline">{PLAN_LABELS[plan] ?? plan}</Badge>;
}
