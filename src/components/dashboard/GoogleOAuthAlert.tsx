import { AlertTriangle, RefreshCw } from 'lucide-react';
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

      const { data: oauthConnection } = await supabase
        .from('google_oauth_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const isExpired = oauthConnection?.token_expires_at && 
        new Date(oauthConnection.token_expires_at) < new Date();
      
      const hasNoOAuth = !oauthConnection?.access_token && !oauthConnection?.refresh_token;

      const isValid = oauthConnection?.access_token && 
        oauthConnection?.refresh_token && !isExpired;

      return { needsAttention: !isValid && (isExpired || hasNoOAuth), isExpired, hasNoOAuth };
    },
    refetchInterval: 60000,
  });

  if (isLoading || !oauthStatus?.needsAttention) return null;

  const label = oauthStatus.isExpired ? 'Google expirou' : 'Google não conectado';

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate('/scheduling')}
      className="gap-1.5 text-xs h-7 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
    >
      <AlertTriangle className="h-3 w-3" />
      {label}
      <RefreshCw className="h-3 w-3" />
    </Button>
  );
}
