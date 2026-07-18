import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useClients, type Client } from '@/hooks/useClients';
import { Search, Utensils, UtensilsCrossed, CircleCheck, CircleDashed, ChevronRight, ClipboardList, Loader2, CalendarClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PLAN_LABEL: Record<string, string> = { consultoria: 'Consultoria', premium: 'Premium', zona_nutri_diet: 'Zona Nutri Diet' };

// Índice de quais clientes já têm plano alimentar montado.
function useMealPlanIndex() {
  return useQuery({
    queryKey: ['meal-plan-index'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_analyses').select('client_id, updated_at, caloric_deficit');
      if (error) throw error;
      const map: Record<string, { hasPlan: boolean; updatedAt: string }> = {};
      for (const row of data || []) {
        const meals = (row.caloric_deficit as any)?.meal_plan?.meals;
        map[(row as any).client_id] = { hasPlan: Array.isArray(meals) && meals.length > 0, updatedAt: (row as any).updated_at };
      }
      return map;
    },
  });
}

export default function MealPlans() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useClients();
  const { data: planIndex = {} } = useMealPlanIndex();

  const [search, setSearch] = useState('');
  const [planType, setPlanType] = useState('all');
  const [status, setStatus] = useState<'all' | 'with' | 'without'>('all');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients as Client[])
      .filter((c) => c.is_active)
      .map((c) => ({ client: c, ...(planIndex[c.id] || { hasPlan: false, updatedAt: '' }) }))
      .filter((r) => (q ? r.client.name.toLowerCase().includes(q) : true))
      .filter((r) => (planType === 'all' ? true : r.client.plan_type === planType))
      .filter((r) => (status === 'all' ? true : status === 'with' ? r.hasPlan : !r.hasPlan))
      .sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [clients, planIndex, search, planType, status]);

  const withPlan = rows.filter((r) => r.hasPlan).length;

  const initials = (n: string) => n.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Plano Alimentar</h1>
            <p className="text-sm text-muted-foreground">Crie e gerencie os planos alimentares dos atletas</p>
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-2xl font-bold">{rows.length}</p><p className="text-xs text-muted-foreground">Atletas ativos</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-2xl font-bold text-emerald-600">{withPlan}</p><p className="text-xs text-muted-foreground">Com plano</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-2xl font-bold text-amber-600">{rows.length - withPlan}</p><p className="text-xs text-muted-foreground">Sem plano</p></CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar atleta..." className="pl-8" />
          </div>
          <Select value={planType} onValueChange={setPlanType}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os planos</SelectItem>
              <SelectItem value="consultoria">Consultoria</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="zona_nutri_diet">Zona Nutri Diet</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="with">Com plano</SelectItem>
              <SelectItem value="without">Sem plano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Utensils className="h-10 w-10 mx-auto mb-3 opacity-40" />
            Nenhum atleta encontrado.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(({ client, hasPlan, updatedAt }) => (
              <button
                key={client.id}
                onClick={() => navigate(`/meal-plans/${client.id}/editor`)}
                className="w-full flex items-center gap-3 rounded-xl border bg-card p-3 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                  {initials(client.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{client.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{PLAN_LABEL[client.plan_type] || client.plan_type}</Badge>
                    {client.athlete_status === 'pending_anamnese' && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-600">
                        <ClipboardList className="h-3 w-3" /> Anamnese pendente
                      </Badge>
                    )}
                    {hasPlan && updatedAt && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> {format(parseISO(updatedAt), "dd/MM/yy", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
                {hasPlan ? (
                  <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium shrink-0">
                    <CircleCheck className="h-4 w-4" /> <span className="hidden sm:inline">Plano criado</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 text-sm font-medium shrink-0">
                    <CircleDashed className="h-4 w-4" /> <span className="hidden sm:inline">Sem plano</span>
                  </span>
                )}
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
