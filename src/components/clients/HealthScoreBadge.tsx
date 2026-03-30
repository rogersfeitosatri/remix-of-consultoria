import { HealthStatus } from '@/hooks/useAthleteHealthScore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HealthScoreBadgeProps {
  status: HealthStatus;
  label: string;
  reasons: string[];
  size?: 'sm' | 'md';
}

const statusConfig: Record<HealthStatus, { emoji: string; className: string }> = {
  healthy: { emoji: '🟢', className: 'bg-success/10 text-success border-success/20' },
  attention: { emoji: '🟡', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  critical: { emoji: '🔴', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function HealthScoreBadge({ status, label, reasons, size = 'sm' }: HealthScoreBadgeProps) {
  const config = statusConfig[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium cursor-default',
            config.className,
            size === 'md' && 'px-2.5 py-1 text-sm'
          )}>
            <span>{config.emoji}</span>
            <span>{label}</span>
          </span>
        </TooltipTrigger>
        {reasons.length > 0 && (
          <TooltipContent side="bottom" className="max-w-xs">
            <ul className="text-xs space-y-0.5">
              {reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
