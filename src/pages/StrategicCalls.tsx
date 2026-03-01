import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStrategicCalls, useCreateStrategicCall, useStrategicCallResponses } from '@/hooks/useStrategicCalls';
import { Plus, Eye, Loader2, Phone } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ResponseCount({ callId }: { callId: string }) {
  const { data: responses } = useStrategicCallResponses(callId);
  return <span>{responses?.length ?? 0}</span>;
}

export default function StrategicCalls() {
  const navigate = useNavigate();
  const { data: calls = [], isLoading } = useStrategicCalls();
  const createCall = useCreateStrategicCall();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const handleCreate = () => {
    if (!newName.trim() || !newSlug.trim()) return;
    createCall.mutate({ name: newName, slug: newSlug }, {
      onSuccess: (data: any) => {
        setShowCreate(false);
        setNewName('');
        setNewSlug('');
        navigate(`/calls/${data.id}`);
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Calls Estratégicas</h1>
            <p className="text-muted-foreground">Gerencie suas calls e aplicações</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Criar Novo Formulário
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : calls.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma call criada ainda.</p>
              <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4">
                Criar primeira call
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {calls.map(call => (
              <Card key={call.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate(`/calls/${call.id}`)}>
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{call.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">/{call.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={call.status === 'active' ? 'default' : 'secondary'}>
                      {call.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      <ResponseCount callId={call.id} /> aplicações
                    </div>
                    <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); navigate(`/calls/${call.id}/responses`); }}>
                      <Eye className="h-4 w-4 mr-1" /> Ver Respostas
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Call</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Call Maratonistas" />
            </div>
            <div>
              <Label>URL personalizada</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/call/</span>
                <Input value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="maratonistas" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createCall.isPending || !newName.trim() || !newSlug.trim()}>
              {createCall.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
