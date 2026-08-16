import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * ETAPA 3B — FUNÇÃO DESATIVADA.
 *
 * O motor canônico e ÚNICO de envio de check-in é `process-checkin-dispatches`.
 * Esta função existia como segundo motor (lia `scheduled_checkins`) e podia gerar
 * envios duplicados. O cron correspondente foi removido.
 *
 * Mantida apenas como stub para que chamadas antigas não quebrem — ela nunca envia nada.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.warn('[send-checkin-reminders] DEPRECATED: use process-checkin-dispatches');

  return new Response(
    JSON.stringify({
      success: true,
      skipped: true,
      deprecated: true,
      reason: 'deprecated_use_process_checkin_dispatches',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
