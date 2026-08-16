import { Home, Utensils, ClipboardCheck, CalendarDays, User } from 'lucide-react';

export type AthleteScreen =
  | 'dashboard'
  | 'plano'
  | 'checkins'
  | 'consultas'
  | 'orientacoes'
  | 'evolucao'
  | 'perfil'
  | 'provas';

const TABS: { id: AthleteScreen; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Início', icon: Home },
  { id: 'plano', label: 'Plano', icon: Utensils },
  { id: 'checkins', label: 'Check-ins', icon: ClipboardCheck },
  { id: 'consultas', label: 'Consultas', icon: CalendarDays },
  { id: 'perfil', label: 'Perfil', icon: User },
];


const GOLD = 'hsl(43,74%,49%)';

export function BottomNavigation({
  active,
  onChange,
}: {
  active: AthleteScreen;
  onChange: (s: AthleteScreen) => void;
}) {
  return (
    <nav
      className="safe-fixed-bottom fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 border-t border-gray-800 bg-[#0b0c0e]/95 backdrop-blur-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const isActive = active === t.id || (t.id === 'dashboard' && active === 'provas');
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 active:scale-95 transition-transform"
            >
              <Icon className="h-5 w-5 transition-colors" style={{ color: isActive ? GOLD : '#7b7f87' }} />
              <span className="text-[10px] font-medium" style={{ color: isActive ? GOLD : '#7b7f87' }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
