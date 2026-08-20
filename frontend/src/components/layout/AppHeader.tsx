import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KakeboSymbol } from '@/components/brand/KakeboSymbol';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AppHeader({ currentPage, onOpenMenu, onLogout }: { currentPage: string; onOpenMenu: () => void; onLogout: () => void }) {
  return <header className="flex h-16 items-center justify-between border-b bg-card px-3 md:hidden">
    <div className="flex min-w-0 items-center gap-2">
      <Button aria-label="Abrir menu" variant="ghost" size="icon" onClick={onOpenMenu}><Menu /></Button>
      <KakeboSymbol className="h-8 w-8" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">Você está em</p>
        <p className="truncate font-display text-sm font-bold">{currentPage}</p>
      </div>
    </div>
    <div className="flex items-center">
      <ThemeToggle />
      <Button aria-label="Sair da conta" variant="ghost" size="icon" onClick={onLogout}><LogOut /></Button>
    </div>
  </header>;
}
