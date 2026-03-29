import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, ChevronRight, CheckCircle, User, Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PendingAnamneseClient {
  id: string;
  name: string;
  email: string | null;
  athlete_status: string | null;
  created_at: string;
  hasAnamneseResponse: boolean;
}

export function PendingAnamneseList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<PendingAnamneseClient | null>(null);

  // Fetch clients with pending anamnese status
  const { data: pendingClients = [], isLoading } = useQuery({
    queryKey: ['pending_anamnese_clients', user?.id],
    queryFn: async () => {
      // Get clients with pending_anamnese status
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, email, athlete_status, created_at')
        .eq('user_id', user?.id)
        .eq('athlete_status', 'pending_anamnese')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which ones have anamnese responses submitted
      const clientIds = clients?.map(c => c.id) || [];
      if (clientIds.length === 0) return [];

      const { data: responses, error: responsesError } = await supabase
        .from('anamnese_responses')
        .select('client_id')
        .in('client_id', clientIds);

      if (responsesError) throw responsesError;

      const respondedIds = new Set(responses?.map(r => r.client_id) || []);

      return clients?.map(c => ({
        ...c,
        hasAnamneseResponse: respondedIds.has(c.id),
      })) as PendingAnamneseClient[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markAsReviewed = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .update({ athlete_status: 'active' })
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_anamnese_clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Status atualizado para ativo!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (clientId: string) => {
      // First delete related anamnese responses if any
      await supabase
        .from('anamnese_responses')
        .delete()
        .eq('client_id', clientId);
      
      // Delete athlete profile if exists
      await supabase
        .from('athlete_profiles')
        .delete()
        .eq('client_id', clientId);
      
      // Delete the client
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending_anamnese_clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Atleta excluído com sucesso!');
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    },
    onError: () => {
      toast.error('Erro ao excluir atleta');
    },
  });

  const handleDeleteClick = (client: PendingAnamneseClient) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (clientToDelete) {
      deleteClient.mutate(clientToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Anamnese Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate into submitted (waiting review) and not submitted (waiting athlete)
  const submittedPending = pendingClients.filter(c => c.hasAnamneseResponse);
  const awaitingSubmission = pendingClients.filter(c => !c.hasAnamneseResponse);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-purple-500" />
              Anamnese Pendentes
              {pendingClients.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingClients.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Atletas aguardando preenchimento ou revisão de anamnese
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pendingClients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            ✓ Nenhuma anamnese pendente
          </p>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {/* Submitted - waiting review */}
            {submittedPending.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                  Aguardando Revisão ({submittedPending.length})
                </p>
                <div className="space-y-2">
                  {submittedPending.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center gap-2 p-2.5 sm:p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 transition-colors cursor-pointer active:scale-[0.99]"
                      onClick={() => navigate(`/clients/${client.id}/analysis`)}
                    >
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-xs sm:text-sm truncate">{client.name}</p>
                          <Badge className="text-[9px] sm:text-[10px] px-1 h-4 sm:h-5 bg-purple-500/10 text-purple-500 border-purple-500/20">
                            Enviada
                          </Badge>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                          Aguardando revisão
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsReviewed.mutate(client.id);
                          }}
                          disabled={markAsReviewed.isPending}
                          title="Aprovar"
                        >
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(client);
                          }}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Not submitted - waiting athlete */}
            {awaitingSubmission.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                  Aguardando Preenchimento ({awaitingSubmission.length})
                </p>
                <div className="space-y-2">
                  {awaitingSubmission.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cadastrado em {format(parseISO(client.created_at), "dd/MM/yyyy", { locale: ptBR })} - aguardando preenchimento
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          Pendente
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/clients/${client.id}`);
                          }}
                          title="Editar atleta"
                        >
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(client);
                          }}
                          title="Excluir atleta"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir permanentemente o atleta "{clientToDelete?.name}" e todos os dados associados (anamnese, perfil). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
