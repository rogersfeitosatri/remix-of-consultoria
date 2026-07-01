import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyUser } from "../_shared/fcm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Regra de ajuste (espelha src/lib/adjustments.ts) ───────────────────────────
function isAdjustmentCheckin(freq: string | null, n: number): boolean {
  if (n < 1) return false;
  switch (freq) {
    case 'weekly':
    case 'daily':
      return n >= 3 && (n - 3) % 4 === 0;   // 3, 7, 11…
    case 'biweekly':
      return n >= 2 && (n - 2) % 2 === 0;   // 2, 4, 6…
    case 'three_weeks':
    case 'monthly':
    case 'bimonthly':
    case 'quarterly':
      return true;                          // todo checkin
    default:
      return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase config ausente');
    const supabase = createClient(supabaseUrl, serviceKey);

    // Permite forçar uma data via body para testes; por padrão usa hoje.
    let targetDate = new Date().toISOString().slice(0, 10);
    try {
      const body = await req.json();
      if (body?.date) targetDate = String(body.date).slice(0, 10);
    } catch { /* sem body */ }

    // 1) Clientes-alvo: consultoria, ativo, não congelado, com checkin, 0 ou 1 consulta.
    const { data: clients, error: clientsErr } = await supabase
      .from('clients')
      .select('id, user_id, name, checkin_frequency, plan_type, is_active, is_frozen, has_checkin, has_consultations, consultation_count')
      .eq('plan_type', 'consultoria')
      .eq('is_active', true)
      .eq('is_frozen', false)
      .eq('has_checkin', true);
    if (clientsErr) throw clientsErr;

    const targets = (clients || []).filter((c: any) => {
      if (!c.checkin_frequency) return false;
      const consultas = c.has_consultations ? Number(c.consultation_count || 0) : 0;
      return consultas <= 1;
    });

    if (targets.length === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0, message: 'Sem atletas-alvo' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Checkins programados desses clientes.
    const ids = targets.map((c: any) => c.id);
    const { data: checkins, error: ciErr } = await supabase
      .from('scheduled_checkins')
      .select('client_id, scheduled_send_date, status')
      .in('client_id', ids)
      .order('scheduled_send_date', { ascending: true });
    if (ciErr) throw ciErr;

    const byClient = new Map<string, string[]>();
    for (const ch of checkins || []) {
      const arr = byClient.get(ch.client_id) || [];
      arr.push(ch.scheduled_send_date);
      byClient.set(ch.client_id, arr);
    }

    // 3) Quais clientes têm ajuste em targetDate? Agrupa por user_id (nutricionista dono).
    const dueByUser = new Map<string, { id: string; name: string }[]>();
    for (const c of targets) {
      const dates = (byClient.get(c.id) || []).slice().sort();
      let isDue = false;
      dates.forEach((d, i) => { if (d === targetDate && isAdjustmentCheckin(c.checkin_frequency, i + 1)) isDue = true; });
      if (isDue) {
        const arr = dueByUser.get(c.user_id) || [];
        arr.push({ id: c.id, name: c.name });
        dueByUser.set(c.user_id, arr);
      }
    }

    const totalDue = [...dueByUser.values()].reduce((s, a) => s + a.length, 0);
    if (totalDue === 0) {
      return new Response(JSON.stringify({ ok: true, due: 0, date: targetDate }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4) Envia push por usuário (respeitando preferência 'adjustment_due').
    let sent = 0, failed = 0;
    for (const [userId, athletes] of dueByUser) {
      const title = '📣 Ajustes do mês';
      const body = athletes.length === 1
        ? `${athletes[0].name} fecha o bloco mensal hoje — hora de ajustar o plano.`
        : `${athletes.length} atletas fecham o bloco mensal hoje — hora de ajustar os planos.`;
      const r = await notifyUser(supabase, userId, { prefKey: 'adjustment_due', title, body, url: '/adjustments' });
      sent += r.sent; failed += r.failed;
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
