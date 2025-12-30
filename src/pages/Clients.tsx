import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ClientsList } from '@/components/clients/ClientsList';
import { ClientForm } from '@/components/clients/ClientForm';
import { Client } from '@/types/client';
import { getClients, addClient, updateClient, deleteClient } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const { toast } = useToast();

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredClients(
        clients.filter(
          c =>
            c.name.toLowerCase().includes(query) ||
            c.email.toLowerCase().includes(query) ||
            c.phone.includes(query)
        )
      );
    } else {
      setFilteredClients(clients);
    }
  }, [searchQuery, clients]);

  const loadClients = () => {
    const data = getClients();
    setClients(data);
    setFilteredClients(data);
  };

  const handleSubmit = (data: Omit<Client, 'id' | 'createdAt'>) => {
    if (editingClient) {
      updateClient(editingClient.id, data);
      toast({
        title: 'Atleta atualizado',
        description: 'Os dados foram salvos com sucesso.',
      });
    } else {
      addClient(data);
      toast({
        title: 'Atleta cadastrado',
        description: 'O novo atleta foi adicionado com sucesso.',
      });
    }
    loadClients();
    setShowForm(false);
    setEditingClient(undefined);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja remover este atleta?')) {
      deleteClient(id);
      toast({
        title: 'Atleta removido',
        description: 'O atleta foi removido com sucesso.',
        variant: 'destructive',
      });
      loadClients();
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingClient(undefined);
  };

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
          <span>{clients.filter(c => c.isActive).length} ativos</span>
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
