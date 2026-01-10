import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  Menu, 
  LogOut,
  PersonStanding,
  Utensils,
  ClipboardCheck,
  MessageSquare,
  FileText,
  History,
  User,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AthleteSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  clientName: string;
  userEmail: string;
  onSignOut: () => void;
}

interface AthleteSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  clientName: string;
  userEmail: string;
  onSignOut: () => void;
  hasZonaNutriAccess?: boolean;
}

const getMenuItems = (hasZonaNutriAccess: boolean) => {
  const items = [
    { id: 'dashboard', label: 'Início', icon: PersonStanding },
    { id: 'dieta', label: 'Plano Alimentar', icon: Utensils },
    { id: 'checkins', label: 'Check-ins', icon: ClipboardCheck },
    { id: 'feedbacks', label: 'Feedbacks', icon: MessageSquare },
    { id: 'materiais', label: 'Materiais', icon: FileText },
    { id: 'historico', label: 'Histórico', icon: History },
  ];
  
  if (hasZonaNutriAccess) {
    items.push({ id: 'zonanutri', label: 'Zona Nutri', icon: Zap });
  }
  
  items.push({ id: 'perfil', label: 'Perfil', icon: User });
  
  return items;
};

export function AthleteSidebar({ 
  activeTab, 
  onTabChange, 
  clientName, 
  userEmail, 
  onSignOut,
  hasZonaNutriAccess = false
}: AthleteSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuItems = getMenuItems(hasZonaNutriAccess);

  const handleItemClick = (id: string) => {
    onTabChange(id);
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-gray-800 md:hidden"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-gray-900 border-gray-800 text-white w-72 p-0">
        <SheetHeader className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(43,74%,49%)]">
              <PersonStanding className="h-5 w-5 text-black" />
            </div>
            <div className="text-left">
              <SheetTitle className="text-lg font-bold text-[hsl(43,74%,49%)]">
                RF Assessoria
              </SheetTitle>
              <p className="text-xs text-gray-400">Esportiva</p>
            </div>
          </div>
        </SheetHeader>

        {/* User Info */}
        <div className="p-4 border-b border-gray-800">
          <p className="font-medium text-white">{clientName}</p>
          <p className="text-xs text-gray-400">{userEmail}</p>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                  activeTab === item.id
                    ? "bg-[hsl(43,74%,49%)] text-black"
                    : "text-gray-300 hover:bg-gray-800"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={onSignOut}
          >
            <LogOut className="h-5 w-5" />
            Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
