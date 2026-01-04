import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'warning' | 'success' | 'primary';
}

export function StatCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div className="stat-card h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1.5 text-lg sm:text-xl lg:text-2xl font-bold text-card-foreground whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              'mt-1.5 inline-flex items-center gap-1 text-xs font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              <span>{trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground">vs mês anterior</span>
            </div>
          )}
        </div>
        <div className={cn(
          'flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg flex-shrink-0',
          variant === 'warning' && 'bg-warning/10 text-warning',
          variant === 'success' && 'bg-success/10 text-success',
          variant === 'primary' && 'bg-primary/10 text-primary',
          variant === 'default' && 'bg-muted text-muted-foreground'
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}
