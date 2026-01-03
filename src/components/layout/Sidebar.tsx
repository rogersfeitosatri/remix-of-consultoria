import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Wallet, Dumbbell, X, LogOut, CalendarDays, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Atletas' },
  { to: '/financial', icon: Wallet, label: 'Financeiro' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendário' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isOpen, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-50 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
          "lg:translate-x-0 lg:z-40",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "lg:w-16" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            <div className={cn("flex items-center gap-3", isCollapsed && "lg:justify-center lg:w-full")}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary flex-shrink-0">
                <Dumbbell className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
                <h1 className="text-lg font-bold text-sidebar-foreground truncate">RF Assessoria</h1>
                <p className="text-xs text-muted-foreground">Esportiva</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button 
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            >
              <X className="h-5 w-5 text-sidebar-foreground" />
            </button>
          </div>

          {/* Collapse toggle button - desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex absolute -right-3 top-20 h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar hover:bg-sidebar-accent transition-colors z-50"
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3 text-sidebar-foreground" />
            ) : (
              <ChevronLeft className="h-3 w-3 text-sidebar-foreground" />
            )}
          </button>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isCollapsed && 'lg:justify-center lg:px-2'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className={cn("truncate", isCollapsed && "lg:hidden")}>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Footer with user info and logout */}
          <div className="border-t border-sidebar-border p-4 space-y-3">
            {user && !isCollapsed && (
              <div className="rounded-lg bg-sidebar-accent p-3 lg:block hidden">
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
                  {user.email}
                </p>
              </div>
            )}
            {user && (
              <div className={cn("rounded-lg bg-sidebar-accent p-3 lg:hidden")}>
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">
                  {user.email}
                </p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              title={isCollapsed ? "Sair" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors",
                isCollapsed && "lg:justify-center lg:px-2"
              )}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className={cn(isCollapsed && "lg:hidden")}>Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}