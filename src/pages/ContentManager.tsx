import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useSupportMaterials,
  useCreateSupportMaterial,
  useUpdateSupportMaterial,
  useDeleteSupportMaterial,
  useDietAppConfig,
  useSaveDietAppConfig,
  type SupportMaterialCategory,
} from '@/hooks/useSupportMaterials';
import {
  useChallengeActivitiesAdmin,
  useUpdateActivity,
  useCreateDefaultActivities,
} from '@/hooks/useChallenge42';
import {
  useChallengeActivities,
  useReorderChallengeActivities,
} from '@/hooks/useChallengeActivities';
import { useAuth } from '@/hooks/useAuth';
import { Home, Utensils, History, FileText, Target, Calendar, Plus, Trash2, Edit, Loader2, Youtube, FileText as TextIcon, GripVertical, Wand2, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

// 6 módulos conforme especificado
const CATEGORIES = [
  { value: 'inicio', label: 'Início', icon: Home, description: 'Texto de boas-vindas e orientações iniciais' },
  { value: 'dieta', label: 'Acesso à Dieta', icon: Utensils, description: 'Orientações de acesso ao app da dieta' },
  { value: 'historico', label: 'Histórico', icon: History, description: 'Check-ins e orientações (visualização)' },
  { value: 'materiais', label: 'Materiais', icon: FileText, description: 'Textos, vídeos e links de suporte' },
  { value: 'desafio42', label: 'Desafio 42', icon: Target, description: 'Atividades comportamentais semanais' },
  { value: 'controle', label: 'Controle Diário', icon: Calendar, description: 'Instruções do controle de peso/cintura' },
];

export default function ContentManager() {
  const { user } = useAuth();
  const { data: materials = [], isLoading: materialsLoading } = useSupportMaterials();
  const { data: dietConfig, isLoading: configLoading } = useDietAppConfig();
  const { data: challengeActivities = [], isLoading: activitiesLoading } = useChallengeActivitiesAdmin();
  const { data: orderedActivities = [] } = useChallengeActivities();
  const createMaterial = useCreateSupportMaterial();
  const updateMaterial = useUpdateSupportMaterial();
  const deleteMaterial = useDeleteSupportMaterial();
  const saveDietConfig = useSaveDietAppConfig();
  const updateActivity = useUpdateActivity();
  const createDefaultActivities = useCreateDefaultActivities();
  const reorderActivities = useReorderChallengeActivities();

  const [activeTab, setActiveTab] = useState('inicio');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [requiredDays, setRequiredDays] = useState(7);
  
  // Form state for materials
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'text' | 'youtube_video'>('text');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  // Form state for activities
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  
  // Diet config state
  const [appInstructions, setAppInstructions] = useState('');
  const [appCode, setAppCode] = useState('');
  const [supportInstructions, setSupportInstructions] = useState('');
  const [configInitialized, setConfigInitialized] = useState(false);

  // Load diet config when available
  if (dietConfig && !configInitialized) {
    setAppInstructions(dietConfig.app_download_instructions || '');
    setAppCode(dietConfig.app_code || '');
    setSupportInstructions(dietConfig.support_instructions || '');
    setConfigInitialized(true);
  }

  const handleOpenDialog = (material?: any) => {
    if (material) {
      setEditingMaterial(material);
      setTitle(material.title || '');
      setContent(material.content || '');
      setContentType(material.content_type);
      setYoutubeUrl(material.youtube_url || '');
    } else {
      setEditingMaterial(null);
      setTitle('');
      setContent('');
      setContentType('text');
      setYoutubeUrl('');
    }
    setIsDialogOpen(true);
  };

  const handleOpenActivityDialog = (activity?: any) => {
    if (activity) {
      setEditingActivity(activity);
      setActivityTitle(activity.title || '');
      setActivityDescription(activity.description || '');
    } else {
      setEditingActivity(null);
      setActivityTitle('');
      setActivityDescription('');
    }
    setIsActivityDialogOpen(true);
  };

  const handleSaveMaterial = async () => {
    try {
      const data = {
        category: activeTab as SupportMaterialCategory,
        title,
        content: contentType === 'text' ? content : null,
        content_type: contentType,
        youtube_url: contentType === 'youtube_video' ? youtubeUrl : null,
      };

      if (editingMaterial) {
        await updateMaterial.mutateAsync({ id: editingMaterial.id, ...data });
        toast.success('Conteúdo atualizado!');
      } else {
        await createMaterial.mutateAsync(data);
        toast.success('Conteúdo criado!');
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const handleSaveActivity = async () => {
    try {
      if (editingActivity) {
        await updateActivity.mutateAsync({ 
          id: editingActivity.id, 
          title: activityTitle, 
          description: activityDescription,
          required_days: requiredDays,
        });
        toast.success('Atividade atualizada!');
      }
      setIsActivityDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    try {
      await deleteMaterial.mutateAsync(id);
      toast.success('Conteúdo removido!');
    } catch (error) {
      toast.error('Erro ao remover');
    }
  };

  const handleCreateDefaultActivities = async () => {
    if (!user?.id) return;
    try {
      await createDefaultActivities.mutateAsync(user.id);
      toast.success('Atividades padrão criadas!');
    } catch (error) {
      toast.error('Erro ao criar atividades');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateMaterial.mutateAsync({ id, is_active: isActive });
      toast.success(isActive ? 'Conteúdo ativado' : 'Conteúdo desativado');
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const handleToggleActivityActive = async (id: string, isActive: boolean) => {
    try {
      await updateActivity.mutateAsync({ id, is_active: isActive });
      toast.success(isActive ? 'Atividade ativada' : 'Atividade desativada');
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  // Move activity up or down
  const handleMoveActivity = async (index: number, direction: 'up' | 'down') => {
    const activities = [...challengeActivities].slice(0, 6);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === activities.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap order_index values
    const updates = [
      { id: activities[index].id, order_index: activities[swapIndex].order_index ?? swapIndex },
      { id: activities[swapIndex].id, order_index: activities[index].order_index ?? index },
    ];

    try {
      await reorderActivities.mutateAsync({ activities: updates });
      toast.success('Ordem atualizada!');
    } catch (error) {
      toast.error('Erro ao reordenar');
    }
  };

  const handleSaveDietConfig = async () => {
    try {
      await saveDietConfig.mutateAsync({
        app_download_instructions: appInstructions,
        app_code: appCode,
        support_instructions: supportInstructions,
      });
      toast.success('Configurações salvas!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const filteredMaterials = materials.filter(m => m.category === activeTab);
  const isLoading = materialsLoading || configLoading || activitiesLoading;

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
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Conteúdo da Área do Atleta</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Configure aqui todo o conteúdo que será exibido na área de membros do atleta
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-auto">
            {CATEGORIES.map(cat => (
              <TabsTrigger key={cat.value} value={cat.value} className="gap-1 text-xs px-2 py-2 flex-col sm:flex-row">
                <cat.icon className="h-4 w-4" />
                <span className="hidden lg:inline">{cat.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ======== ABA INÍCIO ======== */}
          <TabsContent value="inicio" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Boas-vindas e Orientações</CardTitle>
                    <CardDescription>
                      Adicione textos de boas-vindas, resumo do programa e orientações iniciais
                    </CardDescription>
                  </div>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2" onClick={() => handleOpenDialog()}>
                        <Plus className="h-4 w-4" />
                        Adicionar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingMaterial ? 'Editar Conteúdo' : 'Novo Conteúdo'}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Título</Label>
                          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do conteúdo" />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select value={contentType} onValueChange={(v) => setContentType(v as 'text' | 'youtube_video')}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text"><span className="flex items-center gap-2"><TextIcon className="h-4 w-4" /> Texto</span></SelectItem>
                              <SelectItem value="youtube_video"><span className="flex items-center gap-2"><Youtube className="h-4 w-4" /> Vídeo YouTube</span></SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {contentType === 'text' ? (
                          <div className="space-y-2">
                            <Label>Conteúdo</Label>
                            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Digite o conteúdo..." rows={5} />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>URL do YouTube</Label>
                            <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveMaterial} disabled={createMaterial.isPending || updateMaterial.isPending}>Salvar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {filteredMaterials.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum conteúdo cadastrado</p>
                ) : (
                  <div className="space-y-3">
                    {filteredMaterials.map((material) => (
                      <div key={material.id} className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-shrink-0">
                          {material.content_type === 'youtube_video' ? <Youtube className="h-5 w-5 text-red-500" /> : <TextIcon className="h-5 w-5 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{material.title || 'Sem título'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={material.is_active} onCheckedChange={(checked) => handleToggleActive(material.id, checked)} />
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(material)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteMaterial(material.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ======== ABA DIETA ======== */}
          <TabsContent value="dieta" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configurações do App de Dieta</CardTitle>
                <CardDescription>Configure as orientações de acesso ao app para seus atletas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Instruções para Download do App</Label>
                  <Textarea value={appInstructions} onChange={(e) => setAppInstructions(e.target.value)} placeholder="Explique como baixar o aplicativo..." rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Código do App</Label>
                  <Input value={appCode} onChange={(e) => setAppCode(e.target.value)} placeholder="Ex: ABC123" />
                </div>
                <div className="space-y-2">
                  <Label>Instruções de Suporte</Label>
                  <Textarea value={supportInstructions} onChange={(e) => setSupportInstructions(e.target.value)} placeholder="Explique como usar o suporte..." rows={3} />
                </div>
                <Button onClick={handleSaveDietConfig} disabled={saveDietConfig.isPending}>
                  {saveDietConfig.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar Configurações'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ======== ABA HISTÓRICO ======== */}
          <TabsContent value="historico" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Check-ins e Orientações</CardTitle>
                <CardDescription>Este conteúdo é gerado automaticamente pelo sistema</CardDescription>
              </CardHeader>
              <CardContent className="py-8 text-center">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Os check-ins, feedbacks e gráficos de evolução são exibidos automaticamente para o atleta com base nas respostas enviadas.</p>
                <p className="text-sm text-muted-foreground mt-2">Você pode visualizar esses dados na página de cada atleta.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ======== ABA MATERIAIS ======== */}
          <TabsContent value="materiais" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Materiais de Suporte</CardTitle>
                    <CardDescription>Adicione textos, vídeos e links para seus atletas</CardDescription>
                  </div>
                  <Dialog open={isDialogOpen && activeTab === 'materiais'} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2" onClick={() => handleOpenDialog()}>
                        <Plus className="h-4 w-4" />
                        Adicionar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingMaterial ? 'Editar Material' : 'Novo Material'}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Título</Label>
                          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do material" />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select value={contentType} onValueChange={(v) => setContentType(v as 'text' | 'youtube_video')}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text"><span className="flex items-center gap-2"><TextIcon className="h-4 w-4" /> Texto</span></SelectItem>
                              <SelectItem value="youtube_video"><span className="flex items-center gap-2"><Youtube className="h-4 w-4" /> Vídeo YouTube</span></SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {contentType === 'text' ? (
                          <div className="space-y-2">
                            <Label>Conteúdo</Label>
                            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Digite o conteúdo..." rows={5} />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>URL do YouTube</Label>
                            <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveMaterial} disabled={createMaterial.isPending || updateMaterial.isPending}>Salvar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {filteredMaterials.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum material cadastrado. Quando vazio, o atleta verá uma mensagem padrão.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredMaterials.map((material) => (
                      <div key={material.id} className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-shrink-0">
                          {material.content_type === 'youtube_video' ? <Youtube className="h-5 w-5 text-red-500" /> : <TextIcon className="h-5 w-5 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{material.title || 'Sem título'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={material.is_active} onCheckedChange={(checked) => handleToggleActive(material.id, checked)} />
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(material)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteMaterial(material.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ======== ABA DESAFIO 42 ======== */}
          <TabsContent value="desafio42" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Desafio 42 — Atividades Semanais</CardTitle>
                    <CardDescription>Configure as 6 atividades semanais. Cada semana tem 1 atividade que o atleta marca por dia.</CardDescription>
                  </div>
                  {challengeActivities.length === 0 && (
                    <Button 
                      size="sm" 
                      className="gap-2" 
                      onClick={handleCreateDefaultActivities}
                      disabled={createDefaultActivities.isPending}
                    >
                      {createDefaultActivities.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      Criar Atividades Padrão
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {challengeActivities.length === 0 ? (
                  <div className="text-center py-8">
                    <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Nenhuma atividade configurada. Clique em "Criar Atividades Padrão" para gerar 6 semanas de atividades.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {challengeActivities.slice(0, 6).map((activity, index) => (
                      <div key={activity.id} className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveActivity(index, 'up')}
                            disabled={index === 0 || reorderActivities.isPending}
                            title="Mover para cima"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveActivity(index, 'down')}
                            disabled={index === Math.min(challengeActivities.length, 6) - 1 || reorderActivities.isPending}
                            title="Mover para baixo"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-foreground">
                          S{index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground">{activity.title}</p>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Dias necessários: {activity.required_days || 7}/7
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={activity.is_active} 
                            onCheckedChange={(checked) => handleToggleActivityActive(activity.id, checked)} 
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setEditingActivity(activity);
                              setActivityTitle(activity.title);
                              setActivityDescription(activity.description || '');
                              setRequiredDays(activity.required_days || 7);
                              setIsActivityDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity Edit Dialog */}
            <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Atividade da Semana</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Título da Atividade</Label>
                    <Input 
                      value={activityTitle} 
                      onChange={(e) => setActivityTitle(e.target.value)} 
                      placeholder="Ex: Hidratação - Beber 2L de água" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea 
                      value={activityDescription} 
                      onChange={(e) => setActivityDescription(e.target.value)} 
                      placeholder="Detalhes sobre como realizar a atividade..." 
                      rows={3} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dias necessários para completar (de 7)</Label>
                    <Select 
                      value={String(requiredDays)} 
                      onValueChange={(v) => setRequiredDays(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 6, 7].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} de 7 dias</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsActivityDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSaveActivity} disabled={updateActivity.isPending}>
                    {updateActivity.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ======== ABA CONTROLE DIÁRIO ======== */}
          <TabsContent value="controle" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Controle Diário</CardTitle>
                    <CardDescription>Configure as instruções do controle de peso e cintura</CardDescription>
                  </div>
                  <Dialog open={isDialogOpen && activeTab === 'controle'} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2" onClick={() => handleOpenDialog()}>
                        <Plus className="h-4 w-4" />
                        Adicionar Instrução
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingMaterial ? 'Editar Instrução' : 'Nova Instrução'}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Título</Label>
                          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da instrução" />
                        </div>
                        <div className="space-y-2">
                          <Label>Conteúdo</Label>
                          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Instruções detalhadas..." rows={5} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveMaterial} disabled={createMaterial.isPending || updateMaterial.isPending}>Salvar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">
                    <strong>Como funciona:</strong> O atleta informa a data de início, o sistema gera um calendário de 6 semanas. 
                    O atleta registra peso e circunferência da cintura, e gráficos automáticos são exibidos abaixo. 
                    Há um botão para resetar o ciclo (ciclos anteriores ficam arquivados).
                  </p>
                </div>
                {filteredMaterials.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Adicione instruções sobre como o atleta deve usar o controle diário.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredMaterials.map((material) => (
                      <div key={material.id} className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                        <TextIcon className="h-5 w-5 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{material.title || 'Sem título'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={material.is_active} onCheckedChange={(checked) => handleToggleActive(material.id, checked)} />
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(material)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteMaterial(material.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
