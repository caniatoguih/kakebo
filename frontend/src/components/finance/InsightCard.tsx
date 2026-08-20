import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleAlert, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type InsightTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const styles = {
  success: { card: 'border-success/20 bg-success/5', icon: 'bg-success/10 text-success', Icon: CheckCircle2 },
  warning: { card: 'border-warning/25 bg-warning/5', icon: 'bg-warning/10 text-warning', Icon: AlertTriangle },
  danger: { card: 'border-destructive/20 bg-destructive/5', icon: 'bg-destructive/10 text-destructive', Icon: CircleAlert },
  info: { card: 'border-info/20 bg-info/5', icon: 'bg-info/10 text-info', Icon: Info },
  neutral: { card: 'border-border/80 bg-card', icon: 'bg-muted text-muted-foreground', Icon: Info },
};

export function InsightCard({ title, description, tone = 'neutral', action, className }: { title: string; description: string; tone?: InsightTone; action?: ReactNode; className?: string }) {
  const style = styles[tone];
  return <Card className={cn('h-full transition-colors duration-200 hover:border-primary/20', style.card, className)}>
    <CardContent className="flex h-full gap-3 p-4">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', style.icon)}><style.Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
      <div className="min-w-0">
        <h3 className="font-display font-semibold leading-snug">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </CardContent>
  </Card>;
}
