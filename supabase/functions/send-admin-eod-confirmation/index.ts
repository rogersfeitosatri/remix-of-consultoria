import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternal, denied, logSecurityEvent, restrictedCors } from "../_shared/authGuard.ts";

const ADMIN_PHONE = '5599984817697';

function nowInFortaleza(): Date {
  const now = new Date();
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

function formatDateBR(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTimeHHMM(t: string): string {
  // appointment_time is "HH:MM:SS"
  return t?.substring(0, 5) || '';
}

const numberEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

Deno.serve(async (req) => {
  const corsHeaders = restrictedCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders }

  // ETAPA 6A — C. INTERNAL/CRON: nenhuma chamada anônima executa este processador.
  const guard = await requireInternal(req);
  if (!guard.ok) {
    await logSecurityEvent({ eventType: 'processor_invocation_denied', fn: 'send-admin-eod-confirmation' });
    return denied(guard, corsHeaders);
  });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!zapiInstanceId || !zapiToken) {
      throw new Error('ZAPI credentials not configured');
    }

    const fortaleza = nowInFortaleza();
    const dateISO = `${fortaleza.getUTCFullYear()}-${String(fortaleza.getUTCMonth() + 1).padStart(2, '0')}-${String(fortaleza.getUTCDate()).padStart(2, '0')}`;
    const dateLabel = formatDateBR(fortaleza);

    console.log('[send-admin-eod-confirmation] Date Fortaleza:', dateISO);

    // Fetch all appointments for today
    const { data: appts, error: apptsError } = await supabase
      .from('appointments')
      .select('id, appointment_time, status, client_id, clients(name)')
      .eq('appointment_date', dateISO)
      .order('appointment_time', { ascending: true });

    if (apptsError) {
      console.error('[send-admin-eod-confirmation] Appts error:', apptsError);
      throw apptsError;
    }

    const all = appts || [];
    const pendingAction = all.filter((a) => a.status === 'scheduled' || a.status === 'confirmed');
    const completed = all.filter((a) => a.status === 'completed');

    // Skip if nothing to act on
    if (pendingAction.length === 0) {
      console.log('[send-admin-eod-confirmation] No pending appointments. Skipping.');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_pending_appointments' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build message
    let msg = `🗓 *Consultas de hoje — ${dateLabel}*\n\n`;
    msg += `*Pendentes de confirmação:*\n`;
    pendingAction.forEach((a, idx) => {
      const emoji = numberEmoji[idx] || `${idx + 1}.`;
      const time = formatTimeHHMM(a.appointment_time);
      const name = (a as any).clients?.name || 'Atleta';
      msg += `${emoji} ${time} · ${name}\n`;
    });

    msg += `\n_Para registrar o status, acesse o painel administrativo._\n`;

    if (completed.length > 0) {
      msg += `\n_(Já registradas hoje: ${completed.length} consulta${completed.length > 1 ? 's' : ''} concluída${completed.length > 1 ? 's' : ''})_`;
    }

    // Send via ZAPI
    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiClientToken || '',
      },
      body: JSON.stringify({ phone: ADMIN_PHONE, message: msg }),
    });

    const zapiResult = await zapiResponse.json();
    console.log('[send-admin-eod-confirmation] ZAPI response:', zapiResult);

    // Log dispatch
    await supabase.from('whatsapp_message_logs').insert({
      client_id: null,
      template_key: 'admin_eod_confirmation',
      status: zapiResponse.ok ? 'sent' : 'failed',
      error_message: zapiResponse.ok ? null : JSON.stringify(zapiResult),
      to_phone: ADMIN_PHONE,
      payload_preview: msg.substring(0, 500),
      message_type: 'admin_eod_confirmation',
      metadata: {
        triggered_by: 'cron_admin_eod',
        pending_count: pendingAction.length,
        completed_count: completed.length,
        zapi_response: zapiResult,
      },
    });

    return new Response(
      JSON.stringify({
        success: zapiResponse.ok,
        pending: pendingAction.length,
        completed: completed.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-admin-eod-confirmation] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
