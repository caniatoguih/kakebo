import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, PiggyBank, CreditCard, Menu, LogOut, Tags, Cloud, ScrollText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export function Layout() {
  const location = useLocation();
  const { logout, usuario } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const navItems = [
    { name: 'Reflexão', shortName: 'Reflexão', description: 'Resumo mensal e análise dos pilares Kakebo', path: '/dashboard', icon: LayoutDashboard, primary: true },
    { name: 'Fluxo de Caixa', shortName: 'Fluxo', description: 'Receitas, despesas e transferências', path: '/transacoes', icon: Receipt, primary: true },
    { name: 'Planejamento', shortName: 'Planejar', description: 'Orçamento mensal por categoria', path: '/planejamento', icon: PiggyBank, primary: true },
    { name: 'Visão Contábil', shortName: 'Contábil', description: 'Consolidação de saldos e movimentações por período', path: '/fluxo-contabil', icon: ScrollText, primary: false },
    { name: 'Contas e Cartões', shortName: 'Contas', description: 'Saldos, cartões e faturas', path: '/contas', icon: CreditCard, primary: true },
    { name: 'Categorias', shortName: 'Categorias', description: 'Classificações de receitas e despesas', path: '/categorias', icon: Tags, primary: false },
  ];
  const currentItem = navItems.find((item) => location.pathname.startsWith(item.path)) ?? navItems[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 p-0 md:p-4">
      {/* App Canvas Frame (Large rounded container sitting on soft background) */}
      <div className="relative flex w-full h-full overflow-hidden bg-card md:rounded-[2rem] border border-slate-200/50 dark:border-slate-800/60 md:shadow-[0_8px_32px_rgba(0,0,0,0.03)] transition-all duration-300">
        
        {/* Mobile Overlay */}
        {isMobileOpen && (
          <div 
            className="absolute inset-0 z-30 bg-slate-900/50 backdrop-blur-sm md:hidden transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar (Desktop & Mobile) */}
        <aside className={cn(
          "absolute md:relative z-40 h-full w-64 flex-col border-r border-slate-100 dark:border-slate-800/60 bg-card flex transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        )}>
          {/* Brand Logo Header */}
          <div className="flex h-20 items-center justify-between px-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                <Cloud className="h-5 w-5 fill-white/10" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 font-sans">kakebo</span>
            </div>
            <Button aria-label="Fechar menu" variant="ghost" size="icon" className="md:hidden text-slate-600" onClick={() => setIsMobileOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 space-y-1.5 px-4 py-2">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.description}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 border-l-[3px]",
                    isActive 
                      ? "bg-emerald-50 text-emerald-800 border-l-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-l-emerald-500 font-bold shadow-[0_4px_12px_rgba(5,150,105,0.03)]"
                      : "text-slate-600 border-l-transparent hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  )}
                >
                  <item.icon className={cn("h-4.5 w-4.5 transition-colors", isActive ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400")} />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User Profile & Logout at Bottom */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-3 mt-auto">
            {usuario && (
              <div className="flex items-center gap-3 px-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-emerald-500/20 text-sm shrink-0">
                  {usuario.nome
                    ? usuario.nome.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{usuario.nome}</p>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">{usuario.email}</p>
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full justify-start gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50/20 dark:hover:bg-rose-950/20 transition-all duration-300"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sair da Conta
            </Button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col overflow-hidden bg-card">
          {/* Header (Hidden on Desktop) */}
          <header className="flex md:hidden h-20 items-center justify-between border-b border-slate-100 dark:border-slate-800/60 bg-card px-4">
            <div className="flex items-center">
              <Button aria-label="Abrir menu" variant="ghost" size="icon" className="rounded-lg" onClick={() => setIsMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div className="ml-3"><p className="text-xs font-medium text-muted-foreground">Você está em</p><p className="text-base font-bold text-slate-800 dark:text-slate-100">{currentItem.name}</p></div>
            </div>
            
            <div className="flex flex-1 justify-end items-center gap-4">
              <Button variant="ghost" size="sm" onClick={logout} className="gap-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50/20 dark:hover:bg-rose-950/20 transition-all duration-300 font-semibold">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </header>

          {/* Page Outlet inside clean scrollable container */}
          <div className="flex-1 overflow-auto p-4 pb-24 sm:p-6 sm:pb-24 md:p-8">
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </div>
          <nav aria-label="Navegação principal mobile" className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
            {navItems.filter((item) => item.primary).map((item) => {
              const active = location.pathname.startsWith(item.path);
              return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={cn('flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <item.icon className="h-5 w-5" /><span>{item.shortName}</span>
              </Link>;
            })}
          </nav>
        </main>
      </div>
    </div>
  );
}
