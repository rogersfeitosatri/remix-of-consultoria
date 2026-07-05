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

  // Salva/atualiza o token do dispositivo na tabela push_tokens.
  const registerToken = useCallback(async () => {
    if (!user) return false;
    const token = await requestPushToken();
    if (!token) return false;
    const { error: upsertError } = await (supabase as any)
      .from('push_tokens')
      .upsert(
        { user_id: user.id, token, platform: 'web', updated_at: new Date().toISOString() },
        { onConflict: 'token' },
      );
    if (upsertError) throw upsertError;
    return true;
  }, [user]);

  // Estado inicial: já concedeu permissão antes?
  // Se sim, re-registra o token silenciosamente — essencial após mudanças de
  // configuração do Firebase (projeto/VAPID novos invalidam tokens antigos),
  // caso contrário o aparelho mostra "ativado" mas guarda um token morto.
  useEffect(() => {
    if (!supported || !user) return;
    if (Notification.permission !== 'granted') return;
    setEnabled(true);
    registerToken().catch((e) => {
      console.warn('[push] falha ao re-registrar token:', e);
    });
  }, [supported, user, registerToken]);

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
      const ok = await registerToken();
      if (!ok) throw new Error('Não foi possível obter o token do dispositivo.');

      setEnabled(true);
      setStatus('ready');
      toast.success('Notificações de ajustes ativadas neste dispositivo.');
    } catch (e: any) {
      setStatus('error');
      setError(e?.message || 'Erro ao ativar notificações.');
    }
  }, [user, supported, registerToken]);

  return { enable, status, enabled, error, supported };
}
