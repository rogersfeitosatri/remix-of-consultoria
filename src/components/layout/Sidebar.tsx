import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Wallet, X, LogOut, CalendarDays, Settings, ChevronLeft, ChevronRight, ClipboardList, Eye, Clock, FileText, Link, CheckSquare, Activity, Network, ClipboardCheck, PhoneCall, CalendarPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useLayoutSettings } from '@/hooks/useLayoutSettings';
import logoRFDefault from '@/assets/logo-rf.jpg';

const iconMap: Record<string, any> = {
  '/admin': LayoutDashboard,
  '/tasks': CheckSquare,
  '/clients': Users,
  '/checkin-hub': ClipboardCheck,
  '/periodization': Activity,
  '/metabolic-web': Network,
  '/financial': Wallet,
  '/calendar': CalendarDays,
  '/scheduling': Clock,
  '/content': FileText,
  '/link-bio': Link,
  '/forms': ClipboardList,
  '/calls': PhoneCall,
  '/scheduling-links': CalendarPlus,
  '/settings': Settings,
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isOpen, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { settings } = useLayoutSettings();

  const handleSignOut = async () => {
    await signOut();
  };

  const handleViewAsAthlete = () => {
    navigate('/athlete');
  };

  const logoSrc = settings.logo_url || logoRFDefault;
  const visibleItems = settings.sidebar_items.filter(item => item.visible);

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
              <img src={logoSrc} alt={settings.brand_name} className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
              <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
                <h1 className="text-lg font-bold text-sidebar-foreground truncate">{settings.brand_name}</h1>
                <p className="text-xs text-muted-foreground">{settings.brand_subtitle}</p>
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
            {visibleItems.map((item) => {
              const isActive = location.pathname === item.key;
              const Icon = iconMap[item.key] || LayoutDashboard;
              return (
                <NavLink
                  key={item.key}
                  to={item.key}
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
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className={cn("truncate", isCollapsed && "lg:hidden")}>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Footer with user info and logout */}
          <div className="border-t border-sidebar-border p-4 space-y-3">
            {/* View as Athlete Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewAsAthlete}
              title={isCollapsed ? "Ver como atleta" : undefined}
              className={cn(
                "w-full gap-2 text-xs border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive",
                isCollapsed && "lg:justify-center lg:px-2"
              )}
            >
              <Eye className="h-4 w-4 flex-shrink-0" />
              <span className={cn(isCollapsed && "lg:hidden")}>Ver como atleta</span>
            </Button>
            
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
