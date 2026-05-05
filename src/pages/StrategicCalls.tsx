import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useStrategicCalls, useCreateStrategicCall, useStrategicCallResponses,
  useUpdateStrategicCall, useDeleteStrategicCall, type StrategicCall,
} from '@/hooks/useStrategicCalls';
import { Plus, Eye, Loader2, Phone, Pencil, Trash2 } from 'lucide-react';
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
  const updateCall = useUpdateStrategicCall();
  const deleteCall = useDeleteStrategicCall();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [editing, setEditing] = useState<StrategicCall | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<StrategicCall | null>(null);

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

  const openEdit = (call: StrategicCall) => {
    setEditing(call);
    setEditName(call.name);
    setEditSlug(call.slug);
  };

  const handleUpdate = () => {
    if (!editing || !editName.trim() || !editSlug.trim()) return;
    updateCall.mutate(
      { id: editing.id, name: editName.trim(), slug: editSlug.trim() },
      { onSuccess: () => setEditing(null) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteCall.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
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
                <CardHeader className="flex flex-row items-center justify-between py-4 gap-3 flex-wrap">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{call.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">/{call.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={call.status === 'active' ? 'default' : 'secondary'}>
                      {call.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      <ResponseCount callId={call.id} /> aplicações
                    </div>
                    <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); navigate(`/calls/${call.id}/responses`); }}>
                      <Eye className="h-4 w-4 mr-1" /> Ver Respostas
                    </Button>
                    <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); openEdit(call); }}>
                      <Pencil className="h-4 w-4 mr-1" /> Renomear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(call); }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Excluir
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Call</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>URL personalizada</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/call/</span>
                <Input
                  value={editSlug}
                  onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateCall.isPending || !editName.trim() || !editSlug.trim()}>
              {updateCall.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir call "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e removerá a call, suas perguntas e respostas associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCall.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
