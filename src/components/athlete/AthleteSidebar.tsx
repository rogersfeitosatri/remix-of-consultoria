import { useState } from 'react';
import logoRF from '@/assets/logo-rf.jpg';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
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
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AthleteSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  clientName: string;
  userEmail: string;
  onSignOut: () => void;
}

const menuItems = [
  { id: 'inicio', label: 'Início', icon: PersonStanding },
  { id: 'dieta', label: 'Dieta', icon: Utensils },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'materiais', label: 'Materiais', icon: FileText },
  { id: 'perfil', label: 'Perfil', icon: User },
];

export function AthleteSidebar({ 
  activeTab, 
  onTabChange, 
  clientName, 
  userEmail, 
  onSignOut 
}: AthleteSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleItemClick = (id: string) => {
    onTabChange(id);
    setIsOpen(false);
  };

  const handleContactSupport = () => {
    window.open('https://wa.me/5511999999999?text=Olá! Preciso de ajuda com a área do atleta.', '_blank');
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
             <img src={logoRF} alt="Rogers Feitosa" className="h-10 w-10 rounded-lg object-cover" />
             <div className="text-left flex items-center gap-2">
               <div>
                 <SheetTitle className="text-lg font-bold text-[hsl(43,74%,49%)]">
                   Rogers Feitosa
                 </SheetTitle>
                 <p className="text-xs text-gray-400">Nutrição & Treinamento</p>
               </div>
              <Badge 
                variant="outline" 
                className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 text-[10px] font-bold px-1.5 py-0"
              >
                BETA
              </Badge>
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

        {/* Beta Info & Support */}
        <div className="absolute bottom-16 left-0 right-0 px-4 pb-2">
          <button
            onClick={handleContactSupport}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm hover:bg-yellow-500/20 transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="text-xs">Versão Beta - Precisa de ajuda?</span>
          </button>
        </div>

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
