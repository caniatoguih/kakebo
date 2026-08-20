import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Trend = {
  value: string;
  direction: 'up' | 'down' | 'neutral';
  tone: 'positive' | 'negative' | 'neutral';
};

type KpiCardProps = {
  title: string;
  value: string;
  description?: string;
  trend?: Trend;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'danger' | 'info';
  className?: string;
};

const toneClasses = {
  default: 'border-border/80 bg-card',
  success: 'border-success/20 bg-success/5',
  danger: 'border-destructive/20 bg-destructive/5',
  info: 'border-info/20 bg-info/5',
};

const iconClasses = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
};

const trendClasses = {
  positive: 'text-success',
  negative: 'text-destructive',
  neutral: 'text-muted-foreground',
};

const trendIcons = { up: ArrowUp, down: ArrowDown, neutral: ArrowRight };

export function KpiCard({ title, value, description, trend, icon, tone = 'default', className }: KpiCardProps) {
  const TrendIcon = trend ? trendIcons[trend.direction] : null;
  return <Card className={cn('min-w-0 transition-colors duration-200 hover:border-primary/20', toneClasses[tone], className)}>
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
        {icon && <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md [&_svg]:h-4 [&_svg]:w-4', iconClasses[tone])}>{icon}</span>}
      </div>
      <p className="mt-3 truncate font-display text-2xl font-bold tabular-nums tracking-tight sm:text-[1.65rem]" title={value}>{value}</p>
      {trend && <p className={cn('mt-2 flex items-center gap-1 text-xs font-semibold', trendClasses[trend.tone])}>
        {TrendIcon && <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />}{trend.value}
      </p>}
      {description && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>;
}

export function KpiCardSkeleton() {
  return <Card aria-label="Carregando indicador"><CardContent className="space-y-4 p-5"><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-36" /><Skeleton className="h-3 w-28" /></CardContent></Card>;
}
