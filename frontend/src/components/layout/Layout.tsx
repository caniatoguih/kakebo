import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppMobileNavigation, AppSidebar, appNavItems } from '@/components/layout/AppSidebar';
import { AppShell } from '@/components/layout/AppShell';

export function Layout() {
  const location = useLocation();
  const { logout, usuario } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentItem = appNavItems.find((item) => location.pathname.startsWith(item.path)) ?? appNavItems[0];

  return <AppShell
    sidebar={<AppSidebar pathname={location.pathname} open={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={logout} user={usuario} />}
    header={<AppHeader currentPage={currentItem.name} onOpenMenu={() => setMobileOpen(true)} onLogout={logout} />}
    mobileNavigation={<AppMobileNavigation pathname={location.pathname} onNavigate={() => setMobileOpen(false)} />}
  >
    <Outlet />
  </AppShell>;
}
