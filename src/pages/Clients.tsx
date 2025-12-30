import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ClientsList } from '@/components/clients/ClientsList';
import { ClientForm } from '@/components/clients/ClientForm';
import { useClients, useAddClient, useUpdateClient, useDeleteClient, Client } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Clients() {
  const { data: clients = [], isLoading } = useClients();
  const addClient = useAddClient();
  const updateClient = useUpdateClient();
  const deleteClientMutation = useDeleteClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const { toast } = useToast();

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
    );
  }, [searchQuery, clients]);

  const handleSubmit = async (data: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingClient) {
        await updateClient.mutateAsync({ id: editingClient.id, ...data });
        toast({
          title: 'Atleta atualizado',
          description: 'Os dados foram salvos com sucesso.',
        });
      } else {
        await addClient.mutateAsync(data);
        toast({
          title: 'Atleta cadastrado',
          description: 'O novo atleta foi adicionado com sucesso.',
        });
      }
      setShowForm(false);
      setEditingClient(undefined);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao salvar os dados.',
        variant: 'destructive',
      });
    }
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Atletas</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie seus atletas e acompanhamentos
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Atleta
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{filteredClients.length} atletas encontrados</span>
          <span>•</span>
          <span>{clients.filter(c => c.is_active).length} ativos</span>
        </div>

        {/* List */}
        <ClientsList
          clients={filteredClients}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
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
