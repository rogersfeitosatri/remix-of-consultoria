import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
export async function invokeManualBooking(options: { body: Record<string, unknown> }) {
  const { data, error } = await supabase.functions.invoke('send-manual-booking', {body: { ...options.body, clientId: options.body.clientId ?? options.body.client_id, send: options.body.dryRun !== true }});
  if (error instanceof FunctionsHttpError) {
    const result = await error.context.json().catch(() => null);
    throw new Error(result?.message || 'Não foi possível enviar o convite. Confira sua sessão e a conexão do WhatsApp.');
  }
  if (error || data?.success !== true) throw new Error(data?.message || 'Não foi possível conectar ao serviço de convites.');
  return { data, error: null };
}
