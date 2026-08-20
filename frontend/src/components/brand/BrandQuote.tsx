import { BookHeart } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandQuote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <blockquote className={cn('flex gap-3 rounded-lg border border-primary/15 bg-secondary/70 p-4 text-sm text-secondary-foreground', className)}>
    <BookHeart className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <p className="font-display font-medium leading-relaxed">{children}</p>
  </blockquote>;
}
