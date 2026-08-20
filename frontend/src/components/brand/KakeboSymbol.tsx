import { cn } from '@/lib/utils';

export function KakeboSymbol({ className, decorative = true }: { className?: string; decorative?: boolean }) {
  return <img
    src="/brand/kakebo-symbol.png"
    alt={decorative ? '' : 'Símbolo Kakebo'}
    aria-hidden={decorative || undefined}
    className={cn('aspect-square object-contain', className)}
  />;
}
