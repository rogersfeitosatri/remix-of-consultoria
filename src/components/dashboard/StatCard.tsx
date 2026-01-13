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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        {/* Mobile: Icon on top right, content stacked */}
        <div className="flex items-start justify-between sm:hidden w-full">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
          </div>
          <div className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0',
            variant === 'warning' && 'bg-warning/10 text-warning',
            variant === 'success' && 'bg-success/10 text-success',
            variant === 'primary' && 'bg-primary/10 text-primary',
            variant === 'default' && 'bg-muted text-muted-foreground'
          )}>
            {icon}
          </div>
        </div>
        
        {/* Mobile: Value and subtitle */}
        <div className="sm:hidden w-full">
          <p className="text-xl font-bold text-card-foreground">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              'mt-1 inline-flex items-center gap-1 text-xs font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              <span>{trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground">vs mês anterior</span>
            </div>
          )}
        </div>
        
        {/* Desktop: Original layout */}
        <div className="hidden sm:block min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
          <p className="mt-1.5 text-xl lg:text-2xl font-bold text-card-foreground whitespace-nowrap overflow-hidden text-ellipsis">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground truncate">{subtitle}</p>
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
        
        {/* Desktop: Icon */}
        <div className={cn(
          'hidden sm:flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0',
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
