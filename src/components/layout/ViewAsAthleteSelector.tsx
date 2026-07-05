import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Search, UserCircle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientLite {
  id: string;
  name: string;
  is_active: boolean;
}

export function ViewAsAthleteSelector({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['view-as-athlete-clients'],
    enabled: open,
    staleTime: 60_000,
    queryFn: async (): Promise<ClientLite[]> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, is_active')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as ClientLite[];
    },
  });

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));

  const go = (clientId?: string) => {
    setOpen(false);
    navigate(clientId ? `/athlete?clientId=${clientId}` : '/athlete');
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        title={isCollapsed ? 'Visualizar como atleta' : undefined}
        className={cn(
          'w-full gap-2 text-xs border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive',
          isCollapsed && 'lg:justify-center lg:px-2',
        )}
      >
        <Eye className="h-4 w-4 flex-shrink-0" />
        <span className={cn(isCollapsed && 'lg:hidden')}>Visualizar como atleta</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Visualizar área do atleta
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* View as admin (preview) */}
            <button
              type="button"
              onClick={() => go()}
              className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent transition-colors"
            >
              <Shield className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Visualizar como admin</p>
                <p className="text-xs text-muted-foreground">Prévia do app com o conteúdo configurado</p>
              </div>
            </button>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar atleta..."
                className="pl-8"
              />
            </div>

            <div className="max-h-[320px] overflow-y-auto -mx-1 px-1 space-y-1">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-6">Carregando atletas…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum atleta encontrado.</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => go(c.id)}
                    className="w-full flex items-center gap-3 rounded-lg p-2.5 text-left hover:bg-accent transition-colors"
                  >
                    <UserCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{c.name}</span>
                    {!c.is_active && <span className="text-[10px] text-muted-foreground">inativo</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
