import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const actionLabel = dark ? 'Usar tema claro' : 'Usar tema escuro';

  return <Button
    type="button"
    variant="ghost"
    size={showLabel ? 'sm' : 'icon'}
    className={cn(className)}
    aria-label={actionLabel}
    title={actionLabel}
    onClick={toggleTheme}
  >
    {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    {showLabel && <span>{dark ? 'Tema claro' : 'Tema escuro'}</span>}
  </Button>;
}
