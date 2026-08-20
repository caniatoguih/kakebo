import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function AppShell({ sidebar, header, mobileNavigation, children, className }: { sidebar: ReactNode; header: ReactNode; mobileNavigation: ReactNode; children: ReactNode; className?: string }) {
  return <div className="flex h-screen w-full overflow-hidden bg-background md:p-4">
    <div className={cn('relative flex h-full w-full overflow-hidden border-border/70 bg-card md:rounded-xl md:border md:shadow-card', className)}>
      {sidebar}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background/60">
        {header}
        <div className="flex-1 overflow-auto px-4 pb-24 pt-5 sm:px-6 md:px-8 md:pb-10 md:pt-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </div>
        {mobileNavigation}
      </main>
    </div>
  </div>;
}
