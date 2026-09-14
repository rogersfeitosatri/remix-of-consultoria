import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export async function sendManualCheckin(clientId: string, dryRun = false) {
  const { data, error } = await supabase.functions.invoke('send-manual-checkin', {
    body: { clientId, dryRun, send: !dryRun },
  });
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    throw new Error(body?.message || (error.context.status === 401
      ? 'Sua sessão expirou. Entre novamente como administrador.'
      : 'Não foi possível concluir o envio. Confira a conexão do WhatsApp.'));
  }
  if (error) throw new Error('Não foi possível conectar ao serviço de envio. Tente novamente em instantes.');
  if (data?.success !== true) throw new Error(data?.message || 'O serviço não confirmou o envio.');
  return data as { success: true; message: string; dryRun?: boolean; dispatchId?: string };
}
