import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => <textarea
    ref={ref}
    className={cn('flex min-h-24 w-full resize-y rounded-[10px] border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors duration-200 placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60', className)}
    {...props}
  />,
);
Textarea.displayName = 'Textarea';

export { Textarea };
