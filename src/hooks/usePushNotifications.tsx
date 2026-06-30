import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { requestPushToken, onForegroundMessage, isFirebaseConfigured } from '@/lib/firebase';
import { toast } from 'sonner';

type PushStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Gerencia o registro de push (FCM) do dispositivo do nutricionista.
 * Salva o token na tabela push_tokens para o backend enviar as notificações.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>('idle');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    isFirebaseConfigured();

  // Estado inicial: já concedeu permissão antes?
  useEffect(() => {
    if (supported && Notification.permission === 'granted') {
      setEnabled(true);
    }
  }, [supported]);

  // Mensagens em primeiro plano → toast com ação
  useEffect(() => {
    if (!supported) return;
    let unsub = () => {};
    onForegroundMessage((payload) => {
      const title = payload?.notification?.title || 'Ajustes do mês';
      const body = payload?.notification?.body || 'Há atletas para ajustar o plano.';
      toast(title, {
        description: body,
        action: { label: 'Ver', onClick: () => (window.location.href = payload?.data?.url || '/adjustments') },
      });
    }).then((u) => { unsub = u; });
    return () => unsub();
  }, [supported]);

  const enable = useCallback(async () => {
    if (!user) { setError('Faça login para ativar.'); return; }
    if (!supported) { setError('Push não suportado ou Firebase não configurado.'); return; }
    setStatus('loading');
    setError(null);
    try {
      const token = await requestPushToken();
      if (!token) throw new Error('Não foi possível obter o token do dispositivo.');

      const { error: upsertError } = await (supabase as any)
        .from('push_tokens')
        .upsert(
          { user_id: user.id, token, platform: 'web' },
          { onConflict: 'token' },
        );
      if (upsertError) throw upsertError;

      setEnabled(true);
      setStatus('ready');
      toast.success('Notificações de ajustes ativadas neste dispositivo.');
    } catch (e: any) {
      setStatus('error');
      setError(e?.message || 'Erro ao ativar notificações.');
    }
  }, [user, supported]);

  return { enable, status, enabled, error, supported };
}
