import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export function GoogleOAuthAlert() {
  const navigate = useNavigate();

  const { data: oauthStatus, isLoading } = useQuery({
    queryKey: ['google-oauth-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Check OAuth connection
      const { data: oauthConnection } = await supabase
        .from('google_oauth_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Check for recent appointments without Meet link
      const { data: failedMeets } = await supabase
        .from('appointments')
        .select('id, client:clients(name), appointment_date')
        .eq('user_id', user.id)
        .eq('meet_status', 'failed')
        .is('google_meet_link', null)
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_date', { ascending: true })
        .limit(5);

      const isExpired = oauthConnection?.token_expires_at && 
        new Date(oauthConnection.token_expires_at) < new Date();

      const hasNoOAuth = !oauthConnection?.access_token && !oauthConnection?.refresh_token;

      return {
        isConnected: !!oauthConnection?.access_token,
        isExpired,
        hasNoOAuth,
        failedMeets: failedMeets || [],
        needsAttention: isExpired || hasNoOAuth || (failedMeets && failedMeets.length > 0),
      };
    },
    refetchInterval: 60000, // Check every minute
  });

  if (isLoading || !oauthStatus?.needsAttention) {
    return null;
  }

  const getAlertContent = () => {
    if (oauthStatus.hasNoOAuth) {
      return {
        title: 'Google Meet não configurado',
        description: 'Configure a conexão OAuth do Google para gerar links do Meet automaticamente nas consultas.',
        variant: 'default' as const,
      };
    }
    
    if (oauthStatus.isExpired) {
      return {
        title: 'Conexão do Google expirou',
        description: 'O token de acesso do Google expirou ou foi revogado. Reconecte sua conta para continuar gerando links do Meet.',
        variant: 'destructive' as const,
      };
    }

    if (oauthStatus.failedMeets.length > 0) {
      const clientNames = oauthStatus.failedMeets
        .slice(0, 3)
        .map((a: any) => a.client?.name)
        .filter(Boolean)
        .join(', ');
      
      return {
        title: `${oauthStatus.failedMeets.length} consulta(s) sem link do Meet`,
        description: `Consultas de ${clientNames}${oauthStatus.failedMeets.length > 3 ? ' e outros' : ''} estão sem link do Google Meet. Reconecte o Google e reprocesse.`,
        variant: 'destructive' as const,
      };
    }

    return null;
  };

  const content = getAlertContent();
  if (!content) return null;

  return (
    <Alert variant={content.variant} className="border-orange-500/50 bg-orange-500/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {content.title}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{content.description}</p>
        <div className="flex flex-wrap gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/scheduling')}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Configurar Google
          </Button>
          {oauthStatus.failedMeets.length > 0 && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate('/calendar')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Ver Agenda
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
