import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ClientsList } from '@/components/clients/ClientsList';
import { ClientForm } from '@/components/clients/ClientForm';
import { useClients, useAddClient, useUpdateClient, useDeleteClient, Client } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Loader2, Users, UserX, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const SERVICE_OPTIONS = [
  { value: 'all', label: 'Todos os Serviços' },
  { value: 'nutrition', label: 'Nutrição' },
  { value: 'training', label: 'Treino' },
  { value: 'both', label: 'Ambos' },
];

const PLAN_OPTIONS = [
  { value: 'all', label: 'Todos os Planos' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'premium', label: 'Premium' },
];

export default function Clients() {
  const { data: clients = [], isLoading } = useClients();
  const addClient = useAddClient();
  const updateClient = useUpdateClient();
  const deleteClientMutation = useDeleteClient();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [serviceFilter, setServiceFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const { toast } = useToast();

  const activeClients = useMemo(() => {
    return clients.filter(c => c.is_active);
  }, [clients]);

  const inactiveClients = useMemo(() => {
    return clients.filter(c => !c.is_active);
  }, [clients]);

  const applyFilters = (clientList: Client[]) => {
    return clientList.filter(c => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          c.name.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.phone?.includes(query);
        if (!matchesSearch) return false;
      }
      
      // Service filter
      if (serviceFilter !== 'all' && c.service_type !== serviceFilter) {
        return false;
      }
      
      // Plan filter
      if (planFilter !== 'all' && c.plan_type !== planFilter) {
        return false;
      }
      
      return true;
    });
  };

  const filteredActiveClients = useMemo(() => {
    return applyFilters(activeClients);
  }, [searchQuery, activeClients, serviceFilter, planFilter]);

  const filteredInactiveClients = useMemo(() => {
    return applyFilters(inactiveClients);
  }, [searchQuery, inactiveClients, serviceFilter, planFilter]);

  const handleSubmit = async (
    data: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    options?: { sendCredentials: boolean; skipAnamnese: boolean }
  ) => {
    // OPTIMISTIC UI: Fechar o modal IMEDIATAMENTE
    setShowForm(false);
    setEditingClient(undefined);

    // Processar em background (sem bloquear a UI)
    const processInBackground = async () => {
      try {
        if (editingClient) {
          await updateClient.mutateAsync({ id: editingClient.id, ...data });
          toast({
            title: 'Atleta atualizado',
            description: 'Os dados foram salvos com sucesso.',
          });
        } else {
          // Criar o atleta primeiro
          const newClient = await addClient.mutateAsync(data);
          
          // Se email foi fornecido, criar conta de usuário auth
          if (data.email) {
            try {
              const { data: authResult, error: authError } = await supabase.functions.invoke('create-athlete-auth', {
                body: {
                  email: data.email,
                  name: data.name,
                  clientId: newClient.id,
                },
              });

              if (authError) {
                console.error('Erro ao criar conta do atleta:', authError);
                toast({
                  title: 'Aviso',
                  description: 'Atleta cadastrado, mas houve erro ao criar conta de acesso.',
                  variant: 'destructive',
                });
              } else {
                // Invalidar cache para atualizar athlete_user_id na lista
                queryClient.invalidateQueries({ queryKey: ['clients'] });
                
                if (options?.sendCredentials && data.phone) {
                  // Enviar credenciais via Z-API (WhatsApp direto)
                  const baseUrl = window.location.origin;
                  const message = `🏃 *RF Assessoria - Bem-vindo!*\n\nOlá ${data.name}!\n\nSua conta foi criada com sucesso.\n\n📧 *Login:* ${data.email}\n🔑 *Senha:* 123456\n\n🔗 Acesse: ${baseUrl}/auth\n\n⚠️ Recomendamos trocar sua senha no primeiro acesso.\n\nQualquer dúvida, estamos à disposição!`;
                  
                  try {
                    const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp', {
                      body: {
                        clientId: newClient.id,
                        message: message,
                      },
                    });
                    
                    if (whatsappError) {
                      console.error('Erro ao enviar WhatsApp:', whatsappError);
                      toast({
                        title: 'Aviso',
                        description: 'Atleta cadastrado, mas houve erro ao enviar credenciais via WhatsApp.',
                        variant: 'destructive',
                      });
                    } else {
                      toast({
                        title: 'Credenciais enviadas',
                        description: 'Mensagem de boas-vindas enviada via WhatsApp com sucesso!',
                      });
                    }
                  } catch (whatsappErr) {
                    console.error('Erro ao enviar WhatsApp:', whatsappErr);
                  }
                }
              }
            } catch (err) {
              console.error('Erro ao processar conta do atleta:', err);
            }
          }
          
          if (!options?.sendCredentials) {
            toast({
              title: 'Atleta cadastrado',
              description: 'O novo atleta foi adicionado com sucesso.',
            });
          }
        }
      } catch (error) {
        console.error('Erro ao salvar atleta:', error);
        toast({
          title: 'Erro ao salvar',
          description: 'Ocorreu um erro ao salvar os dados. Por favor, tente novamente.',
          variant: 'destructive',
        });
      }
    };

    // Executar em background sem await
    processInBackground();
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este atleta?')) {
      try {
        await deleteClientMutation.mutateAsync(id);
        toast({
          title: 'Atleta removido',
          description: 'O atleta foi removido com sucesso.',
          variant: 'destructive',
        });
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Ocorreu um erro ao remover o atleta.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingClient(undefined);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Atletas</h1>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
              Gerencie seus atletas e acompanhamentos
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Novo Atleta
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Serviço" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Ativos</span> ({activeClients.length})
            </TabsTrigger>
            <TabsTrigger value="inactive" className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <UserX className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Inativos</span> ({inactiveClients.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="mt-6">
            <div className="mb-4 text-sm text-muted-foreground">
              {filteredActiveClients.length} atletas ativos encontrados
            </div>
            <ClientsList
              clients={filteredActiveClients}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </TabsContent>
          
          <TabsContent value="inactive" className="mt-6">
            <div className="mb-4 text-sm text-muted-foreground">
              {filteredInactiveClients.length} atletas inativos encontrados
            </div>
            {filteredInactiveClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum atleta inativo</p>
              </div>
            ) : (
              <ClientsList
                clients={filteredInactiveClients}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Form Modal */}
      {showForm && (
        <ClientForm
          client={editingClient}
          onSubmit={handleSubmit}
          onClose={handleCloseForm}
        />
      )}
    </Layout>
  );
}