import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, UtensilsCrossed, AlertTriangle, Loader2 } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { usePendingMealPlans, useCreateMealPlanStatus } from '@/hooks/useMealPlanStatus';
import { useCreateTask } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface MealPlanTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MealPlanTaskDialog({ open, onOpenChange }: MealPlanTaskDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: pendingPlans = [] } = usePendingMealPlans();

  // Get IDs of clients that already have pending meal plans
  const clientsWithPendingPlans = useMemo(() => 
    new Set(pendingPlans.map(p => p.client_id)),
    [pendingPlans]
  );

  // Filter active clients and apply search
  const filteredClients = useMemo(() => {
    return clients
      .filter(c => c.is_active)
      .filter(c => {
        if (!search) return true;
        const query = search.toLowerCase();
        return c.name.toLowerCase().includes(query) ||
               c.email?.toLowerCase().includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, search]);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const hasPendingPlan = selectedClientId ? clientsWithPendingPlans.has(selectedClientId) : false;

  const handleCreate = async () => {
    if (!selectedClientId || !user?.id || !selectedClient) return;

    // Check if already has pending plan
    if (hasPendingPlan) {
      toast.error('Este atleta já possui um plano alimentar pendente');
      return;
    }

    setIsCreating(true);

    try {
      const today = new Date();
      const dayOfWeek = today.getDay();

      // Create the task first
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: `Enviar plano alimentar - ${selectedClient.name}`,
          description: `Pendente: enviar plano alimentar para o atleta ${selectedClient.name}`,
          day_of_week: dayOfWeek === 0 ? 1 : dayOfWeek,
          is_pinned: true,
        })
        .select('id')
        .single();

      if (taskError) throw taskError;

      // Create or update meal plan status
      const { data: existingStatus } = await supabase
        .from('meal_plan_status')
        .select('id')
        .eq('client_id', selectedClientId)
        .maybeSingle();

      if (existingStatus) {
        // Update existing to pending
        const { error: updateError } = await supabase
          .from('meal_plan_status')
          .update({
            status: 'pending',
            sent_at: null,
            task_id: taskData.id,
          })
          .eq('client_id', selectedClientId);

        if (updateError) throw updateError;
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('meal_plan_status')
          .insert({
            client_id: selectedClientId,
            user_id: user.id,
            status: 'pending',
            task_id: taskData.id,
          });

        if (insertError) throw insertError;
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan-status'] });
      queryClient.invalidateQueries({ queryKey: ['pending-meal-plans'] });

      toast.success(`Tarefa de plano alimentar criada para ${selectedClient.name}`);
      
      // Reset and close
      setSelectedClientId(null);
      setSearch('');
      onOpenChange(false);

    } catch (error) {
      console.error('Error creating meal plan task:', error);
      toast.error('Erro ao criar tarefa de plano alimentar');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSelectedClientId(null);
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-orange-600" />
            Nova Tarefa de Plano Alimentar
          </DialogTitle>
          <DialogDescription>
            Selecione um atleta para criar uma tarefa de envio de plano alimentar pendente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar atleta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Client List */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Atletas ativos ({filteredClients.length})
            </Label>
            
            {clientsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[250px] rounded-md border">
                <div className="p-2 space-y-1">
                  {filteredClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum atleta encontrado
                    </p>
                  ) : (
                    filteredClients.map((client) => {
                      const isPending = clientsWithPendingPlans.has(client.id);
                      const isSelected = selectedClientId === client.id;

                      return (
                        <button
                          key={client.id}
                          onClick={() => setSelectedClientId(client.id)}
                          disabled={isPending}
                          className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                            isSelected
                              ? 'bg-primary/10 border border-primary/30'
                              : isPending
                              ? 'bg-muted/50 opacity-60 cursor-not-allowed'
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <div>
                            <p className="font-medium text-sm">{client.name}</p>
                            {client.email && (
                              <p className="text-xs text-muted-foreground">{client.email}</p>
                            )}
                          </div>
                          {isPending && (
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                              Pendente
                            </Badge>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Warning for pending */}
          {hasPendingPlan && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Este atleta já possui um plano alimentar pendente.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedClientId || hasPendingPlan || isCreating}
            className="gap-2"
          >
            {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
            <UtensilsCrossed className="h-4 w-4" />
            Criar Tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
