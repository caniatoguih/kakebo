import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, PiggyBank, CreditCard, Menu, LogOut, Tags, Cloud, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export function Layout() {
  const location = useLocation();
  const { logout, usuario } = useAuth();
  
  const navItems = [
    { name: 'Reflexão', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Fluxo de Caixa', path: '/transacoes', icon: Receipt },
    { name: 'Orçamento', path: '/planejamento', icon: PiggyBank },
    { name: 'Fluxo Contábil', path: '/fluxo-contabil', icon: ScrollText },
    { name: 'Contas', path: '/contas', icon: CreditCard },
    { name: 'Categorias', path: '/categorias', icon: Tags },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50/50 dark:bg-slate-950 p-0 md:p-4">
      {/* App Canvas Frame (Large rounded container sitting on soft background) */}
      <div className="flex w-full h-full overflow-hidden bg-card md:rounded-[2rem] border border-slate-200/50 dark:border-slate-800/60 md:shadow-[0_8px_32px_rgba(0,0,0,0.03)] transition-all duration-300">
        
        {/* Sidebar (Desktop) */}
        <aside className="hidden w-64 flex-col border-r border-slate-100 dark:border-slate-800/60 bg-card md:flex">
          {/* Brand Logo Header */}
          <div className="flex h-20 items-center px-6 gap-2.5">
            <div className="p-2 rounded-xl bg-pink-600 text-white shadow-md shadow-pink-500/20">
              <Cloud className="h-5 w-5 fill-white/10" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 font-sans">kakebo</span>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 space-y-1.5 px-4 py-2">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 border-l-[3px]",
                    isActive 
                      ? "bg-pink-50 text-pink-600 border-l-pink-600 dark:bg-pink-950/20 dark:text-pink-400 dark:border-l-pink-500 font-bold shadow-[0_4px_12px_rgba(219,39,119,0.03)]" 
                      : "text-slate-400 border-l-transparent hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  )}
                >
                  <item.icon className={cn("h-4.5 w-4.5 transition-colors", isActive ? "text-pink-600 dark:text-pink-400" : "text-slate-400")} />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User Profile & Logout at Bottom */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-3 mt-auto">
            {usuario && (
              <div className="flex items-center gap-3 px-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-pink-500/20 text-sm shrink-0">
                  {usuario.nome
                    ? usuario.nome.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{usuario.nome}</p>
                  <p className="text-[10px] font-semibold text-slate-400 truncate">{usuario.email}</p>
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full justify-start gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/20 dark:hover:bg-rose-950/20 transition-all duration-300"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sair da Conta
            </Button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col overflow-hidden bg-card">
          {/* Header (Hidden on Desktop) */}
          <header className="flex md:hidden h-20 items-center justify-between border-b border-slate-100 dark:border-slate-800/60 bg-card px-6">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" className="rounded-lg">
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 ml-4">
                <div className="p-1.5 rounded-lg bg-pink-600 text-white">
                  <Cloud className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">kakebo</span>
              </div>
            </div>
            
            <div className="flex flex-1 justify-end items-center gap-4">
              <Button variant="ghost" size="sm" onClick={logout} className="gap-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/20 dark:hover:bg-rose-950/20 transition-all duration-300 font-semibold">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </header>

          {/* Page Outlet inside clean scrollable container */}
          <div className="flex-1 overflow-auto p-6 md:p-8">
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
