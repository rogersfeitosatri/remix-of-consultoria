import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ClipboardList, FileText, Edit, Trash2, Copy, CalendarCheck, Library } from 'lucide-react';
import { useCheckinForms, useDeleteCheckinForm, useCreateCheckinForm } from '@/hooks/useCheckinForms';
import { useAnamneseForms, useDeleteAnamneseForm, useCreateAnamneseForm } from '@/hooks/useAnamneseForms';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PendingReviewsList } from '@/components/forms/PendingReviewsList';
import { PendingAnamneseList } from '@/components/forms/PendingAnamneseList';
import { ScheduledCheckinsSection } from '@/components/forms/ScheduledCheckinsSection';
import { QuestionBankSection } from '@/components/forms/QuestionBankSection';

export default function Forms() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('checkin');
  const [showNewFormDialog, setShowNewFormDialog] = useState(false);
  const [newFormData, setNewFormData] = useState({ title: '', description: '' });

  // Checkin forms
  const { data: checkinForms = [], isLoading: checkinLoading } = useCheckinForms();
  const deleteCheckinForm = useDeleteCheckinForm();
  const createCheckinForm = useCreateCheckinForm();

  // Anamnese forms
  const { data: anamneseForms = [], isLoading: anamneseLoading } = useAnamneseForms();
  const deleteAnamneseForm = useDeleteAnamneseForm();
  const createAnamneseForm = useCreateAnamneseForm();

  const handleCreateForm = async () => {
    if (!newFormData.title.trim()) {
      toast({
        title: 'Erro',
        description: 'O título é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (activeTab === 'checkin') {
        const form = await createCheckinForm.mutateAsync({
          title: newFormData.title,
          description: newFormData.description || null,
        });
        navigate(`/checkin/${form.id}`);
      } else {
        const form = await createAnamneseForm.mutateAsync({
          title: newFormData.title,
          description: newFormData.description || null,
        });
        navigate(`/anamnese/${form.id}`);
      }
      setShowNewFormDialog(false);
      setNewFormData({ title: '', description: '' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o formulário.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCheckin = async (id: string) => {
    try {
      await deleteCheckinForm.mutateAsync(id);
      toast({ title: 'Formulário excluído com sucesso!' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o formulário.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAnamnese = async (id: string) => {
    try {
      await deleteAnamneseForm.mutateAsync(id);
      toast({ title: 'Formulário excluído com sucesso!' });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o formulário.',
        variant: 'destructive',
      });
    }
  };

  const copyFormLink = (formId: string, type: 'checkin' | 'anamnese') => {
    const baseUrl = window.location.origin;
    const link = type === 'checkin' 
      ? `${baseUrl}/form/${formId}`
      : `${baseUrl}/anamnese-form/${formId}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado para a área de transferência!' });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Formulários</h1>
            <p className="text-muted-foreground">
              Gerencie seus formulários de checkin e anamnese
            </p>
          </div>
          <Button 
            onClick={() => setShowNewFormDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo Formulário
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="checkin" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Checkin</span>
            </TabsTrigger>
            <TabsTrigger value="agendados" className="gap-2">
              <CalendarCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Agendados</span>
            </TabsTrigger>
            <TabsTrigger value="anamnese" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Anamnese</span>
            </TabsTrigger>
            <TabsTrigger value="banco" className="gap-2">
              <Library className="h-4 w-4" />
              <span className="hidden sm:inline">Perguntas</span>
            </TabsTrigger>
          </TabsList>

          {/* Scheduled Checkins Tab */}
          <TabsContent value="agendados" className="space-y-6 mt-6">
            <ScheduledCheckinsSection />
          </TabsContent>

          {/* Question Bank Tab */}
          <TabsContent value="banco" className="space-y-6 mt-6">
            <QuestionBankSection />
          </TabsContent>

          {/* Checkin Forms */}
          <TabsContent value="checkin" className="space-y-6 mt-6">
            {/* Pending Reviews List */}
            <PendingReviewsList />

            {/* Forms List */}
            {checkinLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : checkinForms.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum formulário de checkin</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie seu primeiro formulário de checkin para acompanhar seus atletas
                  </p>
                  <Button onClick={() => setShowNewFormDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Formulário
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {checkinForms.map((form: any) => (
                  <Card key={form.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{form.title}</CardTitle>
                          {form.description && (
                            <CardDescription className="mt-1 line-clamp-2">
                              {form.description}
                            </CardDescription>
                          )}
                        </div>
                        <Badge variant={form.is_active ? 'default' : 'secondary'}>
                          {form.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => navigate(`/checkin/${form.id}`)}
                          className="gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => copyFormLink(form.id, 'checkin')}
                          className="gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar Link
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="gap-1">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Todas as respostas serão perdidas.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCheckin(form.id)}>
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
          </TabsContent>

          {/* Anamnese Forms */}
          <TabsContent value="anamnese" className="space-y-6 mt-6">
            {/* Pending Anamnese List */}
            <PendingAnamneseList />

            {anamneseLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : anamneseForms.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum formulário de anamnese</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie formulários de anamnese para coletar informações detalhadas dos atletas
                  </p>
                  <Button onClick={() => { setActiveTab('anamnese'); setShowNewFormDialog(true); }} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Anamnese
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {anamneseForms.map((form: any) => (
                  <Card key={form.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{form.title}</CardTitle>
                          {form.description && (
                            <CardDescription className="mt-1 line-clamp-2">
                              {form.description}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {form.is_required && (
                            <Badge variant="destructive">Obrigatório</Badge>
                          )}
                          <Badge variant={form.is_active ? 'default' : 'secondary'}>
                            {form.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => navigate(`/anamnese/${form.id}`)}
                          className="gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => copyFormLink(form.id, 'anamnese')}
                          className="gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar Link
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="gap-1">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Todas as respostas serão perdidas.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteAnamnese(form.id)}>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* New Form Dialog */}
      <Dialog open={showNewFormDialog} onOpenChange={setShowNewFormDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Novo Formulário de {activeTab === 'checkin' ? 'Checkin' : 'Anamnese'}
            </DialogTitle>
            <DialogDescription>
              Crie um novo formulário para {activeTab === 'checkin' ? 'acompanhar seus atletas' : 'coletar informações detalhadas'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={newFormData.title}
                onChange={(e) => setNewFormData({ ...newFormData, title: e.target.value })}
                placeholder={activeTab === 'checkin' ? 'Ex: Checkin Semanal' : 'Ex: Anamnese Inicial'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={newFormData.description}
                onChange={(e) => setNewFormData({ ...newFormData, description: e.target.value })}
                placeholder="Descreva o objetivo deste formulário..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFormDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateForm}
              disabled={createCheckinForm.isPending || createAnamneseForm.isPending}
            >
              Criar Formulário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
