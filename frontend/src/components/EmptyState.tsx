import type { ElementType, ReactNode } from 'react';

type Props = {
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
    <div className="mb-4 rounded-full bg-muted p-4"><Icon aria-hidden="true" className="h-8 w-8 text-muted-foreground" /></div>
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>;
}
