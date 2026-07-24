import { useContext } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeContext } from '@/App';

export function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="gap-2"
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? 'Tema claro' : 'Tema escuro'}</span>
    </Button>
  );
}
