import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Home, LogOut, Settings, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLayoutSettings } from '@/hooks/useLayoutSettings';
import { ViewAsAthleteSelector } from './ViewAsAthleteSelector';
import { ADMIN_NAVIGATION, getAdminArea } from '@/lib/adminNavigation';
import logoRFDefault from '@/assets/logo-rf.jpg';

const icons = { '/admin': Home, '/clients': Users, '/checkin-hub': ClipboardCheck, '/calendar': CalendarDays, '/financial': Wallet };

export function AdminNavLinks({ mobile = false, collapsed = false }: { mobile?: boolean; collapsed?: boolean }) {
  const { pathname } = useLocation();
  const area = getAdminArea(pathname);
  return <>{ADMIN_NAVIGATION.map(item => {
    const Icon = icons[item.key];
    const active = area === item.key;
    return (
      <Link key={item.key} to={item.key} aria-label={item.label} aria-current={active ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
        className={cn('flex min-h-11 items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          mobile ? 'min-w-0 flex-col justify-center gap-1 py-2 text-[11px]' : 'gap-3 px-4 py-3 text-sm',
          collapsed && !mobile && 'justify-center px-2',
          active ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {(!collapsed || mobile) && <span>{item.label}</span>}
      </Link>
    );
  })}</>;
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { signOut } = useAuth();
  const { settings } = useLayoutSettings();
  const { pathname } = useLocation();
  return (
    <aside className={cn('fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col', isCollapsed ? 'w-16' : 'w-64')}>
      <div className="flex h-20 items-center gap-3 px-3">
        <img src={settings.logo_url || logoRFDefault} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        {!isCollapsed && <div className="min-w-0"><p className="truncate font-semibold">{settings.brand_name}</p><p className="text-xs text-muted-foreground">Acompanhamento dos atletas</p></div>}
      </div>
      <button onClick={onToggleCollapse} aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        className="absolute -right-5 top-20 flex h-11 w-11 items-center justify-center rounded-full border bg-background focus-visible:ring-2 focus-visible:ring-ring">
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
      <nav aria-label="Navegação principal" className="flex-1 space-y-2 overflow-y-auto p-3 pt-8">
        <AdminNavLinks collapsed={isCollapsed} />
      </nav>
      <div className="space-y-2 border-t border-border p-3">
        <Link to="/settings" title={isCollapsed ? 'Configurações' : undefined} aria-current={getAdminArea(pathname) === '/settings' ? 'page' : undefined}
          className={cn('flex min-h-11 items-center gap-3 rounded-lg p-3 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring', isCollapsed && 'justify-center')}>
          <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />{!isCollapsed && 'Configurações'}
        </Link>
        <ViewAsAthleteSelector isCollapsed={isCollapsed} />
        <button onClick={() => signOut()} aria-label="Sair" className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg p-3 text-sm text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring', isCollapsed && 'justify-center')}>
          <LogOut className="h-5 w-5" aria-hidden="true" />{!isCollapsed && 'Sair'}
        </button>
      </div>
    </aside>
  );
}
