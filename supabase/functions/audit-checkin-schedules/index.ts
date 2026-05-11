import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREQUENCY_INTERVAL_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  three_weeks: 21,
  monthly: 28,
  bimonthly: 56,
  quarterly: 84,
};

interface AthleteAuditResult {
  client_id: string;
  client_name: string;
  configured_frequency: string;
  expected_interval_days: number;
  last_sent_date: string | null;
  next_scheduled_date: string | null;
  expected_next_date: string | null;
  interval_discrepancy_days: number;
  errors: string[];
  future_dates_wrong: number;
  status: 'ok' | 'warning' | 'error';
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((da - db) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: schedules, error: schErr } = await admin
      .from('athlete_checkin_schedules')
      .select('client_id, frequency_type, send_time')
      .eq('user_id', userId)
      .eq('is_active', true);
    if (schErr) throw schErr;

    const today = new Date().toISOString().slice(0, 10);
    const results: AthleteAuditResult[] = [];

    for (const sch of schedules ?? []) {
      const expectedInterval = FREQUENCY_INTERVAL_DAYS[sch.frequency_type] ?? null;
      if (!expectedInterval) continue;

      const { data: client } = await admin
        .from('clients')
        .select('name, is_active, is_frozen')
        .eq('id', sch.client_id)
        .maybeSingle();
      if (!client || client.is_active === false || client.is_frozen === true) continue;

      const { data: items } = await admin
        .from('scheduled_checkins')
        .select('id, scheduled_send_date, status, response_id, sent_at')
        .eq('client_id', sch.client_id)
        .order('scheduled_send_date', { ascending: true });

      const all = items ?? [];
      const sentItems = all.filter(i => i.status === 'sent' || i.response_id || i.sent_at);
      const lastSent = sentItems.length ? sentItems[sentItems.length - 1].scheduled_send_date : null;

      const futurePending = all.filter(i => i.status === 'pending' && i.scheduled_send_date >= today);
      const nextScheduled = futurePending.length ? futurePending[0].scheduled_send_date : null;

      const expectedNext = lastSent ? addDays(lastSent, expectedInterval) : null;
      const discrepancy = (nextScheduled && expectedNext) ? diffDays(nextScheduled, expectedNext) : 0;

      // Check intervals between consecutive future pending dates
      let futureWrong = 0;
      for (let i = 1; i < futurePending.length; i++) {
        const interval = diffDays(futurePending[i].scheduled_send_date, futurePending[i - 1].scheduled_send_date);
        if (Math.abs(interval - expectedInterval) > 1) futureWrong++;
      }
      // Also count next vs expected
      if (expectedNext && nextScheduled && Math.abs(discrepancy) > 1) futureWrong++;

      const errors: string[] = [];
      if (expectedNext && nextScheduled && Math.abs(discrepancy) > 1) {
        errors.push(`Próximo envio em ${nextScheduled} mas deveria ser ${expectedNext} (diferença ${discrepancy} dias)`);
      }
      if (futureWrong > 1) {
        errors.push(`${futureWrong} datas futuras com intervalo incorreto`);
      }

      let status: 'ok' | 'warning' | 'error' = 'ok';
      if (errors.length === 0 && futureWrong === 0) status = 'ok';
      else if (futureWrong >= 2) status = 'error';
      else if (sch.frequency_type === 'monthly' && nextScheduled && lastSent && diffDays(nextScheduled, lastSent) < 20) status = 'error';
      else status = 'warning';

      if (status !== 'ok') {
        results.push({
          client_id: sch.client_id,
          client_name: client.name,
          configured_frequency: sch.frequency_type,
          expected_interval_days: expectedInterval,
          last_sent_date: lastSent,
          next_scheduled_date: nextScheduled,
          expected_next_date: expectedNext,
          interval_discrepancy_days: discrepancy,
          errors,
          future_dates_wrong: futureWrong,
          status,
        });
      }
    }

    const order = { error: 0, warning: 1, ok: 2 };
    results.sort((a, b) => order[a.status] - order[b.status]);

    return new Response(JSON.stringify({ results, total: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
