import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, FileText, Eye, User, Link2, AlertCircle, Trash2, UserPlus, Pencil } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface AnamneseListItem {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  form_title: string;
  submitted_at: string;
  has_ai_analysis: boolean;
}

interface UnlinkedResponse {
  id: string;
  form_id: string;
  form_title: string;
  respondent_name: string | null;
  respondent_email: string | null;
  submitted_at: string;
}

export function AnamneseResponsesTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedUnlinked, setSelectedUnlinked] = useState<UnlinkedResponse | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [responseToDelete, setResponseToDelete] = useState<UnlinkedResponse | null>(null);
  const [deleteLinkedOpen, setDeleteLinkedOpen] = useState(false);
  const [linkedToDelete, setLinkedToDelete] = useState<AnamneseListItem | null>(null);
  const [linkMode, setLinkMode] = useState<'existing' | 'new'>('existing');
  const [newAthleteName, setNewAthleteName] = useState('');
  const [newAthleteEmail, setNewAthleteEmail] = useState('');
  const [newAthletePhone, setNewAthletePhone] = useState('');

  // Fetch all anamnese responses with client info (linked responses)
  const { data: anamneseResponses = [], isLoading } = useQuery({
    queryKey: ['all_anamnese_responses', user?.id],
    queryFn: async () => {
      // Get all anamnese responses with client and form info
      const { data: responses, error } = await supabase
        .from('anamnese_responses')
        .select(`
          id,
          client_id,
          form_id,
          submitted_at,
          ai_analysis,
          clients!inner (
            id,
            name,
            email,
            user_id
          ),
          anamnese_forms!inner (
            title
          )
        `)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      // Filter by current admin's clients
      const adminResponses = responses?.filter(
        (r: any) => r.clients?.user_id === user?.id
      ) || [];

      return adminResponses.map((r: any) => ({
        id: r.id,
        client_id: r.client_id,
        client_name: r.clients?.name || 'Desconhecido',
        client_email: r.clients?.email || null,
        form_title: r.anamnese_forms?.title || 'Formulário',
        submitted_at: r.submitted_at,
        has_ai_analysis: !!r.ai_analysis,
      })) as AnamneseListItem[];
    },
    enabled: !!user,
  });

  // Fetch unlinked responses (no client_id) for admin's forms
  const { data: unlinkedResponses = [] } = useQuery({
    queryKey: ['unlinked_anamnese_responses', user?.id],
    queryFn: async () => {
      // Get admin's form IDs first
      const { data: forms, error: formsError } = await supabase
        .from('anamnese_forms')
        .select('id, title')
        .eq('user_id', user?.id);

      if (formsError) throw formsError;
      if (!forms || forms.length === 0) return [];

      const formIds = forms.map(f => f.id);
      const formTitleMap = forms.reduce((acc, f) => {
        acc[f.id] = f.title;
        return acc;
      }, {} as Record<string, string>);

      // Get responses without client_id for these forms
      // Use select('*') and cast - new columns may not be in types yet
      // @ts-ignore - respondent_name and respondent_email are new columns
      const queryResult = await supabase
        .from('anamnese_responses')
        .select('*')
        .in('form_id', formIds)
        .is('client_id', null)
        .order('submitted_at', { ascending: false });

      if (queryResult.error) throw queryResult.error;
      
      // @ts-ignore
      const responses: any[] = queryResult.data || [];

      return responses.map((r) => ({
        id: r.id,
        form_id: r.form_id,
        form_title: formTitleMap[r.form_id] || 'Formulário',
        respondent_name: r.respondent_name,
        respondent_email: r.respondent_email,
        submitted_at: r.submitted_at,
      })) as UnlinkedResponse[];
    },
    enabled: !!user,
  });

  // Fetch clients for linking dialog
  const { data: clientsForLinking = [] } = useQuery({
    queryKey: ['clients_for_linking', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && linkDialogOpen,
  });

  // Mutation to link response to client
  const linkToClientMutation = useMutation({
    mutationFn: async ({ responseId, clientId }: { responseId: string; clientId: string }) => {
      const { error } = await supabase
        .from('anamnese_responses')
        .update({ client_id: clientId })
        .eq('id', responseId);

      if (error) throw error;

      // Update athlete_profiles to mark anamnese as completed
      const { error: profileError } = await supabase
        .from('athlete_profiles')
        .update({ 
          anamnese_completed: true,
          anamnese_submitted_at: new Date().toISOString()
        })
        .eq('client_id', clientId);

      if (profileError) {
        console.warn('Could not update athlete profile:', profileError);
      }

      // Update client status if pending_anamnese
      const { error: clientError } = await supabase
        .from('clients')
        .update({ athlete_status: 'active' })
        .eq('id', clientId)
        .eq('athlete_status', 'pending_anamnese');

      if (clientError) {
        console.warn('Could not update client status:', clientError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_anamnese_responses'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked_anamnese_responses'] });
      queryClient.invalidateQueries({ queryKey: ['pending_anamnese_for_list'] });
      toast.success('Anamnese vinculada ao atleta com sucesso!');
      setLinkDialogOpen(false);
      setSelectedUnlinked(null);
      setSelectedClientId('');
    },
    onError: (error) => {
      console.error('Error linking response:', error);
      toast.error('Erro ao vincular anamnese');
    },
  });

  // Mutation to delete unlinked response
  const deleteResponseMutation = useMutation({
    mutationFn: async (responseId: string) => {
      const { error } = await supabase
        .from('anamnese_responses')
        .delete()
        .eq('id', responseId)
        .is('client_id', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unlinked_anamnese_responses'] });
      toast.success('Anamnese excluída com sucesso!');
      setDeleteDialogOpen(false);
      setResponseToDelete(null);
    },
    onError: (error) => {
      console.error('Error deleting response:', error);
      toast.error('Erro ao excluir anamnese');
    },
  });

  // Delete a linked (already attached to an athlete) anamnese response
  const deleteLinkedMutation = useMutation({
    mutationFn: async (responseId: string) => {
      const { error } = await supabase
        .from('anamnese_responses')
        .delete()
        .eq('id', responseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_anamnese_responses'] });
      queryClient.invalidateQueries({ queryKey: ['pending_anamnese_for_list'] });
      queryClient.invalidateQueries({ queryKey: ['pending_anamnese_clients'] });
      toast.success('Anamnese excluída com sucesso!');
      setDeleteLinkedOpen(false);
      setLinkedToDelete(null);
    },
    onError: (err) => {
      console.error('Error deleting linked response:', err);
      toast.error('Erro ao excluir anamnese');
    },
  });

  // Mutation to create new athlete and link response
  const createAndLinkMutation = useMutation({
    mutationFn: async ({ responseId, name, email, phone }: { responseId: string; name: string; email: string; phone: string }) => {
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);
      const endDateStr = endDate.toISOString().split('T')[0];

      // Create the client
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: user!.id,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone.trim() || null,
          service_type: 'nutrition',
          plan_type: 'consultoria',
          start_date: today,
          end_date: endDateStr,
          monthly_value: 0,
          is_active: true,
          has_checkin: false,
          athlete_status: 'active',
          registration_source: 'anamnese_manual',
        })
        .select('id')
        .single();

      if (clientError) throw clientError;

      // Create athlete profile
      await supabase
        .from('athlete_profiles')
        .insert({
          client_id: newClient.id,
          full_name: name.trim(),
          anamnese_completed: true,
          anamnese_submitted_at: new Date().toISOString(),
        });

      // Link the response
      const { error: linkError } = await supabase
        .from('anamnese_responses')
        .update({ client_id: newClient.id })
        .eq('id', responseId);

      if (linkError) throw linkError;

      return newClient.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_anamnese_responses'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked_anamnese_responses'] });
      queryClient.invalidateQueries({ queryKey: ['pending_anamnese_clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Atleta criado e anamnese vinculada com sucesso!');
      setLinkDialogOpen(false);
      setSelectedUnlinked(null);
      resetDialogState();
    },
    onError: (error) => {
      console.error('Error creating athlete:', error);
      toast.error('Erro ao criar atleta');
    },
  });
  const { data: pendingClients = [] } = useQuery({
    queryKey: ['pending_anamnese_for_list', user?.id],
    queryFn: async () => {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, email, created_at')
        .eq('user_id', user?.id)
        .eq('athlete_status', 'pending_anamnese');

      if (error) throw error;

      // Check which have responses
      const clientIds = clients?.map(c => c.id) || [];
      if (clientIds.length === 0) return [];

      const { data: responses } = await supabase
        .from('anamnese_responses')
        .select('client_id')
        .in('client_id', clientIds);

      const respondedIds = new Set(responses?.map(r => r.client_id) || []);

      return clients?.filter(c => !respondedIds.has(c.id)).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        created_at: c.created_at,
      })) || [];
    },
    enabled: !!user,
  });

  // Filter responses based on search
  const filteredResponses = useMemo(() => {
    if (!searchTerm.trim()) return anamneseResponses;
    
    const term = searchTerm.toLowerCase();
    return anamneseResponses.filter(
      r => r.client_name.toLowerCase().includes(term) ||
           (r.client_email && r.client_email.toLowerCase().includes(term))
    );
  }, [anamneseResponses, searchTerm]);

  // Filter unlinked responses based on search
  const filteredUnlinked = useMemo(() => {
    if (!searchTerm.trim()) return unlinkedResponses;
    
    const term = searchTerm.toLowerCase();
    return unlinkedResponses.filter(
      r => (r.respondent_name && r.respondent_name.toLowerCase().includes(term)) ||
           (r.respondent_email && r.respondent_email.toLowerCase().includes(term))
    );
  }, [unlinkedResponses, searchTerm]);

  // Filter pending clients based on search
  const filteredPending = useMemo(() => {
    if (!searchTerm.trim()) return pendingClients;
    
    const term = searchTerm.toLowerCase();
    return pendingClients.filter(
      c => c.name.toLowerCase().includes(term) ||
           (c.email && c.email.toLowerCase().includes(term))
    );
  }, [pendingClients, searchTerm]);

  const resetDialogState = () => {
    setSelectedClientId('');
    setLinkMode('existing');
    setNewAthleteName('');
    setNewAthleteEmail('');
    setNewAthletePhone('');
  };

  const openLinkDialog = (response: UnlinkedResponse) => {
    setSelectedUnlinked(response);
    resetDialogState();
    // Pre-fill new athlete fields from response data
    setNewAthleteName(response.respondent_name || '');
    setNewAthleteEmail(response.respondent_email || '');
    setLinkDialogOpen(true);
  };

  const openDeleteDialog = (response: UnlinkedResponse) => {
    setResponseToDelete(response);
    setDeleteDialogOpen(true);
  };

  const handleDeleteResponse = () => {
    if (!responseToDelete) return;
    deleteResponseMutation.mutate(responseToDelete.id);
  };

  const handleLinkToClient = () => {
    if (!selectedUnlinked || !selectedClientId) return;
    linkToClientMutation.mutate({
      responseId: selectedUnlinked.id,
      clientId: selectedClientId,
    });
  };

  const handleCreateAndLink = () => {
    if (!selectedUnlinked || !newAthleteName.trim() || !newAthleteEmail.trim()) return;
    createAndLinkMutation.mutate({
      responseId: selectedUnlinked.id,
      name: newAthleteName,
      email: newAthleteEmail,
      phone: newAthletePhone,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            Anamneses Respondidas
          </CardTitle>
          <CardDescription>
            Visualize todas as respostas de anamnese dos seus atletas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email do atleta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Unlinked Responses - Need to be attached */}
      {filteredUnlinked.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Aguardando Vínculo
              <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                {filteredUnlinked.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Respostas de anamnese que precisam ser vinculadas a um atleta cadastrado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {filteredUnlinked.map((response) => (
                <div
                  key={response.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{response.respondent_name || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {response.respondent_email || 'Sem email'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">{response.form_title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => navigate(`/anamnese-response/${response.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="hidden sm:inline">Ver</span>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2 bg-orange-500 hover:bg-orange-600"
                        onClick={() => openLinkDialog(response)}
                      >
                        <Link2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Vincular</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(response)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Excluir</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submitted Responses */}
      {filteredResponses.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              Concluídas
              <Badge variant="secondary">{filteredResponses.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredResponses.map((response) => (
                <div
                  key={response.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{response.client_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {response.client_email || 'Sem email'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(response.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">{response.form_title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">
                        Concluída
                      </Badge>
                      {response.has_ai_analysis && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                          IA
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => navigate(`/anamnese-response/${response.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                      <span className="hidden sm:inline">Ver</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => navigate(`/anamnese-response/${response.id}?edit=1`)}
                      title="Editar anamnese"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => { setLinkedToDelete(response); setDeleteLinkedOpen(true); }}
                      title="Excluir anamnese"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Excluir</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {/* Empty State */}
      {filteredResponses.length === 0 && filteredPending.length === 0 && filteredUnlinked.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhuma anamnese'}
            </h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Tente buscar com outros termos' 
                : 'Quando atletas responderem anamneses, elas aparecerão aqui'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => { setLinkDialogOpen(open); if (!open) resetDialogState(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular Anamnese</DialogTitle>
            <DialogDescription>
              Vincule a um atleta existente ou crie um novo cadastro.
            </DialogDescription>
          </DialogHeader>

          {selectedUnlinked && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="text-muted-foreground">Resposta de:</p>
                <p className="font-medium">{selectedUnlinked.respondent_name || 'Sem nome'}</p>
                <p className="text-muted-foreground text-xs">
                  {selectedUnlinked.respondent_email || 'Sem email'} · {format(parseISO(selectedUnlinked.submitted_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-2">
                <Button
                  variant={linkMode === 'existing' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => setLinkMode('existing')}
                >
                  <Link2 className="h-4 w-4" />
                  Atleta existente
                </Button>
                <Button
                  variant={linkMode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => setLinkMode('new')}
                >
                  <UserPlus className="h-4 w-4" />
                  Criar novo
                </Button>
              </div>

              {linkMode === 'existing' ? (
                <div className="space-y-2">
                  <Label>Vincular ao atleta:</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um atleta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsForLinking.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} {client.email ? `(${client.email})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input
                      value={newAthleteName}
                      onChange={(e) => setNewAthleteName(e.target.value)}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={newAthleteEmail}
                      onChange={(e) => setNewAthleteEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input
                      value={newAthletePhone}
                      onChange={(e) => setNewAthletePhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancelar
            </Button>
            {linkMode === 'existing' ? (
              <Button
                onClick={handleLinkToClient}
                disabled={!selectedClientId || linkToClientMutation.isPending}
              >
                {linkToClientMutation.isPending ? 'Vinculando...' : 'Vincular'}
              </Button>
            ) : (
              <Button
                onClick={handleCreateAndLink}
                disabled={!newAthleteName.trim() || !newAthleteEmail.trim() || createAndLinkMutation.isPending}
              >
                {createAndLinkMutation.isPending ? 'Criando...' : 'Criar e Vincular'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anamnese?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta anamnese? Essa ação não poderá ser desfeita.
              {responseToDelete && (
                <span className="block mt-2 font-medium text-foreground">
                  {responseToDelete.respondent_name || 'Sem nome'} 
                  {responseToDelete.respondent_email && ` (${responseToDelete.respondent_email})`}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResponseToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteResponse}
              disabled={deleteResponseMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteResponseMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Linked Response Confirmation */}
      <AlertDialog open={deleteLinkedOpen} onOpenChange={setDeleteLinkedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anamnese?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente a anamnese respondida por{' '}
              <span className="font-medium text-foreground">{linkedToDelete?.client_name}</span>.
              O cadastro do atleta não será afetado. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLinkedToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => linkedToDelete && deleteLinkedMutation.mutate(linkedToDelete.id)}
              disabled={deleteLinkedMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLinkedMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
