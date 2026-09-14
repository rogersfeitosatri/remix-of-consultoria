import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar, AdminNavLinks } from './Sidebar';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLayoutSettings } from '@/hooks/useLayoutSettings';
import logoRF from '@/assets/logo-rf.jpg';

export function Layout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { settings } = useLayoutSettings();
  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:p-3">Ir para o conteúdo</a>
      <Sidebar isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <header className="safe-fixed-top fixed left-0 right-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <img src={settings.logo_url || logoRF} alt="" className="h-8 w-8 rounded-lg object-cover" />
          <span className="truncate font-semibold">{settings.brand_name}</span>
        </div>
        <Link to="/settings" aria-label="Configurações" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><Settings className="h-5 w-5" /></Link>
      </header>
      <main id="main-content" tabIndex={-1} className={cn('min-h-screen pt-14 pb-20 lg:py-0', sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <nav aria-label="Navegação principal no celular" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-1 border-t border-border bg-background px-1 pb-[env(safe-area-inset-bottom,0px)] lg:hidden">
        <AdminNavLinks mobile />
      </nav>
    </div>
  );
}
