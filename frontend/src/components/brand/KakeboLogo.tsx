import { cn } from '@/lib/utils';

type KakeboLogoProps = {
  variant?: 'primary' | 'inverse' | 'symbol';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
};

export function KakeboLogo({ variant = 'primary', size = 'md', className }: KakeboLogoProps) {
  const classes = cn('w-auto shrink-0 object-contain', sizeClasses[size], className);

  if (variant === 'primary') {
    return <>
      <img src="/brand/kakebo-logo-notebook-primary.png" alt="Kakebo" className={cn(classes, 'dark:hidden')} />
      <img src="/brand/kakebo-logo-inverse.png" alt="Kakebo" className={cn(classes, 'hidden dark:block')} />
    </>;
  }

  const source = variant === 'symbol'
    ? '/brand/kakebo-symbol.png'
    : '/brand/kakebo-logo-inverse.png';

  return <img
    src={source}
    alt={variant === 'symbol' ? '' : 'Kakebo'}
    aria-hidden={variant === 'symbol' ? true : undefined}
    className={classes}
  />;
}
