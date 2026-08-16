import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ClipboardList, FileText, Edit, Trash2, Copy, CalendarCheck, Library, Sparkles, ClipboardCheck, Bike } from 'lucide-react';
import { useCheckinForms, useDeleteCheckinForm, useCreateCheckinForm, useCreateDefaultCheckinForm } from '@/hooks/useCheckinForms';
import { useAnamneseForms, useDeleteAnamneseForm, useCreateAnamneseForm, useCreateDefaultAnamneseForm, useCreateEnduranceAnamneseForm, useCreateAnamneseCompletaForm } from '@/hooks/useAnamneseForms';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { AnamneseResponsesTab } from '@/components/forms/AnamneseResponsesTab';
import { CheckinAuditTab } from '@/components/forms/CheckinAuditTab';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const TAB_PARAM_MAP: Record<string, string> = {
  reviews: 'checkin',
  respostas: 'anamnese',
  anamnese: 'anamnese',
  checkin: 'checkin',
  agendados: 'agendados',
  conferencia: 'conferencia',
  banco: 'banco',
};

const VALID_TABS = ['checkin', 'agendados', 'conferencia', 'anamnese', 'banco'];

export default function Forms() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const tabFromUrl = searchParams.get('tab') || '';
  const resolvedTab = TAB_PARAM_MAP[tabFromUrl] || 'checkin';
  const [activeTab, setActiveTab] = useState(VALID_TABS.includes(resolvedTab) ? resolvedTab : 'checkin');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  useEffect(() => {
    const t = searchParams.get('tab') || '';
    const mapped = TAB_PARAM_MAP[t];
    if (mapped && mapped !== activeTab) {
      setActiveTab(mapped);
    }
  }, [searchParams]);

  const [showNewFormDialog, setShowNewFormDialog] = useState(false);
  const [newFormType, setNewFormType] = useState<'checkin' | 'anamnese'>('checkin');
  const [newFormData, setNewFormData] = useState({ title: '', description: '' });

  // Checkin forms
  const { data: checkinForms = [], isLoading: checkinLoading } = useCheckinForms();
  const deleteCheckinForm = useDeleteCheckinForm();
  const createCheckinForm = useCreateCheckinForm();
  const createDefaultCheckinForm = useCreateDefaultCheckinForm();

  // Anamnese forms
  const { data: anamneseForms = [], isLoading: anamneseLoading } = useAnamneseForms();
  const deleteAnamneseForm = useDeleteAnamneseForm();
  const createAnamneseForm = useCreateAnamneseForm();
  const createDefaultAnamneseForm = useCreateDefaultAnamneseForm();
  const createEnduranceAnamneseForm = useCreateEnduranceAnamneseForm();
  const createAnamneseCompletaForm = useCreateAnamneseCompletaForm();

  // Badge counts
  const { data: pendingCheckinCount = 0 } = useQuery({
    queryKey: ['pending_checkin_count', user?.id],
    queryFn: async () => {
      const { data: responses, error } = await supabase
        .from('checkin_responses')
        .select('id', { count: 'exact', head: false })
        .limit(200);
      if (error) return 0;
      
      const ids = responses?.map(r => r.id) || [];
      if (ids.length === 0) return 0;
      
      const { data: feedbacks } = await supabase
        .from('checkin_feedbacks')
        .select('checkin_response_id')
        .in('checkin_response_id', ids)
        .eq('status', 'sent');
      
      const sentIds = new Set(feedbacks?.map(f => f.checkin_response_id) || []);
      return ids.filter(id => !sentIds.has(id)).length;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: pendingAnamneseCount = 0 } = useQuery({
    queryKey: ['pending_anamnese_count', user?.id],
    queryFn: async () => {
      // Unlinked responses
      const { data: forms } = await supabase
        .from('anamnese_forms')
        .select('id')
        .eq('user_id', user?.id);
      if (!forms?.length) return 0;
      
      const { count: unlinkedCount } = await supabase
        .from('anamnese_responses')
        .select('id', { count: 'exact', head: true })
        .in('form_id', forms.map(f => f.id))
        .is('client_id', null);

      // Pending anamnese clients
      const { count: pendingCount } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('athlete_status', 'pending_anamnese');

      return (unlinkedCount || 0) + (pendingCount || 0);
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const handleCreateForm = async () => {
    if (!newFormData.title.trim()) {
      toast({ title: 'Erro', description: 'O título é obrigatório.', variant: 'destructive' });
      return;
    }

    try {
      if (newFormType === 'checkin') {
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
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível criar o formulário.', variant: 'destructive' });
    }
  };

  const handleDeleteCheckin = async (id: string) => {
    try {
      await deleteCheckinForm.mutateAsync(id);
      toast({ title: 'Formulário excluído com sucesso!' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível excluir.', variant: 'destructive' });
    }
  };

  const handleDeleteAnamnese = async (id: string) => {
    try {
      await deleteAnamneseForm.mutateAsync(id);
      toast({ title: 'Formulário excluído com sucesso!' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível excluir.', variant: 'destructive' });
    }
  };

  const copyFormLink = (formId: string, type: 'checkin' | 'anamnese') => {
    const baseUrl = window.location.origin;
    const link = type === 'checkin' ? `${baseUrl}/form/${formId}` : `${baseUrl}/anamnese-form/${formId}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
  };

  const handleCreateDefaultForm = async () => {
    try {
      const form = await createDefaultCheckinForm.mutateAsync();
      toast({ title: 'Formulário padrão criado!' });
      navigate(`/checkin/${form.id}`);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível criar.', variant: 'destructive' });
    }
  };

  const handleCreateDefaultAnamneseForm = async () => {
    try {
      const form = await createDefaultAnamneseForm.mutateAsync();
      toast({ title: 'Anamnese padrão criada!' });
      navigate(`/anamnese/${form.id}`);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível criar.', variant: 'destructive' });
    }
  };

  const handleCreateEnduranceAnamneseForm = async () => {
    try {
      const form = await createEnduranceAnamneseForm.mutateAsync();
      toast({ title: 'Anamnese Endurance criada!', description: 'Wizard de 1 pergunta por tela.' });
      navigate(`/anamnese/${form.id}`);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível criar.', variant: 'destructive' });
    }
  };

  const handleCreateAnamneseCompletaForm = async () => {
    try {
      const form = await createAnamneseCompletaForm.mutateAsync();
      toast({ title: 'ANAMNESE COMPLETA criada!', description: 'Criada inativa (29 perguntas, wizard). Revise e ative quando quiser.' });
      navigate(`/anamnese/${form.id}`);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível criar. Verifique se a migration da Fase 1 foi aplicada.', variant: 'destructive' });
    }
  };

  const openNewFormDialog = (type: 'checkin' | 'anamnese') => {
    setNewFormType(type);
    setNewFormData({ title: '', description: '' });
    setShowNewFormDialog(true);
  };

  // Contextual actions per tab
  const renderActions = () => {
    if (activeTab === 'checkin') {
      return (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCreateDefaultForm} disabled={createDefaultCheckinForm.isPending}>
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Criar Padrão</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => openNewFormDialog('checkin')}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Novo Checkin</span>
          </Button>
        </div>
      );
    }
    if (activeTab === 'anamnese') {
      return (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCreateDefaultAnamneseForm} disabled={createDefaultAnamneseForm.isPending}>
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Criar Padrão</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCreateEnduranceAnamneseForm} disabled={createEnduranceAnamneseForm.isPending}>
            <Bike className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Endurance (wizard)</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCreateAnamneseCompletaForm} disabled={createAnamneseCompletaForm.isPending}>
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Anamnese Completa</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => openNewFormDialog('anamnese')}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nova Anamnese</span>
          </Button>
        </div>
      );
    }
    return null;
  };

  const renderFormCard = (form: any, type: 'checkin' | 'anamnese') => (
    <Card key={form.id} className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate">{form.title}</CardTitle>
            {form.description && (
              <CardDescription className="mt-1 line-clamp-2 text-xs">{form.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {type === 'anamnese' && form.is_required && (
              <Badge variant="destructive" className="text-[10px] px-1.5 h-5">Obrigatório</Badge>
            )}
            <Badge variant={form.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5 h-5">
              {form.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
            onClick={() => navigate(type === 'checkin' ? `/checkin/${form.id}` : `/anamnese/${form.id}`)}>
            <Edit className="h-3 w-3" /> Editar
          </Button>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
            onClick={() => copyFormLink(form.id, type)}>
            <Copy className="h-3 w-3" /> Link
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
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
                <AlertDialogAction onClick={() => type === 'checkin' ? handleDeleteCheckin(form.id) : handleDeleteAnamnese(form.id)}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Formulários</h1>
            <p className="text-xs text-muted-foreground">Check-ins, anamneses e banco de perguntas</p>
          </div>
          {renderActions()}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Mobile-optimized tabs with labels always visible */}
          <TabsList className="w-full grid grid-cols-5 h-auto p-1 gap-0.5">
            <TabsTrigger value="checkin" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-3 py-2 relative">
              <ClipboardList className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="leading-tight">Check-in</span>
              {pendingCheckinCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-0.5 h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center">
                  {pendingCheckinCount > 99 ? '99+' : pendingCheckinCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="agendados" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-3 py-2">
              <CalendarCheck className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="leading-tight">Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="conferencia" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-3 py-2">
              <ClipboardCheck className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="leading-tight">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="anamnese" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-3 py-2 relative">
              <FileText className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="leading-tight">Anamn.</span>
              {pendingAnamneseCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-0.5 h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center">
                  {pendingAnamneseCount > 99 ? '99+' : pendingAnamneseCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="banco" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-3 py-2">
              <Library className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="leading-tight">Banco</span>
            </TabsTrigger>
          </TabsList>

          {/* Check-in Tab: Pending reviews + form templates */}
          <TabsContent value="checkin" className="space-y-4 mt-4">
            <PendingReviewsList />

            {checkinLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : checkinForms.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-base font-semibold mb-1">Nenhum formulário de checkin</h3>
                  <p className="text-sm text-muted-foreground mb-3">Crie seu primeiro formulário para acompanhar seus atletas</p>
                  <Button size="sm" onClick={() => openNewFormDialog('checkin')} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Criar Formulário
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {checkinForms.map((form: any) => renderFormCard(form, 'checkin'))}
              </div>
            )}
          </TabsContent>

          {/* Scheduled Checkins */}
          <TabsContent value="agendados" className="space-y-4 mt-4">
            <ScheduledCheckinsSection />
          </TabsContent>

          {/* Checkin Audit */}
          <TabsContent value="conferencia" className="space-y-4 mt-4">
            <CheckinAuditTab />
          </TabsContent>

          {/* Anamnese Tab: Pending + Responses + Form templates */}
          <TabsContent value="anamnese" className="space-y-4 mt-4">
            {/* Pending anamnese clients */}
            <PendingAnamneseList />

            {/* Anamnese responses (linked + unlinked) */}
            <AnamneseResponsesTab />

            {/* Anamnese form templates (collapsible section) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Modelos de Anamnese
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-5">{anamneseForms.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {anamneseLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : anamneseForms.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground mb-3">Nenhum formulário de anamnese criado</p>
                    <Button size="sm" onClick={() => openNewFormDialog('anamnese')} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Criar Anamnese
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {anamneseForms.map((form: any) => renderFormCard(form, 'anamnese'))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Question Bank */}
          <TabsContent value="banco" className="space-y-4 mt-4">
            <SemanticReviewPanel />
            <QuestionBankSection />
          </TabsContent>
        </Tabs>
      </div>

      {/* New Form Dialog */}
      <Dialog open={showNewFormDialog} onOpenChange={setShowNewFormDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Novo Formulário de {newFormType === 'checkin' ? 'Checkin' : 'Anamnese'}
            </DialogTitle>
            <DialogDescription>
              Crie um novo formulário para {newFormType === 'checkin' ? 'acompanhar seus atletas' : 'coletar informações detalhadas'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={newFormData.title}
                onChange={(e) => setNewFormData({ ...newFormData, title: e.target.value })}
                placeholder={newFormType === 'checkin' ? 'Ex: Checkin Semanal' : 'Ex: Anamnese Inicial'}
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
            <Button variant="outline" onClick={() => setShowNewFormDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateForm} disabled={createCheckinForm.isPending || createAnamneseForm.isPending}>
              Criar Formulário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
