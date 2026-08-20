import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  Fuel,
  LayoutDashboard,
  LogOut,
  PiggyBank,
  Receipt,
  RefreshCw,
  ScrollText,
  Tags,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { UserData } from '@/contexts/AuthContext';
import { KakeboLogo } from '@/components/brand/KakeboLogo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

type NavItem = {
  name: string;
  shortName: string;
  description: string;
  path: string;
  icon: LucideIcon;
  primary: boolean;
};

export const appNavItems: NavItem[] = [
  { name: 'Reflexão', shortName: 'Reflexão', description: 'Resumo mensal e análise dos pilares Kakebo', path: '/dashboard', icon: LayoutDashboard, primary: true },
  { name: 'Fluxo de Caixa', shortName: 'Fluxo', description: 'Receitas, despesas e transferências', path: '/transacoes', icon: Receipt, primary: true },
  { name: 'Planejamento', shortName: 'Planejar', description: 'Orçamento mensal por categoria', path: '/planejamento', icon: PiggyBank, primary: true },
  { name: 'Visão Contábil', shortName: 'Contábil', description: 'Consolidação de saldos e movimentações por período', path: '/fluxo-contabil', icon: ScrollText, primary: false },
  { name: 'Recorrências', shortName: 'Recorrências', description: 'Receitas, despesas e transferências recorrentes', path: '/recorrencias', icon: RefreshCw, primary: false },
  { name: 'Contas e Cartões', shortName: 'Contas', description: 'Saldos, cartões e faturas', path: '/contas', icon: CreditCard, primary: true },
  { name: 'Categorias', shortName: 'Categorias', description: 'Classificações de receitas e despesas', path: '/categorias', icon: Tags, primary: false },
  { name: 'Lembretes', shortName: 'Lembretes', description: 'Avisos de contas e faturas a vencer', path: '/notificacoes', icon: Bell, primary: false },
];

const planningItems = [
  { name: 'Orçamento mensal', path: '/planejamento', icon: PiggyBank },
  { name: 'Planejamento Salarial', path: '/planejamento/salario', icon: Building2 },
  { name: 'Consumo de Combustível', path: '/planejamento/combustivel', icon: Fuel },
];

const initials = (name?: string) => name
  ? name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  : 'U';

type AppSidebarProps = {
  pathname: string;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  user: UserData | null;
};

export function AppSidebar({ pathname, open, onClose, onLogout, user }: AppSidebarProps) {
  const [planningOpen, setPlanningOpen] = useState(() => pathname.startsWith('/planejamento'));

  return <>
    {open && <button type="button" aria-label="Fechar menu" className="absolute inset-0 z-30 bg-foreground/35 md:hidden" onClick={onClose} />}
    <aside className={cn(
      'absolute z-40 flex h-full w-64 flex-col border-r bg-card transition-transform duration-200 ease-out md:relative md:translate-x-0',
      open ? 'translate-x-0 shadow-xl' : '-translate-x-full',
    )}>
      <div className="flex h-20 items-center justify-between px-5">
        <KakeboLogo size="md" className="max-w-36" />
        <Button aria-label="Fechar menu" variant="ghost" size="icon" className="md:hidden" onClick={onClose}><X /></Button>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {appNavItems.map((item) => {
          const active = item.path === '/planejamento' ? pathname.startsWith(item.path) : pathname.startsWith(item.path);
          const hasChildren = item.path === '/planejamento';
          return <div key={item.path}>
            <Link
              to={item.path}
              title={item.description}
              aria-current={active ? 'page' : undefined}
              aria-expanded={hasChildren ? planningOpen : undefined}
              onClick={(event) => {
                if (hasChildren) {
                  event.preventDefault();
                  setPlanningOpen((current) => !current);
                  return;
                }
                onClose();
              }}
              className={cn(
                'group flex min-h-11 items-center gap-3 rounded-md border-l-[3px] px-3 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active
                  ? 'border-l-primary bg-secondary text-primary'
                  : 'border-l-transparent text-muted-foreground hover:bg-accent/70 hover:text-primary',
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="flex-1">{item.name}</span>
              {hasChildren && <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', planningOpen && 'rotate-180')} aria-hidden="true" />}
            </Link>
            {hasChildren && planningOpen && <div className="ml-5 mt-1 space-y-1 border-l border-border pl-3">
              {planningItems.map((child) => {
                const childActive = pathname === child.path;
                return <Link
                  key={child.path}
                  to={child.path}
                  aria-current={childActive ? 'page' : undefined}
                  onClick={onClose}
                  className={cn(
                    'flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    childActive ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-accent/60 hover:text-primary',
                  )}
                >
                  <child.icon className="h-3.5 w-3.5" aria-hidden="true" />{child.name}
                </Link>;
              })}
            </div>}
          </div>;
        })}
      </nav>

      <div className="mt-auto border-t p-4">
        {user && <div className="mb-3 flex items-center gap-3 px-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary font-display text-sm font-bold text-primary">{initials(user.nome)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.nome}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>}
        <div className="grid grid-cols-2 gap-1">
          <ThemeToggle showLabel className="justify-start text-muted-foreground" />
          <Button variant="ghost" size="sm" onClick={onLogout} className="justify-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <LogOut />Sair
          </Button>
        </div>
      </div>
    </aside>
  </>;
}

export function AppMobileNavigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return <nav aria-label="Navegação principal mobile" className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
    {appNavItems.filter((item) => item.primary).map((item) => {
      const active = pathname.startsWith(item.path);
      return <Link key={item.path} to={item.path} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={cn('flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'text-primary' : 'text-muted-foreground hover:bg-accent hover:text-primary')}>
        <item.icon className="h-5 w-5" aria-hidden="true" /><span>{item.shortName}</span>
      </Link>;
    })}
  </nav>;
}
