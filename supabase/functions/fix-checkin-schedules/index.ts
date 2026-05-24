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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Snap to the nearest Monday (forward or backward). Ties go forward.
function snapToNearestMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  if (dow === 1) return dateStr;
  // Distance to previous Monday
  const back = (dow + 6) % 7; // Sun->6, Tue->1, Wed->2, ...
  // Distance to next Monday
  const fwd = (8 - dow) % 7 || 7;
  const delta = back < fwd ? -back : fwd;
  return addDays(dateStr, delta);
}

interface FixLog {
  client_id: string;
  client_name: string;
  deleted_future: number;
  inserted_future: number;
  marked_overdue: number;
  anchor_date: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const { client_ids = [], fix_all = false } = body as { client_ids?: string[]; fix_all?: boolean };

    // Resolve list of client_ids to fix
    let targets: string[] = client_ids ?? [];
    if (fix_all) {
      // Trigger audit internally
      const { data: schedules } = await admin
        .from('athlete_checkin_schedules')
        .select('client_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      targets = (schedules ?? []).map(s => s.client_id);
    }
    if (!targets.length) {
      return new Response(JSON.stringify({ logs: [], message: 'Nenhum atleta para corrigir' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const logs: FixLog[] = [];

    for (const clientId of targets) {
      try {
        const { data: sch } = await admin
          .from('athlete_checkin_schedules')
          .select('frequency_type, send_time, checkin_form_id')
          .eq('client_id', clientId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();
        if (!sch) continue;
        const interval = FREQUENCY_INTERVAL_DAYS[sch.frequency_type];
        if (!interval) continue;

        const { data: client } = await admin
          .from('clients')
          .select('name, start_date, end_date, is_active, is_frozen')
          .eq('id', clientId)
          .maybeSingle();
        if (!client) continue;
        if (client.is_active === false || client.is_frozen === true) continue;

        const { data: items } = await admin
          .from('scheduled_checkins')
          .select('id, scheduled_send_date, status, response_id, sent_at')
          .eq('client_id', clientId)
          .order('scheduled_send_date', { ascending: true });
        const all = items ?? [];

        const sentItems = all.filter(i => i.status === 'sent' || i.response_id || i.sent_at);
        let anchor = sentItems.length
          ? sentItems[sentItems.length - 1].scheduled_send_date
          : (client.start_date as string);

        // Override with the most recent actual dispatch (source of truth)
        const { data: lastDispatch } = await admin
          .from('checkin_dispatches')
          .select('sent_at')
          .eq('client_id', clientId)
          .eq('status', 'sent')
          .not('sent_at', 'is', null)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastDispatch?.sent_at) {
          const dispatchDate = String(lastDispatch.sent_at).slice(0, 10);
          if (!anchor || dispatchDate > anchor) anchor = dispatchDate;
        }

        // Mark overdue: past pending not sent
        const overdueIds = all
          .filter(i => i.status === 'pending' && i.scheduled_send_date < today)
          .map(i => i.id);
        let markedOverdue = 0;
        if (overdueIds.length) {
          const { error: updErr, count } = await admin
            .from('scheduled_checkins')
            .update({ status: 'overdue' }, { count: 'exact' })
            .in('id', overdueIds);
          if (updErr) throw updErr;
          markedOverdue = count ?? overdueIds.length;
        }

        // Delete future pending
        const futureIds = all
          .filter(i => i.status === 'pending' && i.scheduled_send_date >= today)
          .map(i => i.id);
        let deletedFuture = 0;
        if (futureIds.length) {
          const { error: delErr, count } = await admin
            .from('scheduled_checkins')
            .delete({ count: 'exact' })
            .in('id', futureIds);
          if (delErr) throw delErr;
          deletedFuture = count ?? futureIds.length;
        }

        // Recalculate from anchor + interval, up to end_date (or +180 days if no end_date)
        const endDate: string = client.end_date || addDays(today, 180);
        const sendTime = sch.send_time || '07:00:00';
        const newRows: any[] = [];
        let next = addDays(anchor, interval);
        while (next <= endDate) {
          if (next >= today) {
            newRows.push({
              client_id: clientId,
              user_id: userId,
              form_id: sch.checkin_form_id,
              scheduled_send_date: next,
              scheduled_send_time: sendTime,
              status: 'pending',
            });
          }
          next = addDays(next, interval);
        }

        let insertedFuture = 0;
        if (newRows.length) {
          const { error: insErr, count } = await admin
            .from('scheduled_checkins')
            .insert(newRows, { count: 'exact' });
          if (insErr) throw insErr;
          insertedFuture = count ?? newRows.length;
        }

        logs.push({
          client_id: clientId,
          client_name: client.name,
          deleted_future: deletedFuture,
          inserted_future: insertedFuture,
          marked_overdue: markedOverdue,
          anchor_date: anchor,
        });
      } catch (e) {
        logs.push({
          client_id: clientId,
          client_name: '',
          deleted_future: 0,
          inserted_future: 0,
          marked_overdue: 0,
          anchor_date: '',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(JSON.stringify({ logs, total: logs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
