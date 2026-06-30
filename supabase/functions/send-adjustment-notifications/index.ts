import { createClient } from "npm:@supabase/supabase-js@2";

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

// ── FCM HTTP v1 (service account) ──────────────────────────────────────────────
function b64url(data: ArrayBuffer | string): string {
  let str: string;
  if (typeof data === 'string') {
    str = btoa(unescape(encodeURIComponent(data)));
  } else {
    const bytes = new Uint8Array(data);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    str = btoa(bin);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`OAuth token error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token as string;
}

async function sendFcm(accessToken: string, projectId: string, token: string, title: string, body: string, url: string) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { url },
        webpush: { fcm_options: { link: url } },
      },
    }),
  });
  return { ok: res.ok, status: res.status, body: res.ok ? null : await res.text() };
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

    // 4) Envia push via FCM (se configurado).
    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (!saRaw) {
      return new Response(JSON.stringify({
        ok: true, due: totalDue, date: targetDate, sent: 0,
        note: 'FCM_SERVICE_ACCOUNT não configurado — ajustes calculados mas push não enviado.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const sa = JSON.parse(saRaw);
    const accessToken = await getAccessToken(sa);
    const projectId = sa.project_id;

    let sent = 0, failed = 0;
    for (const [userId, athletes] of dueByUser) {
      const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
      if (!tokens || tokens.length === 0) continue;
      const title = '📣 Ajustes do mês';
      const body = athletes.length === 1
        ? `${athletes[0].name} fecha o bloco mensal hoje — hora de ajustar o plano.`
        : `${athletes.length} atletas fecham o bloco mensal hoje — hora de ajustar os planos.`;
      for (const t of tokens) {
        const r = await sendFcm(accessToken, projectId, t.token, title, body, '/adjustments');
        if (r.ok) sent++; else { failed++; console.error('FCM falhou:', r.status, r.body); }
      }
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
