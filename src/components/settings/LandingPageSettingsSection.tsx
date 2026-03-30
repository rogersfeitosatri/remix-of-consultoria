import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, ExternalLink, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useLandingPageSettings, useSaveLandingPageSettings, DEFAULT_PLANS_LINKS, DEFAULT_PLANS_TEXTS, DEFAULT_CONSULTAS_OFFERS, DEFAULT_CONSULTORIA_OFFERS, LandingPageSettings, OfferItem } from '@/hooks/useLandingPageSettings';
import { OfferItemsEditor } from './OfferItemsEditor';

type EditableTexts = LandingPageSettings;

function FieldRow({ label, value, onChange, multiline = false, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="text-sm resize-none"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-sm"
        />
      )}
    </div>
  );
}

export function LandingPageSettingsSection() {
  const { data: settings, isLoading } = useLandingPageSettings();
  const saveMutation = useSaveLandingPageSettings();

  const [texts, setTexts] = useState<EditableTexts>({ ...DEFAULT_PLANS_LINKS, ...DEFAULT_PLANS_TEXTS, consultas_offers: DEFAULT_CONSULTAS_OFFERS, consultoria_offers: DEFAULT_CONSULTORIA_OFFERS });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setTexts(settings);
      setIsDirty(false);
    }
  }, [settings]);

  const update = (key: keyof EditableTexts, value: string) => {
    setTexts(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(texts as Record<string, any>);
      toast.success('Configurações salvas com sucesso!');
      setIsDirty(false);
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    }
  };

  const handleReset = (section: 'links' | 'texts' | 'offers' | 'all') => {
    if (section === 'links') {
      setTexts(prev => ({ ...prev, ...DEFAULT_PLANS_LINKS }));
    } else if (section === 'texts') {
      setTexts(prev => ({ ...prev, ...DEFAULT_PLANS_TEXTS }));
    } else if (section === 'offers') {
      setTexts(prev => ({ ...prev, consultas_offers: DEFAULT_CONSULTAS_OFFERS, consultoria_offers: DEFAULT_CONSULTORIA_OFFERS }));
    } else {
      setTexts({ ...DEFAULT_PLANS_LINKS, ...DEFAULT_PLANS_TEXTS, consultas_offers: DEFAULT_CONSULTAS_OFFERS, consultoria_offers: DEFAULT_CONSULTORIA_OFFERS });
    }
    setIsDirty(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Página de Planos (/plans)
            </CardTitle>
            <CardDescription className="mt-1">
              Edite textos, títulos e links da página pública de planos
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('/plans', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Ver página
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending || !isDirty}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isDirty ? 'Salvar alterações' : 'Salvo'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="hero" className="w-full">
          <TabsList className="flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="planos">Planos</TabsTrigger>
            <TabsTrigger value="ofertas">Ofertas</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="cta">CTA Final</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
          </TabsList>

          {/* ── Hero ── */}
          <TabsContent value="hero" className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Seção inicial da página</p>
              <Button variant="ghost" size="sm" onClick={() => handleReset('texts')} className="text-xs h-7">
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar padrão
              </Button>
            </div>
            <FieldRow label="Badge / Etiqueta topo" value={texts.hero_badge} onChange={v => update('hero_badge', v)} />
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Título (parte principal)" value={texts.hero_title} onChange={v => update('hero_title', v)} />
              <FieldRow label="Título em destaque (gradiente)" value={texts.hero_title_highlight} onChange={v => update('hero_title_highlight', v)} />
            </div>
            <FieldRow label="Subtítulo" value={texts.hero_subtitle} onChange={v => update('hero_subtitle', v)} />
            <FieldRow label="Descrição principal" value={texts.hero_description} onChange={v => update('hero_description', v)} multiline />
            <FieldRow label="Descrição itálico" value={texts.hero_description_italic} onChange={v => update('hero_description_italic', v)} multiline />
            <FieldRow label="Botão CTA" value={texts.hero_cta_button} onChange={v => update('hero_cta_button', v)} />
          </TabsContent>

          {/* ── Planos ── */}
          <TabsContent value="planos" className="space-y-6">
            <div>
              <p className="text-sm font-semibold mb-3">Seção "Qual plano é ideal pra você?"</p>
              <div className="space-y-4">
                <FieldRow label="Título da seção" value={texts.para_quem_title} onChange={v => update('para_quem_title', v)} />
                <FieldRow label="Subtítulo da seção" value={texts.para_quem_subtitle} onChange={v => update('para_quem_subtitle', v)} />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3 text-muted-foreground">Card Consultoria</p>
              <div className="space-y-3">
                <FieldRow label="Título do card" value={texts.consultoria_card_title} onChange={v => update('consultoria_card_title', v)} />
                <FieldRow label="Subtítulo" value={texts.consultoria_card_subtitle} onChange={v => update('consultoria_card_subtitle', v)} />
                <FieldRow label="Item 1" value={texts.consultoria_item_1} onChange={v => update('consultoria_item_1', v)} multiline />
                <FieldRow label="Item 2" value={texts.consultoria_item_2} onChange={v => update('consultoria_item_2', v)} multiline />
                <FieldRow label="Item 3" value={texts.consultoria_item_3} onChange={v => update('consultoria_item_3', v)} multiline />
                <FieldRow label="Item 4" value={texts.consultoria_item_4} onChange={v => update('consultoria_item_4', v)} multiline />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3 text-muted-foreground">Card Consultas</p>
              <div className="space-y-3">
                <FieldRow label="Título do card" value={texts.consultas_card_title} onChange={v => update('consultas_card_title', v)} />
                <FieldRow label="Subtítulo" value={texts.consultas_card_subtitle} onChange={v => update('consultas_card_subtitle', v)} />
                <FieldRow label="Badge (ex: MAIS COMPLETO)" value={texts.consultas_badge} onChange={v => update('consultas_badge', v)} />
                <FieldRow label="Item 1" value={texts.consultas_item_1} onChange={v => update('consultas_item_1', v)} multiline />
                <FieldRow label="Item 2" value={texts.consultas_item_2} onChange={v => update('consultas_item_2', v)} multiline />
                <FieldRow label="Item 3" value={texts.consultas_item_3} onChange={v => update('consultas_item_3', v)} multiline />
                <FieldRow label="Item 4" value={texts.consultas_item_4} onChange={v => update('consultas_item_4', v)} multiline />
              </div>
            </div>
          </TabsContent>

          {/* ── Ofertas ── */}
          <TabsContent value="ofertas" className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Itens de oferta exibidos na timeline de cada plano (arraste para reordenar)</p>
              <Button variant="ghost" size="sm" onClick={() => handleReset('offers')} className="text-xs h-7">
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar padrão
              </Button>
            </div>
            <OfferItemsEditor
              label="Plano Consultas"
              items={texts.consultas_offers || []}
              onChange={(items) => { setTexts(prev => ({ ...prev, consultas_offers: items })); setIsDirty(true); }}
            />
            <div className="border-t pt-4">
              <OfferItemsEditor
                label="Plano Consultoria"
                items={texts.consultoria_offers || []}
                onChange={(items) => { setTexts(prev => ({ ...prev, consultoria_offers: items })); setIsDirty(true); }}
              />
            </div>
          </TabsContent>

          {/* ── Timeline ── */}
          <TabsContent value="timeline" className="space-y-4">
            <p className="text-xs text-muted-foreground">Seção de linha do tempo dos planos</p>
            <FieldRow label="Título da seção" value={texts.timeline_title} onChange={v => update('timeline_title', v)} />
            <FieldRow label="Subtítulo da seção" value={texts.timeline_subtitle} onChange={v => update('timeline_subtitle', v)} />
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Título coluna Consultoria" value={texts.timeline_consultoria_title} onChange={v => update('timeline_consultoria_title', v)} />
              <FieldRow label="Título coluna Consultas" value={texts.timeline_consultas_title} onChange={v => update('timeline_consultas_title', v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Botão Consultoria" value={texts.timeline_cta_consultoria} onChange={v => update('timeline_cta_consultoria', v)} />
              <FieldRow label="Botão Consultas" value={texts.timeline_cta_consultas} onChange={v => update('timeline_cta_consultas', v)} />
            </div>
          </TabsContent>

          {/* ── CTA Final ── */}
          <TabsContent value="cta" className="space-y-4">
            <p className="text-xs text-muted-foreground">Seção final de chamada para ação</p>
            <FieldRow label="Título" value={texts.cta_title} onChange={v => update('cta_title', v)} />
            <FieldRow label="Descrição" value={texts.cta_subtitle} onChange={v => update('cta_subtitle', v)} multiline />
            <FieldRow label="Texto do botão" value={texts.cta_button} onChange={v => update('cta_button', v)} />
            <FieldRow label="URL do WhatsApp (botão CTA final)" value={texts.cta_whatsapp_url} onChange={v => update('cta_whatsapp_url', v)} placeholder="https://wa.me/..." />
            <FieldRow label="Texto do rodapé" value={texts.footer_text} onChange={v => update('footer_text', v)} />
          </TabsContent>

          {/* ── Links ── */}
          <TabsContent value="links" className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Links dos botões de WhatsApp nos planos e assessoria</p>
              <Button variant="ghost" size="sm" onClick={() => handleReset('links')} className="text-xs h-7">
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar padrão
              </Button>
            </div>
            <FieldRow
              label='Link botão "Quero o Plano Consultoria"'
              value={texts.plans_consultoria_whatsapp_url}
              onChange={v => update('plans_consultoria_whatsapp_url', v)}
              placeholder="https://wa.me/..."
            />
            <FieldRow
              label='Link botão "Quero o Plano Consultas"'
              value={texts.plans_consultas_whatsapp_url}
              onChange={v => update('plans_consultas_whatsapp_url', v)}
              placeholder="https://wa.me/..."
            />
            <div className="border-t pt-4 mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Página da Assessoria (/assessoria)</p>
              <FieldRow
                label='Link dos botões de WhatsApp na página da Assessoria'
                value={texts.assessoria_whatsapp_url || ''}
                onChange={v => update('assessoria_whatsapp_url', v)}
                placeholder="https://wa.me/55..."
              />
            </div>
          </TabsContent>
        </Tabs>

        {isDirty && (
          <div className="mt-4 pt-4 border-t flex justify-end">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar alterações
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
