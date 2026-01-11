import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, Zap, Target, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ZonaNutriSectionProps {
  hasAccess: boolean;
}

export function ZonaNutriSection({ hasAccess }: ZonaNutriSectionProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAccessZonaNutri = async () => {
    // Abre a nova aba ANTES do await para evitar bloqueio de popup e não tirar o atleta da área de membros.
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');
    if (!popup) {
      toast.error('Seu navegador bloqueou o pop-up. Permita pop-ups e tente novamente.');
      return;
    }

    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        popup.close();
        return;
      }

      const { data, error } = await supabase.functions.invoke('zona-nutri-sso', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('SSO error:', error);
        const errorContext = error.context;
        if (errorContext) {
          try {
            const parsed = typeof errorContext === 'string' ? JSON.parse(errorContext) : errorContext;
            toast.error(`Falha no SSO (step: ${parsed.step || 'unknown'}): ${parsed.error || 'Erro desconhecido'}`);
          } catch {
            toast.error('Erro ao acessar Zona Nutri. Tente novamente.');
          }
        } else {
          toast.error('Erro ao acessar Zona Nutri. Tente novamente.');
        }
        popup.close();
        return;
      }

      if (data?.error) {
        console.error('SSO response error:', data);
        toast.error(`Falha no SSO (step: ${data.step || 'unknown'}): ${data.error}`);
        popup.close();
        return;
      }

      if (data?.url) {
        const rawUrl: string = data.url;

        const hasHash = rawUrl.includes('#');
        const hasCode = rawUrl.includes('?code=') || rawUrl.includes('&code=');
        const hasToken = rawUrl.includes('access_token') || rawUrl.includes('token=');
        console.log('[SSO DEBUG] url recebido:', {
          hasHash,
          hasCode,
          hasToken,
          urlPreview: rawUrl.substring(0, 80) + '...',
          redirectToUsed: data.debug?.redirectToUsed,
          method: data.debug?.method,
        });

        toast.success('Abrindo Zona Nutri...');
        popup.location.href = rawUrl;
      } else {
        console.error('[SSO DEBUG] URL não recebida:', data);
        toast.error('Não foi possível gerar o link de acesso.');
        popup.close();
      }
    } catch (error) {
      console.error('Error accessing Zona Nutri:', error);
      toast.error('Erro inesperado. Tente novamente.');
      popup.close();
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-[hsl(43,74%,49%)]" />
            Zona Nutri
          </CardTitle>
          <CardDescription className="text-gray-400">
            Estratégia de Géis para Corrida
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">
              Você não tem acesso ao Zona Nutri no momento.
            </p>
            <p className="text-gray-500 text-sm">
              Entre em contato com seu assessor para mais informações.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800 border-[hsl(43,74%,49%)]/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="h-5 w-5 text-[hsl(43,74%,49%)]" />
          Zona Nutri
        </CardTitle>
        <CardDescription className="text-gray-400">
          Estratégia de Géis para Corrida
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Features List */}
        <div className="grid gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50">
            <Target className="h-5 w-5 text-[hsl(43,74%,49%)] mt-0.5" />
            <div>
              <h4 className="font-medium text-white">Estratégia Personalizada</h4>
              <p className="text-sm text-gray-400">
                Calcule a quantidade ideal de géis para sua prova
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50">
            <Clock className="h-5 w-5 text-[hsl(43,74%,49%)] mt-0.5" />
            <div>
              <h4 className="font-medium text-white">Timing Preciso</h4>
              <p className="text-sm text-gray-400">
                Saiba exatamente quando consumir cada gel
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50">
            <CheckCircle className="h-5 w-5 text-[hsl(43,74%,49%)] mt-0.5" />
            <div>
              <h4 className="font-medium text-white">Baseado em Ciência</h4>
              <p className="text-sm text-gray-400">
                Recomendações baseadas nas melhores práticas
              </p>
            </div>
          </div>
        </div>

        {/* Access Button */}
        <Button 
          onClick={handleAccessZonaNutri}
          disabled={isLoading}
          className="w-full bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold py-6"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <ExternalLink className="h-5 w-5 mr-2" />
              Acessar Zona Nutri
            </>
          )}
        </Button>
        
        <p className="text-center text-xs text-gray-500">
          Você será redirecionado para o app em uma nova aba
        </p>
      </CardContent>
    </Card>
  );
}
