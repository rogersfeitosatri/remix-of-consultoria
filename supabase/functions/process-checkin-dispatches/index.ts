import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatPhoneAsAccessCode(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
  if (withDDI.length === 13) {
    return `+${withDDI.slice(0, 2)} (${withDDI.slice(2, 4)}) ${withDDI.slice(4, 9)}-${withDDI.slice(9)}`;
  } else if (withDDI.length === 12) {
    return `+${withDDI.slice(0, 2)} (${withDDI.slice(2, 4)}) ${withDDI.slice(4, 8)}-${withDDI.slice(8)}`;
  }
  return `+55 ${phone}`;
}

// Map frequency_type to interval in weeks
function getFrequencyWeeks(frequencyType: string): number {
  switch (frequencyType) {
    case 'daily': return 1; // daily still sends weekly on Mondays
    case 'weekly': return 1;
    case 'biweekly': return 2;
    case 'three_weeks': return 3;
    case 'monthly': return 4;
    case 'bimonthly': return 8;
    case 'quarterly': return 12;
    default: return 1;
  }
}

function shouldSendForFrequency(
  frequencyType: string,
  currentDay: number,
  weeklyDays: number[],
  startDate: string,
  lastDispatchedAt: string | null,
  now: Date
): boolean {
  const freqWeeks = getFrequencyWeeks(frequencyType);

  // Check if today is a valid send day
  if (!weeklyDays.includes(currentDay)) return false;

  if (freqWeeks === 1) {
    // Weekly: send every week on the specified days
    return true;
  }

  // NEW LOGIC: "last dispatch + cycle" instead of "weeks_since_start % cycle"
  // This eliminates the alignment bug where start_date offset caused permanent skips.
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const today = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');

  if (!lastDispatchedAt) {
    // Never dispatched: send if start_date has passed
    const start = new Date(startDate + 'T00:00:00Z');
    return today.getTime() >= start.getTime();
  }

  // Send if at least (freqWeeks * 7 - 1) days have passed since last dispatch
  // The "-1" provides a small tolerance to avoid edge cases on the exact target day
  const last = new Date(lastDispatchedAt);
  const lastDay = new Date(last.toISOString().split('T')[0] + 'T00:00:00Z');
  const daysSinceLast = Math.floor((today.getTime() - lastDay.getTime()) / MS_PER_DAY);
  return daysSinceLast >= (freqWeeks * 7 - 1);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' });

    console.log(`[process-checkin-dispatches] Running at ${now.toISOString()}, day=${currentDay}, time=${currentTime}`);

    const { data: schedules, error: sErr } = await supabase
      .from('athlete_checkin_schedules')
      .select(`
        *,
        clients:client_id (id, name, phone, user_id, end_date, is_active, is_frozen),
        checkin_forms:checkin_form_id (id, title, is_active)
      `)
      .eq('is_active', true)
      .lte('start_date', now.toISOString().split('T')[0]);

    if (sErr) {
      console.error('[process-checkin-dispatches] Error fetching schedules:', sErr);
      throw sErr;
    }

    let dispatched = 0;
    let skipped = 0;

    for (const schedule of schedules || []) {
      try {
        const client = schedule.clients as any;
        const form = schedule.checkin_forms as any;

        if (!client?.phone || !form?.is_active) {
          skipped++;
          continue;
        }

        const todayDate = now.toISOString().split('T')[0];

        if (client.is_frozen) {
          console.log(`[process-checkin-dispatches] Skipping ${client.name}: plan is frozen`);
          skipped++;
          continue;
        }

        if (!client.is_active || (client.end_date && client.end_date < todayDate)) {
          console.log(`[process-checkin-dispatches] Skipping ${client.name}: plan expired`);
          await supabase
            .from('athlete_checkin_schedules')
            .update({ is_active: false })
            .eq('id', schedule.id);
          skipped++;
          continue;
        }

        // Use the unified frequency check
        const weeklyDays = schedule.weekly_days || [1];
        const shouldSendToday = shouldSendForFrequency(
          schedule.frequency_type,
          currentDay,
          weeklyDays,
          schedule.start_date,
          now
        );

        if (!shouldSendToday) {
          skipped++;
          continue;
        }

        // Check send_time
        const scheduleTime = schedule.send_time?.substring(0, 5) || '09:00';
        if (currentTime < scheduleTime) {
          skipped++;
          continue;
        }

        // Idempotency check
        const todayStr = now.toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('checkin_dispatches')
          .select('id')
          .eq('schedule_id', schedule.id)
          .gte('sent_at', `${todayStr}T00:00:00`)
          .lte('sent_at', `${todayStr}T23:59:59`)
          .limit(1);

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

        const dueAt = schedule.due_in_hours
          ? new Date(now.getTime() + schedule.due_in_hours * 60 * 60 * 1000).toISOString()
          : schedule.due_at || null;

        const { data: dispatch, error: dErr } = await supabase
          .from('checkin_dispatches')
          .insert({
            user_id: client.user_id,
            client_id: client.id,
            checkin_form_id: form.id,
            schedule_id: schedule.id,
            due_at: dueAt,
            status: 'sent',
            link_checkin: `https://rogersfeitosa.com.br/form/${form.id}?client=${client.id}`,
          })
          .select()
          .single();

        if (dErr) {
          console.error(`[process-checkin-dispatches] Error creating dispatch for ${client.name}:`, dErr);
          continue;
        }

        const codigoAcesso = formatPhoneAsAccessCode(client.phone);
        const checkinLink = `https://rogersfeitosa.com.br/form/${form.id}?client=${client.id}`;

        const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp', {
          body: {
            clientId: client.id,
            templateKey: 'checkin_reminder',
            context: {
              nome: client.name.split(' ')[0],
              link_checkin: checkinLink,
              checkin_link: checkinLink,
              codigo_acesso: codigoAcesso,
              prazo_resposta: schedule.due_in_hours ? `${schedule.due_in_hours}h` : 'Sem prazo definido',
            },
          },
        });

        if (whatsappError) {
          await supabase
            .from('checkin_dispatches')
            .update({ status: 'failed', error_message: whatsappError.message })
            .eq('id', dispatch.id);
        } else {
          await supabase
            .from('athlete_checkin_schedules')
            .update({ last_dispatched_at: now.toISOString() })
            .eq('id', schedule.id);
        }

        dispatched++;
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        console.error(`[process-checkin-dispatches] Error processing schedule ${schedule.id}:`, err);
      }
    }

    console.log(`[process-checkin-dispatches] Done. Dispatched: ${dispatched}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({ success: true, dispatched, skipped }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[process-checkin-dispatches] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
