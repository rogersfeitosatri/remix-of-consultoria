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
} from '@/hooks/useSupportMaterials';
import { BookOpen, Utensils, FileText, Plus, Trash2, Edit, Loader2, Youtube, FileText as TextIcon, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'onboarding', label: 'Onboarding', icon: BookOpen },
  { value: 'dieta', label: 'Dieta', icon: Utensils },
  { value: 'material_suporte', label: 'Material de Suporte', icon: FileText },
];

export default function ContentManager() {
  const { data: materials = [], isLoading: materialsLoading } = useSupportMaterials();
  const { data: dietConfig, isLoading: configLoading } = useDietAppConfig();
  const createMaterial = useCreateSupportMaterial();
  const updateMaterial = useUpdateSupportMaterial();
  const deleteMaterial = useDeleteSupportMaterial();
  const saveDietConfig = useSaveDietAppConfig();

  const [activeTab, setActiveTab] = useState('onboarding');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'text' | 'youtube_video'>('text');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  // Diet config state - initialized from dietConfig when available
  const [appInstructions, setAppInstructions] = useState('');
  const [appCode, setAppCode] = useState('');
  const [supportInstructions, setSupportInstructions] = useState('');
  const [configInitialized, setConfigInitialized] = useState(false);

  // Load diet config when it's available
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

  const handleSaveMaterial = async () => {
    try {
      const data = {
        category: activeTab as 'onboarding' | 'dieta' | 'material_suporte',
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

  const handleDeleteMaterial = async (id: string) => {
    try {
      await deleteMaterial.mutateAsync(id);
      toast.success('Conteúdo removido!');
    } catch (error) {
      toast.error('Erro ao remover');
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

  const handleSaveDietConfig = async () => {
    try {
      await saveDietConfig.mutateAsync({
        app_download_instructions: appInstructions,
        app_code: appCode,
        support_instructions: supportInstructions,
      });
      toast.success('Configurações da dieta salvas!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  const filteredMaterials = materials.filter(m => m.category === activeTab);

  const isLoading = materialsLoading || configLoading;

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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestão de Conteúdo</h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Gerencie os conteúdos exibidos na área do atleta
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            {CATEGORIES.map(cat => (
              <TabsTrigger key={cat.value} value={cat.value} className="gap-2">
                <cat.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cat.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map(cat => (
            <TabsContent key={cat.value} value={cat.value} className="space-y-6">
              {/* Diet Config - Only show in "dieta" tab */}
              {cat.value === 'dieta' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Configurações do App de Dieta</CardTitle>
                    <CardDescription>Configure as informações de acesso ao app para seus atletas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Instruções para Download do App</Label>
                      <Textarea
                        value={appInstructions}
                        onChange={(e) => setAppInstructions(e.target.value)}
                        placeholder="Explique como baixar o aplicativo..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Código do App</Label>
                      <Input
                        value={appCode}
                        onChange={(e) => setAppCode(e.target.value)}
                        placeholder="Ex: ABC123"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Instruções de Suporte (Daily)</Label>
                      <Textarea
                        value={supportInstructions}
                        onChange={(e) => setSupportInstructions(e.target.value)}
                        placeholder="Explique como usar o suporte dentro do app..."
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleSaveDietConfig} disabled={saveDietConfig.isPending}>
                      {saveDietConfig.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Configurações'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Content List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Conteúdos de {cat.label}</CardTitle>
                      <CardDescription>
                        {cat.value === 'material_suporte' 
                          ? 'Adicione textos e vídeos de apoio para seus atletas'
                          : 'Adicione informações e instruções para esta seção'}
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
                          <DialogTitle>
                            {editingMaterial ? 'Editar Conteúdo' : 'Novo Conteúdo'}
                          </DialogTitle>
                          <DialogDescription>
                            Adicione textos ou links de vídeos do YouTube
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Título</Label>
                            <Input
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              placeholder="Título do conteúdo"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de Conteúdo</Label>
                            <Select value={contentType} onValueChange={(v) => setContentType(v as 'text' | 'youtube_video')}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">
                                  <span className="flex items-center gap-2">
                                    <TextIcon className="h-4 w-4" />
                                    Texto
                                  </span>
                                </SelectItem>
                                <SelectItem value="youtube_video">
                                  <span className="flex items-center gap-2">
                                    <Youtube className="h-4 w-4" />
                                    Vídeo do YouTube
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {contentType === 'text' ? (
                            <div className="space-y-2">
                              <Label>Conteúdo</Label>
                              <Textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Digite o conteúdo..."
                                rows={5}
                              />
                              <p className="text-xs text-muted-foreground">
                                Dica: Use formato estilo Twitter - textos curtos e diretos
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label>URL do YouTube</Label>
                              <Input
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                placeholder="https://youtube.com/watch?v=..."
                              />
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleSaveMaterial} 
                            disabled={createMaterial.isPending || updateMaterial.isPending}
                          >
                            Salvar
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredMaterials.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum conteúdo cadastrado nesta categoria
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filteredMaterials.map((material) => (
                        <div
                          key={material.id}
                          className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <div className="flex-shrink-0">
                            {material.content_type === 'youtube_video' ? (
                              <Youtube className="h-5 w-5 text-red-500" />
                            ) : (
                              <TextIcon className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{material.title || 'Sem título'}</p>
                            {material.content_type === 'text' && material.content && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {material.content.substring(0, 100)}...
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={material.is_active}
                              onCheckedChange={(checked) => handleToggleActive(material.id, checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(material)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMaterial(material.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Layout>
  );
}
