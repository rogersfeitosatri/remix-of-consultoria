import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLinkBioItems, useCreateLinkBioItem, useUpdateLinkBioItem, useDeleteLinkBioItem, LinkBioItem } from '@/hooks/useLinkBio';
import { Plus, Edit, Trash2, ExternalLink, Link as LinkIcon, Loader2, Eye, GripVertical, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ImageUploadDialog } from '@/components/linkbio/ImageUploadDialog';

export default function LinkBioManager() {
  const { data: items = [], isLoading } = useLinkBioItems();
  const createItem = useCreateLinkBioItem();
  const updateItem = useUpdateLinkBioItem();
  const deleteItem = useDeleteLinkBioItem();

  const [editingItem, setEditingItem] = useState<LinkBioItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    link_url: '',
    image_url: '',
    is_active: true,
    order_index: 0,
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      link_url: '',
      image_url: '',
      is_active: true,
      order_index: items.length,
    });
    setEditingItem(null);
  };

  const handleOpenDialog = (item?: LinkBioItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        description: item.description || '',
        link_url: item.link_url || '',
        image_url: item.image_url || '',
        is_active: item.is_active,
        order_index: item.order_index,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    try {
      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          ...formData,
        });
        toast.success('Link atualizado com sucesso!');
      } else {
        await createItem.mutateAsync(formData);
        toast.success('Link criado com sucesso!');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erro ao salvar link');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este link?')) return;
    
    try {
      await deleteItem.mutateAsync(id);
      toast.success('Link excluído com sucesso!');
    } catch (error) {
      toast.error('Erro ao excluir link');
    }
  };

  const handleToggleActive = async (item: LinkBioItem) => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        is_active: !item.is_active,
      });
      toast.success(item.is_active ? 'Link desativado' : 'Link ativado');
    } catch (error) {
      toast.error('Erro ao atualizar link');
    }
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Link da Bio</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gerencie seus links para redes sociais</p>
          </div>
          <div className="flex gap-2">
            <Link to="/bio" target="_blank">
              <Button variant="outline" size="sm" className="gap-2 text-white hover:text-white">
                <Eye className="h-4 w-4" />
                Visualizar
              </Button>
            </Link>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4" />
                  Adicionar Link
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Editar Link' : 'Novo Link'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ex: Acompanhamento Nutricional"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Breve descrição do link"
                      rows={2}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="link_url">URL do Link</Label>
                    <Input
                      id="link_url"
                      value={formData.link_url}
                      onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Imagem (opcional)</Label>
                    {formData.image_url ? (
                      <div className="flex items-center gap-3">
                        <img 
                          src={formData.image_url} 
                          alt="Preview" 
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsImageDialogOpen(true)}
                          >
                            Trocar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData({ ...formData, image_url: '' })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => setIsImageDialogOpen(true)}
                      >
                        <Upload className="h-4 w-4" />
                        Fazer upload de imagem
                      </Button>
                    )}
                  </div>
                  
                  <ImageUploadDialog
                    open={isImageDialogOpen}
                    onOpenChange={setIsImageDialogOpen}
                    onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                    currentImageUrl={formData.image_url}
                  />
                  
                  <div className="space-y-2">
                    <Label htmlFor="order_index">Ordem</Label>
                    <Input
                      id="order_index"
                      type="number"
                      value={formData.order_index}
                      onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active">Ativo</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit} disabled={createItem.isPending || updateItem.isPending}>
                    {(createItem.isPending || updateItem.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Preview Link */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Seu Link da Bio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-sm text-primary">
                {window.location.origin}/bio
              </code>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/bio`);
                  toast.success('Link copiado!');
                }}
              >
                Copiar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Links List */}
        <Card>
          <CardHeader>
            <CardTitle>Seus Links</CardTitle>
            <CardDescription>Arraste para reordenar (em breve) ou edite cada item</CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <LinkIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum link cadastrado</p>
                <p className="text-sm">Clique em "Adicionar Link" para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div 
                    key={item.id} 
                    className={`flex items-center gap-3 p-4 rounded-lg border ${
                      item.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    
                    {item.image_url && (
                      <img 
                        src={item.image_url} 
                        alt={item.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                      )}
                      {item.link_url && (
                        <p className="text-xs text-primary truncate">{item.link_url}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={() => handleToggleActive(item)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {item.link_url && (
                        <a href={item.link_url} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
