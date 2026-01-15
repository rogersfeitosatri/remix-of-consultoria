import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useLandingPageSettings, useSaveLandingPageSettings, DEFAULT_PLANS_LINKS } from '@/hooks/useLandingPageSettings';

export function LandingPageSettingsSection() {
  const { data: settings, isLoading } = useLandingPageSettings();
  const saveMutation = useSaveLandingPageSettings();

  const [consultoriaUrl, setConsultoriaUrl] = useState('');
  const [consultasUrl, setConsultasUrl] = useState('');

  useEffect(() => {
    if (settings) {
      setConsultoriaUrl(settings.plans_consultoria_whatsapp_url);
      setConsultasUrl(settings.plans_consultas_whatsapp_url);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        plans_consultoria_whatsapp_url: consultoriaUrl,
        plans_consultas_whatsapp_url: consultasUrl,
      });
      toast.success('Links salvos com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    }
  };

  const handleReset = () => {
    setConsultoriaUrl(DEFAULT_PLANS_LINKS.plans_consultoria_whatsapp_url);
    setConsultasUrl(DEFAULT_PLANS_LINKS.plans_consultas_whatsapp_url);
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
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Landing Page - Plans
        </CardTitle>
        <CardDescription>
          Configure os links dos botões de WhatsApp da página <code>/plans</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="consultoria-url">Link do botão "Quero o Plano Consultoria"</Label>
          <Input
            id="consultoria-url"
            value={consultoriaUrl}
            onChange={(e) => setConsultoriaUrl(e.target.value)}
            placeholder="https://wa.me/..."
          />
          <p className="text-xs text-muted-foreground">
            URL completa do WhatsApp com mensagem pré-preenchida
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="consultas-url">Link do botão "Quero o Plano Consultas"</Label>
          <Input
            id="consultas-url"
            value={consultasUrl}
            onChange={(e) => setConsultasUrl(e.target.value)}
            placeholder="https://wa.me/..."
          />
          <p className="text-xs text-muted-foreground">
            URL completa do WhatsApp com mensagem pré-preenchida
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Restaurar Padrão
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.open('/plans', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver Página
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
