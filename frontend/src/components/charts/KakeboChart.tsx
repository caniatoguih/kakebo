import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function KakeboChart({ children, className, ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border border-border/60 bg-background/55 p-3 sm:p-4', className)} {...props}>{children}</div>;
}
