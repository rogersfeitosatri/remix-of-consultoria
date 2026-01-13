import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, FileText, Eye, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnamneseListItem {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  form_title: string;
  submitted_at: string;
  has_ai_analysis: boolean;
}

export function AnamneseResponsesTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all anamnese responses with client info
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

  // Also fetch clients without anamnese (pending)
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

  // Filter pending clients based on search
  const filteredPending = useMemo(() => {
    if (!searchTerm.trim()) return pendingClients;
    
    const term = searchTerm.toLowerCase();
    return pendingClients.filter(
      c => c.name.toLowerCase().includes(term) ||
           (c.email && c.email.toLowerCase().includes(term))
    );
  }, [pendingClients, searchTerm]);

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
                      <span className="hidden sm:inline">Ver anamnese</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending (No Response Yet) */}
      {filteredPending.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              Pendentes
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                {filteredPending.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Atletas que ainda não preencheram a anamnese
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {filteredPending.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{client.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {client.email || 'Sem email'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-muted-foreground">
                        Cadastrado em {format(parseISO(client.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      Pendente
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {filteredResponses.length === 0 && filteredPending.length === 0 && (
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
    </div>
  );
}
