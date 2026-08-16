import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyUser } from "../_shared/fcm.ts";
import { requireInternal, denied, logSecurityEvent, restrictedCors } from "../_shared/authGuard.ts";

/**
 * ETAPA 5A — Notificação de revisões nutricionais.
 * A obrigação vem da entidade canônica `nutrition_reviews` (cadência fixa),
 * nunca de posição de check-in.
 */
Deno.serve(async (req) => {
  const corsHeaders = restrictedCors(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // ETAPA 6A — C. INTERNAL/CRON: nenhuma chamada anônima executa este processador.
  const guard = await requireInternal(req);
  if (!guard.ok) {
    await logSecurityEvent({ eventType: 'processor_invocation_denied', fn: 'send-adjustment-notifications' });
    return denied(guard, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase config ausente');
    const supabase = createClient(supabaseUrl, serviceKey);

    let targetDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' }))
      .toISOString().slice(0, 10);
    try {
      const body = await req.json();
      if (body?.date) targetDate = String(body.date).slice(0, 10);
    } catch { /* sem body */ }

    // 1) Materializa a cadência (idempotente) antes de notificar.
    const { error: matErr } = await supabase.rpc('materialize_nutrition_reviews', { p_user_id: null });
    if (matErr) console.error('materialize_nutrition_reviews:', matErr.message);

    // 2) Revisões que já venceram e continuam abertas.
    const { data: reviews, error: revErr } = await supabase
      .from('nutrition_reviews')
      .select('id, user_id, client_id, scheduled_for, status, clients(name)')
      .in('status', ['scheduled', 'pending', 'waiting_information', 'in_review'])
      .lte('scheduled_for', targetDate);
    if (revErr) throw revErr;

    const dueByUser = new Map<string, { id: string; name: string; date: string }[]>();
    for (const r of reviews || []) {
      const row = r as any;
      const arr = dueByUser.get(row.user_id) || [];
      arr.push({ id: row.id, name: row.clients?.name || 'Atleta', date: row.scheduled_for });
      dueByUser.set(row.user_id, arr);
    }

    const totalDue = [...dueByUser.values()].reduce((s, a) => s + a.length, 0);
    if (totalDue === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0, date: targetDate }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0, failed = 0;
    for (const [userId, items] of dueByUser) {
      const title = '📣 Revisões nutricionais';
      const body = items.length === 1
        ? `${items[0].name} está com a revisão nutricional pendente.`
        : `${items.length} atletas estão com a revisão nutricional pendente.`;
      const r = await notifyUser(supabase, userId, {
        prefKey: 'adjustment_due', title, body, url: '/adjustments',
      });
      sent += r.sent; failed += r.failed;

      const ids = items.map((i) => i.id);
      await supabase
        .from('nutrition_reviews')
        .update({ last_notified_at: new Date().toISOString() })
        .in('id', ids);
    }

    return new Response(JSON.stringify({ ok: true, date: targetDate, due: totalDue, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-adjustment-notifications error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
