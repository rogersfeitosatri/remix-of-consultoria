import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, FileText, Copy, ExternalLink, Trash2, Eye, ToggleLeft, ToggleRight, Trophy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useCheckinForms, useCreateCheckinForm, useDeleteCheckinForm, useUpdateCheckinForm } from '@/hooks/useCheckinForms';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function Checkin() {
  const navigate = useNavigate();
  const { data: forms = [], isLoading } = useCheckinForms();
  const createForm = useCreateCheckinForm();
  const deleteForm = useDeleteCheckinForm();
  const updateForm = useUpdateCheckinForm();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState('');
  const [newFormDescription, setNewFormDescription] = useState('');
  const [newFormIsPeriodization, setNewFormIsPeriodization] = useState(false);

  const handleCreateForm = async () => {
    if (!newFormTitle.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    try {
      const form = await createForm.mutateAsync({
        title: newFormTitle,
        description: newFormDescription || undefined,
        is_periodization: newFormIsPeriodization,
      });
      toast.success('Formulário criado!');
      setIsCreateOpen(false);
      setNewFormTitle('');
      setNewFormDescription('');
      setNewFormIsPeriodization(false);
      navigate(`/checkin/${form.id}`);
    } catch (error) {
      toast.error('Erro ao criar formulário');
    }
  };

  const handleDeleteForm = async (id: string) => {
    try {
      await deleteForm.mutateAsync(id);
      toast.success('Formulário excluído!');
    } catch (error) {
      toast.error('Erro ao excluir formulário');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateForm.mutateAsync({ id, is_active: !currentActive });
      toast.success(currentActive ? 'Formulário desativado' : 'Formulário ativado');
    } catch (error) {
      toast.error('Erro ao atualizar formulário');
    }
  };

  const copyFormLink = (formId: string, isPeriodization?: boolean) => {
    const path = isPeriodization ? `/np-form/${formId}` : `/form/${formId}`;
    const link = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Checkin</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Crie questionários personalizados para seus atletas
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Formulário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Formulário</DialogTitle>
                <DialogDescription>
                  Dê um nome e descrição para o seu formulário de checkin
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={newFormTitle}
                    onChange={(e) => setNewFormTitle(e.target.value)}
                    placeholder="Ex: Checkin Semanal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={newFormDescription}
                    onChange={(e) => setNewFormDescription(e.target.value)}
                    placeholder="Descreva o propósito deste formulário..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <div>
                      <Label htmlFor="is_periodization" className="cursor-pointer">Formulário de Periodização</Label>
                      <p className="text-xs text-muted-foreground">Use para o check-in da Preparação de Prova (NutriPeriodiza). O link público inclui o bloco de métricas core (GI, energia, sono, aderência).</p>
                    </div>
                  </div>
                  <Switch id="is_periodization" checked={newFormIsPeriodization} onCheckedChange={setNewFormIsPeriodization} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateForm} disabled={createForm.isPending}>
                  Criar Formulário
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : forms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum formulário criado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro formulário de checkin para acompanhar seus atletas
              </p>
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Formulário
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {forms.map((form) => (
              <Card key={form.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{form.title}</CardTitle>
                      {form.description && (
                        <CardDescription className="line-clamp-2 mt-1">
                          {form.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={form.is_active ? 'default' : 'secondary'}>
                      {form.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Criado em {format(new Date(form.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => navigate(`/checkin/${form.id}`)}
                    >
                      <Eye className="h-3 w-3" />
                      Editar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => copyFormLink(form.id)}
                    >
                      <Copy className="h-3 w-3" />
                      Copiar Link
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => window.open(`/form/${form.id}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(form.id, form.is_active)}
                    >
                      {form.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Formulário?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Todas as respostas associadas também serão excluídas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteForm(form.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
