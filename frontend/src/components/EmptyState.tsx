import type { ElementType, ReactNode } from 'react';
import { KakeboSymbol } from '@/components/brand/KakeboSymbol';

type Props = {
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed bg-card px-6 py-14 text-center shadow-card">
    <KakeboSymbol className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 opacity-[0.04]" />
    <div className="relative mb-4 rounded-full bg-muted p-4"><Icon aria-hidden="true" className="h-8 w-8 text-muted-foreground" /></div>
    <h2 className="relative font-display text-lg font-semibold">{title}</h2>
    <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    {action && <div className="relative mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>;
}
