import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Refatorado (Fase 6):
 * Este cron NÃO envia mais WhatsApp diretamente.
 * Ele apenas identifica schedules elegíveis e delega para `send-booking-link`,
 * que centraliza toda a lógica de eligibility, idempotency e logging.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const nowBRT = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const currentDate = new Date(nowBRT);
    const todayStr = currentDate.toISOString().split('T')[0];

    console.log(`[process-consultation-schedules] Running on ${todayStr} BRT`);

    const { data: pendingSchedules, error: fetchError } = await supabase
      .from('consultation_schedules')
      .select('id, client_id, user_id, send_link_date, status')
      .eq('send_link_date', todayStr)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw new Error('Failed to fetch pending consultation schedules');
    }

    if (!pendingSchedules || pendingSchedules.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: 'No pending schedules' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingSchedules.length} pending schedules to delegate`);

    const results: Array<{ scheduleId: string; clientId: string; status: string; reason?: string }> = [];

    for (const schedule of pendingSchedules) {
      // Centralized eligibility check
      const { data: eligibility } = await supabase.rpc('is_client_eligible_for_booking', {
        _client_id: schedule.client_id,
      });

      const elig = Array.isArray(eligibility) ? eligibility[0] : eligibility;
      if (!elig?.eligible) {
        console.log(`Skipping ${schedule.client_id}: ${elig?.reason}`);
        await supabase.from('whatsapp_message_logs').insert({
          user_id: schedule.user_id,
          client_id: schedule.client_id,
          message_type: 'consultation_schedule_booking',
          template_key: 'weekly_booking_link',
          to_phone: 'N/A',
          status: 'skipped',
          blocked_reason: elig?.reason || 'not_eligible',
          triggered_by: 'cron_daily',
          consultation_schedule_id: schedule.id,
          metadata: { schedule_id: schedule.id },
        });
        results.push({ scheduleId: schedule.id, clientId: schedule.client_id, status: 'skipped', reason: elig?.reason });
        continue;
      }

      // Detect first consultation vs follow-up by counting prior completed/scheduled
      const { count: priorCount } = await supabase
        .from('consultation_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', schedule.client_id)
        .in('status', ['completed', 'scheduled'])
        .neq('id', schedule.id);

      const isFirstConsultation = (priorCount ?? 0) === 0;
      const templateKey = isFirstConsultation
        ? 'booking_first_consultation'
        : 'booking_followup_consultation';

      // Delegate to send-booking-link (it handles idempotency, template, send, log)
      try {
        const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke('send-booking-link', {
          body: {
            clientId: schedule.client_id,
            consultationScheduleId: schedule.id,
            triggeredBy: 'cron_daily',
            templateKey,
            messageType: 'booking_invite',
          },
        });

        if (invokeErr) {
          console.error(`Invoke error for ${schedule.id}:`, invokeErr);
          results.push({ scheduleId: schedule.id, clientId: schedule.client_id, status: 'failed', reason: invokeErr.message });
        } else {
          results.push({ scheduleId: schedule.id, clientId: schedule.client_id, status: invokeRes?.success ? 'sent' : (invokeRes?.reason || 'skipped') });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        console.error(`Failed to delegate ${schedule.id}:`, msg);
        results.push({ scheduleId: schedule.id, clientId: schedule.client_id, status: 'failed', reason: msg });
      }
    }

    const successCount = results.filter(r => r.status === 'sent' || r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`Done. sent=${successCount} skipped=${skippedCount} failed=${failedCount}`);

    return new Response(JSON.stringify({
      success: true,
      processed: pendingSchedules.length,
      successCount,
      skippedCount,
      failedCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('process-consultation-schedules error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
