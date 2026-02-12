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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const currentDay = now.getDay(); // 0=Sun, 1=Mon...
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' });

    console.log(`[process-checkin-dispatches] Running at ${now.toISOString()}, day=${currentDay}, time=${currentTime}`);

    // Fetch active schedules
    const { data: schedules, error: sErr } = await supabase
      .from('athlete_checkin_schedules')
      .select(`
        *,
        clients:client_id (id, name, phone, user_id),
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

        // Check if it's a valid send day
        const weeklyDays = schedule.weekly_days || [1]; // default Monday
        
        let shouldSendToday = false;
        
        if (schedule.frequency_type === 'weekly') {
          shouldSendToday = weeklyDays.includes(currentDay);
        } else if (schedule.frequency_type === 'biweekly') {
          // Send every 2 weeks on the specified days
          const startDate = new Date(schedule.start_date);
          const weeksSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
          shouldSendToday = weeksSinceStart % 2 === 0 && weeklyDays.includes(currentDay);
        } else if (schedule.frequency_type === 'monthly') {
          // Send on the same day of month as start_date
          const startDay = new Date(schedule.start_date).getDate();
          shouldSendToday = now.getDate() === startDay;
        }

        if (!shouldSendToday) {
          skipped++;
          continue;
        }

        // Check send_time (allow 10min window)
        const scheduleTime = schedule.send_time?.substring(0, 5) || '09:00';
        if (currentTime < scheduleTime) {
          skipped++;
          continue;
        }

        // Idempotency: check if already dispatched today for this schedule
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

        // Calculate due_at
        const dueAt = schedule.due_in_hours
          ? new Date(now.getTime() + schedule.due_in_hours * 60 * 60 * 1000).toISOString()
          : schedule.due_at || null;

        // Create dispatch record
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

        // Send via WhatsApp
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
          // Update schedule last_dispatched_at
          await supabase
            .from('athlete_checkin_schedules')
            .update({ last_dispatched_at: now.toISOString() })
            .eq('id', schedule.id);
        }

        dispatched++;

        // Small delay
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
