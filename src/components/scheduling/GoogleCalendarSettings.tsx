import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useGoogleCalendarConnection,
  useSaveGoogleCalendarConnection,
} from '@/hooks/useConsultations';
import { Loader2, Calendar, CheckCircle2, AlertCircle, Key, Link2 } from 'lucide-react';
import { toast } from 'sonner';

export function GoogleCalendarSettings() {
  const { data: connection, isLoading } = useGoogleCalendarConnection();
  const saveConnection = useSaveGoogleCalendarConnection();

  const [calendarId, setCalendarId] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (connection) {
      setCalendarId(connection.calendar_id || '');
      setServiceAccountEmail(connection.service_account_email || '');
    }
  }, [connection]);

  const handleSave = async () => {
    try {
      // Validate JSON key if provided
      if (serviceAccountKey) {
        try {
          const parsed = JSON.parse(serviceAccountKey);
          if (!parsed.client_email || !parsed.private_key) {
            throw new Error('Chave inválida: faltam campos obrigatórios');
          }
        } catch (e: any) {
          toast.error(e.message || 'JSON inválido');
          return;
        }
      }

      await saveConnection.mutateAsync({
        calendar_id: calendarId || 'primary',
        service_account_email: serviceAccountEmail,
        service_account_key_encrypted: serviceAccountKey || undefined,
        is_connected: !!serviceAccountKey || connection?.is_connected || false,
      });
      
      toast.success('Configuração salva!');
      setServiceAccountKey(''); // Clear sensitive data after save
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Google Calendar
            </CardTitle>
            <CardDescription>
              Conecte sua conta do Google para criar eventos automaticamente
            </CardDescription>
          </div>
          {connection?.is_connected ? (
            <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          ) : (
            <Badge variant="secondary">
              <AlertCircle className="h-3 w-3 mr-1" />
              Não conectado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Key className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">Como conectar o Google Calendar:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Acesse o <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a></li>
              <li>Crie uma conta de serviço (Service Account)</li>
              <li>Baixe a chave JSON da conta de serviço</li>
              <li>Compartilhe seu calendário com o email da conta de serviço</li>
              <li>Cole a chave JSON abaixo</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>ID do Calendário</Label>
            <Input
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              placeholder="primary (ou ID específico do calendário)"
            />
            <p className="text-xs text-muted-foreground">
              Use "primary" para o calendário principal ou cole o ID de um calendário específico
            </p>
          </div>

          <div className="space-y-2">
            <Label>Email da Conta de Serviço</Label>
            <Input
              value={serviceAccountEmail}
              onChange={(e) => setServiceAccountEmail(e.target.value)}
              placeholder="example@project-id.iam.gserviceaccount.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Chave JSON da Conta de Serviço</Label>
              {connection?.is_connected && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Chave configurada
                </span>
              )}
            </div>
            <Textarea
              value={serviceAccountKey}
              onChange={(e) => setServiceAccountKey(e.target.value)}
              placeholder='Cole aqui o conteúdo do arquivo JSON da chave...'
              rows={6}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {connection?.is_connected 
                ? 'Deixe em branco para manter a chave atual, ou cole uma nova para substituir'
                : 'Cole o conteúdo completo do arquivo JSON baixado do Google Cloud Console'}
            </p>
          </div>
        </div>

        {connection?.last_sync_at && (
          <p className="text-sm text-muted-foreground">
            Última sincronização: {new Date(connection.last_sync_at).toLocaleString('pt-BR')}
          </p>
        )}

        <Button onClick={handleSave} disabled={saveConnection.isPending}>
          {saveConnection.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4 mr-2" />
              Salvar Conexão
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
