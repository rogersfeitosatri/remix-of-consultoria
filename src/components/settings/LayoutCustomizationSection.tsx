import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Save, RotateCcw, Image, Type } from 'lucide-react';
import { useLayoutSettings, DEFAULT_SIDEBAR_ITEMS, SidebarItemConfig } from '@/hooks/useLayoutSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function LayoutCustomizationSection() {
  const { settings, saveSettings } = useLayoutSettings();

  const [sidebarItems, setSidebarItems] = useState<SidebarItemConfig[]>([]);
  const [brandName, setBrandName] = useState('');
  const [brandSubtitle, setBrandSubtitle] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Sync from settings
  useEffect(() => {
    setSidebarItems(settings.sidebar_items);
    setBrandName(settings.brand_name);
    setBrandSubtitle(settings.brand_subtitle);
    setLogoUrl(settings.logo_url);
    setAvatarUrl(settings.avatar_url);
  }, [settings]);

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const items = [...sidebarItems];
    const dragged = items.splice(dragIdx, 1)[0];
    items.splice(idx, 0, dragged);
    setSidebarItems(items);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const toggleVisibility = (idx: number) => {
    const items = [...sidebarItems];
    // Don't allow hiding Dashboard and Settings
    if (items[idx].key === '/admin' || items[idx].key === '/settings') {
      toast.error('Dashboard e Configurações não podem ser ocultados.');
      return;
    }
    items[idx] = { ...items[idx], visible: !items[idx].visible };
    setSidebarItems(items);
  };

  const updateLabel = (idx: number, label: string) => {
    const items = [...sidebarItems];
    items[idx] = { ...items[idx], label };
    setSidebarItems(items);
  };

  const handleReset = () => {
    setSidebarItems(DEFAULT_SIDEBAR_ITEMS);
    setBrandName('Rogers Feitosa');
    setBrandSubtitle('Nutrição & Treinamento');
    setLogoUrl(null);
    setAvatarUrl(null);
  };

  const handleSave = () => {
    saveSettings.mutate({
      sidebar_items: sidebarItems,
      brand_name: brandName,
      brand_subtitle: brandSubtitle,
      logo_url: logoUrl,
      avatar_url: avatarUrl,
    });
  };

  const handleImageUpload = useCallback(async (file: File, type: 'logo' | 'avatar') => {
    const setter = type === 'logo' ? setUploadingLogo : setUploadingAvatar;
    setter(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `layout/${type}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('link-bio-images')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('link-bio-images')
        .getPublicUrl(path);

      if (type === 'logo') setLogoUrl(urlData.publicUrl);
      else setAvatarUrl(urlData.publicUrl);
      toast.success(`${type === 'logo' ? 'Logo' : 'Avatar'} carregado!`);
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message);
    } finally {
      setter(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Brand Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            Identidade Visual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Nome exibido no sistema</Label>
              <Input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Rogers Feitosa" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Subtítulo</Label>
              <Input value={brandSubtitle} onChange={e => setBrandSubtitle(e.target.value)} placeholder="Nutrição & Treinamento" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Logo */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Image className="h-3.5 w-3.5" /> Logo do sistema</Label>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border">
                    <Image className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-upload"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'logo'); }}
                  />
                  <Button variant="outline" size="sm" className="text-xs" asChild disabled={uploadingLogo}>
                    <label htmlFor="logo-upload" className="cursor-pointer">
                      {uploadingLogo ? 'Carregando...' : 'Alterar Logo'}
                    </label>
                  </Button>
                  {logoUrl && (
                    <Button variant="ghost" size="sm" className="text-xs text-destructive ml-1" onClick={() => setLogoUrl(null)}>
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Avatar */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Image className="h-3.5 w-3.5" /> Avatar do perfil</Label>
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-12 w-12 rounded-full object-cover border border-border" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center border border-border">
                    <Image className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="avatar-upload"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'avatar'); }}
                  />
                  <Button variant="outline" size="sm" className="text-xs" asChild disabled={uploadingAvatar}>
                    <label htmlFor="avatar-upload" className="cursor-pointer">
                      {uploadingAvatar ? 'Carregando...' : 'Alterar Avatar'}
                    </label>
                  </Button>
                  {avatarUrl && (
                    <Button variant="ghost" size="sm" className="text-xs text-destructive ml-1" onClick={() => setAvatarUrl(null)}>
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sidebar Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-primary" />
            Ordem e Visibilidade do Menu
          </CardTitle>
          <p className="text-xs text-muted-foreground">Arraste para reordenar. Use o toggle para ocultar/exibir abas.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {sidebarItems.map((item, idx) => {
              const isProtected = item.key === '/admin' || item.key === '/settings';
              return (
                <div
                  key={item.key}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing',
                    dragIdx === idx ? 'border-primary bg-primary/5' : 'border-border bg-card',
                    !item.visible && 'opacity-50'
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={item.label}
                    onChange={e => updateLabel(idx, e.target.value)}
                    className="h-7 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 flex-1"
                  />
                  {isProtected && (
                    <Badge variant="outline" className="text-[10px] shrink-0">Fixo</Badge>
                  )}
                  <Switch
                    checked={item.visible}
                    onCheckedChange={() => toggleVisibility(idx)}
                    disabled={isProtected}
                    className="shrink-0"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar Padrão
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saveSettings.isPending} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> {saveSettings.isPending ? 'Salvando...' : 'Salvar Layout'}
        </Button>
      </div>
    </div>
  );
}
