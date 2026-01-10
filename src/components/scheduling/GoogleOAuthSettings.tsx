import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Video, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Unlink } from 'lucide-react';
import { toast } from 'sonner';

export function GoogleOAuthSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Fetch OAuth connection status
  const { data: oauthConnection, isLoading } = useQuery({
    queryKey: ['google-oauth-connection', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_oauth_connections')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-oauth-callback') {
        if (event.data.success) {
          toast.success(event.data.message || 'Conexão com Google estabelecida!');
          queryClient.invalidateQueries({ queryKey: ['google-oauth-connection'] });
        } else {
          toast.error(event.data.message || 'Erro na conexão com Google');
        }
        setIsConnecting(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [queryClient]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar logado');
        setIsConnecting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('google-oauth-init', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Erro ao iniciar conexão');
      }

      // Open OAuth in a new tab (not popup) to avoid iframe blocking
      // Using window.open without popup features opens a new tab
      window.open(data.authUrl, '_blank');
      
      toast.info('Autorize no Google e volte para esta página. A conexão será detectada automaticamente.');
      
      // Set up polling to check if connection was established
      const checkConnection = setInterval(async () => {
        const { data: conn } = await supabase
          .from('google_oauth_connections')
          .select('access_token')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (conn?.access_token) {
          clearInterval(checkConnection);
          setIsConnecting(false);
          queryClient.invalidateQueries({ queryKey: ['google-oauth-connection'] });
          toast.success('Conexão com Google estabelecida!');
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(checkConnection);
        setIsConnecting(false);
      }, 120000);

    } catch (error: any) {
      console.error('OAuth init error:', error);
      toast.error(error.message || 'Erro ao conectar');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);

      const { error } = await supabase
        .from('google_oauth_connections')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Conexão removida');
      queryClient.invalidateQueries({ queryKey: ['google-oauth-connection'] });

    } catch (error: any) {
      toast.error(error.message || 'Erro ao desconectar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = !!oauthConnection?.access_token;
  const tokenExpired = oauthConnection?.token_expires_at && 
    new Date(oauthConnection.token_expires_at) < new Date();

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Google Meet (OAuth)
            </CardTitle>
            <CardDescription>
              Conecte sua conta Google para gerar links do Meet automaticamente
            </CardDescription>
          </div>
          {isConnected && !tokenExpired ? (
            <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          ) : isConnected && tokenExpired ? (
            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">
              <AlertCircle className="h-3 w-3 mr-1" />
              Token Expirado
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertCircle className="h-3 w-3 mr-1" />
              Não conectado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-primary/10 border-primary/30">
          <Video className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            <p className="font-medium mb-1">Por que conectar via OAuth?</p>
            <p className="text-muted-foreground">
              O OAuth permite que eventos criados no Google Calendar incluam automaticamente 
              um link do Google Meet. Isso é necessário porque contas Gmail pessoais não 
              suportam Meet via Service Account.
            </p>
          </AlertDescription>
        </Alert>

        {isConnected && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className={tokenExpired ? 'text-amber-500' : 'text-green-500'}>
                {tokenExpired ? 'Token expirado (será renovado automaticamente)' : 'Ativo'}
              </span>
            </div>
            {oauthConnection?.updated_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Última atualização:</span>
                <span>{new Date(oauthConnection.updated_at).toLocaleString('pt-BR')}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {!isConnected ? (
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Conectar Conta Google
                </>
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconectar
                  </>
                )}
              </Button>
              <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Unlink className="h-4 w-4 mr-2" />
                    Desconectar
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        {!isConnected && (
          <p className="text-xs text-muted-foreground">
            Ao conectar, você autoriza o sistema a criar eventos no seu Google Calendar 
            com links do Google Meet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
