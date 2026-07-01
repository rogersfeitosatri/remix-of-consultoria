import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, BellRing, Loader2, Smartphone, Info } from 'lucide-react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { NOTIFICATION_TYPES } from '@/lib/notificationTypes';

export function NotificationsSettingsSection() {
  const { preferences, setPreference, isLoading } = useNotificationPreferences();
  const push = usePushNotifications();

  return (
    <div className="space-y-5">
      {/* Ativar push no dispositivo */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Notificações push neste dispositivo</p>
              <p className="text-xs text-muted-foreground">
                Ative para receber as notificações no navegador/celular. Precisa ser feito em cada aparelho.
              </p>
            </div>
          </div>
          <Button
            variant={push.enabled ? 'secondary' : 'default'}
            size="sm"
            onClick={push.enable}
            disabled={push.status === 'loading' || !push.supported}
            className="gap-2 shrink-0"
            title={!push.supported ? 'Push não suportado ou Firebase não configurado' : undefined}
          >
            {push.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> :
              push.enabled ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {push.enabled ? 'Ativo' : 'Ativar'}
          </Button>
        </div>
        {!push.supported && (
          <Alert className="mt-3">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este navegador não suporta push ou o Firebase ainda não está configurado.
            </AlertDescription>
          </Alert>
        )}
        {push.error && <p className="text-xs text-destructive mt-2">{push.error}</p>}
      </div>

      {/* Preferências por tipo */}
      <div>
        <p className="text-sm font-medium mb-1">Quais notificações receber</p>
        <p className="text-xs text-muted-foreground mb-3">
          Escolha os eventos que devem gerar uma notificação. As desativadas não serão enviadas.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border">
            {NOTIFICATION_TYPES.map((t) => (
              <div key={t.key} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0">
                  <Label htmlFor={`notif-${t.key}`} className="text-sm font-medium cursor-pointer">
                    {t.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <Switch
                  id={`notif-${t.key}`}
                  checked={preferences[t.key] !== false}
                  onCheckedChange={(v) => setPreference(t.key, v)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
