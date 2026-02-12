import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import logoRF from '@/assets/logo-rf.jpg';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <img src={logoRF} alt="Rogers Feitosa" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-semibold text-foreground">Rogers Feitosa</span>
        </div>
      </header>
      
      {/* Main Content */}
      <main className={cn(
        "min-h-screen pt-14 lg:pt-0 transition-all duration-300",
        sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
      )}>
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}