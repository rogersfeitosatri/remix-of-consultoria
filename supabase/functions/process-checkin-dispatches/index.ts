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

// E.164 validation: Brazilian mobile = +55 + 2 digit DDD + 8 or 9 digit number = 12 or 13 digits total
function isValidE164BR(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
  return withDDI.length === 12 || withDDI.length === 13;
}

// True when phone is foreign (does NOT start with country code 55)
function isForeignPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return !digits.startsWith('55');
}

function getFrequencyWeeks(frequencyType: string): number {
  switch (frequencyType) {
    case 'daily': return 1;
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
  if (!weeklyDays.includes(currentDay)) return false;
  if (freqWeeks === 1) return true;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const today = new Date(now.toISOString().split('T')[0] + 'T00:00:00Z');

  if (!lastDispatchedAt) {
    // Para cadências maiores que semanal (quinzenal, mensal, etc.),
    // o primeiro envio acontece somente no primeiro dia válido (weekly_days)
    // a partir de start_date + freqWeeks semanas (ex.: mensal = 4 semanas).
    const start = new Date(startDate + 'T00:00:00Z');
    const firstEligible = new Date(start.getTime() + freqWeeks * 7 * MS_PER_DAY);
    return today.getTime() >= firstEligible.getTime();
  }

  const last = new Date(lastDispatchedAt);
  const lastDay = new Date(last.toISOString().split('T')[0] + 'T00:00:00Z');
  const daysSinceLast = Math.floor((today.getTime() - lastDay.getTime()) / MS_PER_DAY);
  return daysSinceLast >= (freqWeeks * 7 - 1);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Parse request body for source/options
  let source = 'cron';
  let forceReprocess = false;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      source = body.source || 'cron';
      forceReprocess = !!body.forceReprocess;
    }
  } catch (_) { /* ignore */ }

  // Create run log
  const { data: runRow } = await supabase
    .from('checkin_dispatch_runs')
    .insert({ source, status: 'running' })
    .select()
    .single();
  const runId = runRow?.id;

  let totalAnalyzed = 0;
  let totalEligible = 0;
  let dispatched = 0;
  let skipped = 0;
  let failed = 0;
  const details: any[] = [];

  try {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' });

    console.log(`[process-checkin-dispatches] Run ${runId} starting. day=${currentDay}, time=${currentTime}, source=${source}`);

    // HARD GUARD: Mondays only for the automatic cron. Manual reprocess (forceReprocess)
    // is allowed any day so admins can recover from failures.
    if (currentDay !== 1 && source === 'cron' && !forceReprocess) {
      console.log('[process-checkin-dispatches] Skipping automatic run: today is not Monday');
      if (runId) {
        await supabase.from('checkin_dispatch_runs').update({
          finished_at: new Date().toISOString(),
          status: 'success',
          total_analyzed: 0, total_eligible: 0, total_dispatched: 0,
          total_failed: 0, total_skipped: 0,
          details: [{ reason: 'not_monday', dow: currentDay }],
        }).eq('id', runId);
      }
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'not_monday', dow: currentDay }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: schedules, error: sErr } = await supabase
      .from('athlete_checkin_schedules')
      .select(`
        *,
        clients:client_id (id, name, phone, email, user_id, end_date, is_active, is_frozen),
        checkin_forms:checkin_form_id (id, title, is_active)
      `)
      .eq('is_active', true)
      .lte('start_date', now.toISOString().split('T')[0]);

    if (sErr) throw sErr;

    // STEP 1: Promote pre-scheduled dispatches
    const { data: scheduledDispatches } = await supabase
      .from('checkin_dispatches')
      .select(`
        *,
        clients:client_id (id, name, phone, email, user_id, end_date, is_active, is_frozen),
        checkin_forms:checkin_form_id (id, title, is_active),
        athlete_checkin_schedules:schedule_id (due_in_hours)
      `)
      .eq('status', 'scheduled')
      .lte('sent_at', now.toISOString());

    for (const dispatch of scheduledDispatches || []) {
      try {
        const client = (dispatch as any).clients;
        const form = (dispatch as any).checkin_forms;
        const sched = (dispatch as any).athlete_checkin_schedules;

        const foreign = isForeignPhone(client?.phone);

        if (!client?.phone || (!foreign && !isValidE164BR(client.phone))) {
          await supabase.from('checkin_dispatches').update({ status: 'failed', error_message: 'Telefone inválido (E.164)' }).eq('id', dispatch.id);
          failed++;
          continue;
        }
        if (foreign && !client.email) {
          await supabase.from('checkin_dispatches').update({ status: 'failed', error_message: 'Atleta estrangeiro sem email' }).eq('id', dispatch.id);
          failed++;
          continue;
        }
        if (!form?.is_active) {
          await supabase.from('checkin_dispatches').update({ status: 'failed', error_message: 'Formulário inativo' }).eq('id', dispatch.id);
          failed++;
          continue;
        }
        if (client.is_frozen || !client.is_active) {
          await supabase.from('checkin_dispatches').update({ status: 'failed', error_message: 'Plano congelado/inativo' }).eq('id', dispatch.id);
          skipped++;
          continue;
        }

        const dueInHours = sched?.due_in_hours || 48;
        const dueAt = dispatch.due_at || new Date(now.getTime() + dueInHours * 60 * 60 * 1000).toISOString();
        const checkinLink = `https://rogersfeitosa.com.br/form/${form.id}?client=${client.id}`;
        const codigoAcesso = foreign ? client.email : formatPhoneAsAccessCode(client.phone);

        let sendError: any = null;
        if (foreign) {
          const { error } = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'checkin-link',
              recipientEmail: client.email,
              idempotencyKey: `checkin-${dispatch.id}`,
              templateData: {
                name: client.name.split(' ')[0],
                link: checkinLink,
                accessCode: client.email,
                dueHours: `${dueInHours}h`,
              },
            },
          });
          sendError = error;
        } else {
          const { error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
              clientId: client.id,
              templateKey: 'checkin_reminder',
              context: {
                nome: client.name.split(' ')[0],
                link_checkin: checkinLink,
                checkin_link: checkinLink,
                codigo_acesso: codigoAcesso,
                prazo_resposta: `${dueInHours}h`,
              },
            },
          });
          sendError = error;
        }

        if (sendError) {
          await supabase.from('checkin_dispatches').update({ status: 'failed', error_message: sendError.message }).eq('id', dispatch.id);
          failed++;
        } else {
          await supabase.from('checkin_dispatches').update({
            status: 'sent',
            sent_at: now.toISOString(),
            due_at: dueAt,
            link_checkin: checkinLink,
          }).eq('id', dispatch.id);
          if (dispatch.schedule_id) {
            await supabase.from('athlete_checkin_schedules').update({ last_dispatched_at: now.toISOString() }).eq('id', dispatch.schedule_id);
          }
          dispatched++;
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        failed++;
        console.error(`[process-checkin-dispatches] Error promoting dispatch ${dispatch.id}:`, err);
      }
    }

    // STEP 2: Auto-generate from active schedules
    for (const schedule of schedules || []) {
      totalAnalyzed++;
      try {
        const client = schedule.clients as any;
        const form = schedule.checkin_forms as any;

        if (!client?.phone || !form?.is_active) {
          skipped++;
          continue;
        }

        const foreign = isForeignPhone(client.phone);

        if (!foreign && !isValidE164BR(client.phone)) {
          skipped++;
          details.push({ client: client.name, reason: 'invalid_phone' });
          continue;
        }

        if (foreign && !client.email) {
          skipped++;
          details.push({ client: client.name, reason: 'foreign_no_email' });
          continue;
        }

        const todayDate = now.toISOString().split('T')[0];

        if (client.is_frozen) { skipped++; continue; }

        if (!client.is_active || (client.end_date && client.end_date < todayDate)) {
          await supabase.from('athlete_checkin_schedules').update({ is_active: false }).eq('id', schedule.id);
          skipped++;
          continue;
        }

        const weeklyDays = schedule.weekly_days || [];

        // Validation: weekly type requires weekly_days
        if (!weeklyDays || weeklyDays.length === 0) {
          skipped++;
          details.push({ client: client.name, reason: 'missing_weekly_days' });
          continue;
        }

        const shouldSendToday = shouldSendForFrequency(
          schedule.frequency_type,
          currentDay,
          weeklyDays,
          schedule.start_date,
          forceReprocess ? null : schedule.last_dispatched_at,
          now
        );

        if (!shouldSendToday) { skipped++; continue; }

        const scheduleTime = schedule.send_time?.substring(0, 5) || '09:00';
        if (!forceReprocess && currentTime < scheduleTime) { skipped++; continue; }

        // Idempotency
        const todayStr = now.toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('checkin_dispatches')
          .select('id')
          .eq('schedule_id', schedule.id)
          .gte('sent_at', `${todayStr}T00:00:00`)
          .lte('sent_at', `${todayStr}T23:59:59`)
          .limit(1);

        if (existing && existing.length > 0 && !forceReprocess) { skipped++; continue; }

        totalEligible++;

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

        if (dErr) { failed++; continue; }

        const codigoAcesso = foreign ? client.email : formatPhoneAsAccessCode(client.phone);
        const checkinLink = `https://rogersfeitosa.com.br/form/${form.id}?client=${client.id}`;
        const dueHoursLabel = schedule.due_in_hours ? `${schedule.due_in_hours}h` : 'Sem prazo definido';

        let sendError: any = null;
        if (foreign) {
          const { error } = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'checkin-link',
              recipientEmail: client.email,
              idempotencyKey: `checkin-${dispatch.id}`,
              templateData: {
                name: client.name.split(' ')[0],
                link: checkinLink,
                accessCode: client.email,
                dueHours: dueHoursLabel,
              },
            },
          });
          sendError = error;
        } else {
          const { error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
              clientId: client.id,
              templateKey: 'checkin_reminder',
              context: {
                nome: client.name.split(' ')[0],
                link_checkin: checkinLink,
                checkin_link: checkinLink,
                codigo_acesso: codigoAcesso,
                prazo_resposta: dueHoursLabel,
              },
            },
          });
          sendError = error;
        }

        if (sendError) {
          await supabase.from('checkin_dispatches').update({ status: 'failed', error_message: sendError.message }).eq('id', dispatch.id);
          failed++;
        } else {
          await supabase.from('athlete_checkin_schedules').update({ last_dispatched_at: now.toISOString() }).eq('id', schedule.id);
          dispatched++;
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        failed++;
        console.error(`[process-checkin-dispatches] Error schedule ${schedule.id}:`, err);
      }
    }

    console.log(`[process-checkin-dispatches] Done. analyzed=${totalAnalyzed} eligible=${totalEligible} dispatched=${dispatched} failed=${failed} skipped=${skipped}`);

    if (runId) {
      await supabase.from('checkin_dispatch_runs').update({
        finished_at: new Date().toISOString(),
        status: 'success',
        total_analyzed: totalAnalyzed,
        total_eligible: totalEligible,
        total_dispatched: dispatched,
        total_failed: failed,
        total_skipped: skipped,
        details: details.slice(0, 50),
      }).eq('id', runId);
    }

    return new Response(
      JSON.stringify({ success: true, runId, totalAnalyzed, totalEligible, dispatched, failed, skipped }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[process-checkin-dispatches] Fatal:', error);
    if (runId) {
      await supabase.from('checkin_dispatch_runs').update({
        finished_at: new Date().toISOString(),
        status: 'error',
        error_message: error.message,
        total_analyzed: totalAnalyzed,
        total_eligible: totalEligible,
        total_dispatched: dispatched,
        total_failed: failed,
        total_skipped: skipped,
      }).eq('id', runId);
    }
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
