import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function GoogleOAuthSettings() {
  const { user } = useAuth();
  const audit = useQuery({
    queryKey: ['integration-readiness', user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-readiness');
      if (error || !data?.success) throw new Error('Não foi possível conferir as integrações. Tente novamente.');
      return data;
    },
  });
  return <Card>
    <CardHeader>
      <CardTitle>Google Meet e avisos à administração</CardTitle>
      <CardDescription>Diagnóstico da integração neste sistema. A verificação não envia mensagens nem cria reuniões.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {audit.isPending && <p>Conferindo configurações...</p>}
      {audit.error && <p role="alert">{audit.error.message}</p>}
      {audit.data && <div role="status" className="space-y-3">
        <p><strong>Google Meet: {audit.data.google.meetEnabled ? 'disponível' : 'configuração pendente'}.</strong> {audit.data.google.message}</p>
        {audit.data.google.savedAuthorization && <p className="text-sm text-muted-foreground">Existe uma autorização restaurada. Sua presença não confirma que a conexão está funcionando.</p>}
        <p><strong>Avisos à administração: {audit.data.adminNotifications.enabled ? 'ativos' : 'inativos'}.</strong> {audit.data.adminNotifications.message}</p>
        {audit.data.adminNotifications.phoneSuffix && <p className="text-sm">Contato administrativo cadastrado: final {audit.data.adminNotifications.phoneSuffix}.</p>}
        <p className="text-sm">Check-ins e convites de consulta podem ser enviados manualmente. Os horários automáticos permanecem pausados.</p>
      </div>}
      <Button variant="outline" disabled={audit.isFetching} onClick={() => audit.refetch()}>Verificar integrações</Button>
    </CardContent>
  </Card>;
}
