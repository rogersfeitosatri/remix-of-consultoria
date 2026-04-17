import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { classifyPlan, ClientPlanLike, PlanTypeKey } from '@/lib/planTypology';

const STYLES: Record<PlanTypeKey, string> = {
  checkin_only: 'bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-300',
  single_consult: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
  recurring_4w: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400',
  recurring_6w: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30 dark:text-indigo-400',
  premium_4w: 'bg-violet-500/10 text-violet-700 border-violet-500/30 dark:text-violet-400',
  premium_6w: 'bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/30 dark:text-fuchsia-400',
  unconfigured: 'bg-destructive/10 text-destructive border-destructive/30',
};

interface Props {
  client: ClientPlanLike;
  variant?: 'full' | 'short';
  className?: string;
}

export function PlanTypeBadge({ client, variant = 'short', className }: Props) {
  const t = classifyPlan(client);
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 text-[10px] font-medium', STYLES[t.key], className)}
      title={t.description}
    >
      <span aria-hidden>{t.emoji}</span>
      {variant === 'full' ? t.label : t.shortLabel}
    </Badge>
  );
}
