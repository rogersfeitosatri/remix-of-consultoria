import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_PHONE = '5599984817697';

function nowInFortaleza(): Date {
  // Fortaleza is UTC-3, no DST
  const now = new Date();
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

function formatDateBR(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTimeBR(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

function describePlan(client: any): string {
  const freq = client?.consultation_frequency;
  if (freq === 'six_weeks' || freq === '6_weeks') return '6w';
  if (freq === 'monthly' || freq === '4_weeks') return '4w';
  if (client?.has_consultations === false) return 'só check-in';
  return 'avulsa';
}

function describeProgress(client: any): string {
  const total = client?.consultation_count;
  const done = client?.last_consultation_index;
  if (total && done !== null && done !== undefined) {
    return `${done + 1}ª/${total}`;
  }
  if (total) return `de ${total}`;
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    const dateLabel = formatDateBR(fortaleza);
    const timeLabel = formatTimeBR(fortaleza);

    // Today's window in Fortaleza time, converted back to UTC for query
    const fortalezaY = fortaleza.getUTCFullYear();
    const fortalezaM = fortaleza.getUTCMonth();
    const fortalezaD = fortaleza.getUTCDate();
    // 00:00 Fortaleza = 03:00 UTC
    const startUTC = new Date(Date.UTC(fortalezaY, fortalezaM, fortalezaD, 3, 0, 0));
    // 12:00 Fortaleza = 15:00 UTC
    const endUTC = new Date(Date.UTC(fortalezaY, fortalezaM, fortalezaD, 15, 0, 0));

    console.log('[send-admin-weekly-summary] Window UTC:', startUTC.toISOString(), '->', endUTC.toISOString());

    // 1. Fetch booking link logs in window
    const { data: logs, error: logsError } = await supabase
      .from('whatsapp_message_logs')
      .select('id, client_id, status, error_message, blocked_reason, template_key, created_at, clients(name, consultation_frequency, consultation_count, last_consultation_index, has_consultations)')
      .or('template_key.ilike.%booking%,template_key.ilike.%agendamento%')
      .gte('created_at', startUTC.toISOString())
      .lte('created_at', endUTC.toISOString())
      .order('created_at', { ascending: true });

    if (logsError) {
      console.error('[send-admin-weekly-summary] Logs error:', logsError);
      throw logsError;
    }

    const sent: any[] = [];
    const failed: any[] = [];
    for (const l of logs || []) {
      if (l.status === 'sent' && !l.blocked_reason) sent.push(l);
      else failed.push(l);
    }

    // 2. Fetch pending invites
    const { data: pending, error: pendingError } = await supabase
      .rpc('get_pending_booking_invites');

    if (pendingError) {
      console.error('[send-admin-weekly-summary] Pending error:', pendingError);
    }

    // Filter pending: exclude clients that already received today
    const sentClientIds = new Set(sent.map((s) => s.client_id));
    const pendingFiltered = (pending || []).filter((p: any) => !sentClientIds.has(p.client_id));

    // 3. Build message
    let msg = `📋 *Resumo de Links — ${dateLabel}*\n\n`;

    if (sent.length > 0) {
      msg += `✅ *Links enviados hoje (${sent.length}):*\n`;
      for (const s of sent) {
        const c = s.clients;
        const name = c?.name || 'Atleta';
        const plan = describePlan(c);
        const progress = describeProgress(c);
        msg += `• ${name} — ${plan}${progress ? ` — ${progress} consulta` : ''}\n`;
      }
      msg += '\n';
    }

    if (failed.length > 0) {
      msg += `❌ *Falhas de envio (${failed.length}):*\n`;
      for (const f of failed) {
        const c = f.clients;
        const name = c?.name || 'Atleta';
        const reason = f.blocked_reason || f.error_message || 'erro desconhecido';
        msg += `• ${name} — ${String(reason).substring(0, 60)}\n`;
      }
      msg += '\n';
    }

    if (pendingFiltered.length > 0) {
      msg += `⏳ *Pendentes (não enviados ainda - ${pendingFiltered.length}):*\n`;
      for (const p of pendingFiltered) {
        msg += `• ${p.client_name} — envio previsto para hoje\n`;
      }
      msg += '\n';
    }

    if (sent.length === 0 && failed.length === 0 && pendingFiltered.length === 0) {
      msg += `_Nenhum link programado para hoje._\n\n`;
    }

    msg += `_Sistema Zona Nutri · ${timeLabel}_`;

    // 4. Send via ZAPI
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
    console.log('[send-admin-weekly-summary] ZAPI response:', zapiResult);

    // 5. Log dispatch
    await supabase.from('whatsapp_message_logs').insert({
      client_id: null,
      template_key: 'admin_weekly_summary',
      status: zapiResponse.ok ? 'sent' : 'failed',
      error_message: zapiResponse.ok ? null : JSON.stringify(zapiResult),
      to_phone: ADMIN_PHONE,
      payload_preview: msg.substring(0, 500),
      message_type: 'admin_weekly_summary',
      metadata: {
        triggered_by: 'cron_admin_summary',
        sent_count: sent.length,
        failed_count: failed.length,
        pending_count: pendingFiltered.length,
        zapi_response: zapiResult,
      },
    });

    return new Response(
      JSON.stringify({
        success: zapiResponse.ok,
        sent: sent.length,
        failed: failed.length,
        pending: pendingFiltered.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-admin-weekly-summary] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
