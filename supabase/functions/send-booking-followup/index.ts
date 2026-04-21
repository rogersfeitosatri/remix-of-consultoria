// send-booking-followup
// Cron diário (09:00 BRT). Identifica atletas que receberam o link de agendamento
// há mais de 3 dias e ainda não agendaram. Reenvia via send-booking-link com
// triggeredBy='followup_cron' e templateKey 'booking_followup_v1'. O duplicate guard
// e a checagem de elegibilidade ficam a cargo de send-booking-link.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cutoffISO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Busca schedules com status 'sent' há > 3 dias e sem appointment vinculado
  const { data: candidates, error } = await supabase
    .from('consultation_schedules')
    .select('id, client_id, user_id, scheduled_date, link_sent_at, status, appointment_id, updated_at')
    .eq('status', 'sent')
    .is('appointment_id', null)
    .or(`link_sent_at.lte.${cutoffISO},and(link_sent_at.is.null,updated_at.lte.${cutoffISO})`);

  if (error) {
    console.error('[send-booking-followup] Error fetching candidates:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[send-booking-followup] Found ${candidates?.length || 0} candidates`);

  const results: Array<{ schedule_id: string; client_id: string; outcome: string; reason?: string }> = [];

  for (const sch of candidates || []) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-booking-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          consultationScheduleId: sch.id,
          clientId: sch.client_id,
          messageType: 'followup',
          triggeredBy: 'followup_cron',
        }),
      });
      const json = await resp.json().catch(() => ({}));
      results.push({
        schedule_id: sch.id,
        client_id: sch.client_id,
        outcome: json.success ? 'sent' : (json.blocked ? 'blocked' : 'failed'),
        reason: json.reason,
      });
    } catch (e) {
      console.error(`[send-booking-followup] Failed for schedule ${sch.id}:`, e);
      results.push({ schedule_id: sch.id, client_id: sch.client_id, outcome: 'error' });
    }
  }

  const summary = {
    total_candidates: candidates?.length || 0,
    sent: results.filter(r => r.outcome === 'sent').length,
    blocked: results.filter(r => r.outcome === 'blocked').length,
    failed: results.filter(r => r.outcome === 'failed' || r.outcome === 'error').length,
    results,
  };

  console.log('[send-booking-followup] Summary:', summary);

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
