// NutriPeriodiza — Cron diário (10:00 América/Fortaleza) que dispara WhatsApp
// para 4 eventos relevantes da preparação de prova:
//  1) phase_taper_entry: na primeira segunda em que weeks_to_race <= 3
//  2) carboloading_start: 3 dias antes da prova (se distância >= 21k)
//  3) gut_training_weekly: toda segunda nas fases build/specific/peak
//  4) race_day: no dia da prova
//
// Idempotente via tabela np_event_dispatches (UNIQUE em client_id, race_id, event_type, event_key).
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternal, denied, logSecurityEvent, restrictedCors } from "../_shared/authGuard.ts";

type RacePhase = 'base' | 'build' | 'specific' | 'peak' | 'taper' | 'race';

function calcWeeks(raceDate: string, todayISO: string): number {
  const t = new Date(raceDate + 'T00:00:00').getTime();
  const today = new Date(todayISO + 'T00:00:00').getTime();
  return Math.ceil((t - today) / (1000 * 60 * 60 * 24 * 7));
}

function calcDays(raceDate: string, todayISO: string): number {
  const t = new Date(raceDate + 'T00:00:00').getTime();
  const today = new Date(todayISO + 'T00:00:00').getTime();
  return Math.round((t - today) / (1000 * 60 * 60 * 24));
}

function calcPhase(weeks: number): RacePhase {
  if (weeks <= 0) return 'race';
  if (weeks <= 3) return 'taper';
  if (weeks <= 7) return 'peak';
  if (weeks <= 11) return 'specific';
  if (weeks <= 15) return 'build';
  return 'base';
}

function fortalezaToday(): { dateStr: string; dow: number } {
  // America/Fortaleza = UTC-3, sem DST
  const now = new Date();
  const fz = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const dateStr = fz.toISOString().slice(0, 10);
  const dow = fz.getUTCDay(); // 0=Dom, 1=Seg
  return { dateStr, dow };
}

// Mapa de event_type → template_key na Central de Mensagens
const EVENT_TEMPLATE_MAP: Record<string, string> = {
  phase_taper_entry: 'np_phase_taper_entry',
  carboloading_start: 'np_carboloading_start',
  protocol_7_days_pre_race: 'np_protocol_7_days_pre_race',
  gut_training_weekly: 'np_gut_training_weekly',
  race_day: 'np_race_day',
};

function renderTemplate(body: string, vars: Record<string, string | number>): string {
  let out = body;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

Deno.serve(async (req) => {
  const corsHeaders = restrictedCors(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // ETAPA 6A — C. INTERNAL/CRON: nenhuma chamada anônima executa este processador.
  const guard = await requireInternal(req);
  if (!guard.ok) {
    await logSecurityEvent({ eventType: 'processor_invocation_denied', fn: 'send-race-prep-whatsapp' });
    return denied(guard, corsHeaders);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { dateStr, dow } = fortalezaToday();
    console.log('[race-prep] Running for', dateStr, 'dow=', dow);

    const { data: races, error: racesErr } = await supabase
      .from('np_athlete_races')
      .select('id, client_id, user_id, race_name, race_date, race_distance_km')
      .eq('is_active', true)
      .gte('race_date', dateStr);

    if (racesErr) throw racesErr;
    if (!races || races.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    const results: any[] = [];

    for (const race of races) {
      const weeks = calcWeeks(race.race_date, dateStr);
      const days = calcDays(race.race_date, dateStr);
      const phase = calcPhase(weeks);
      const distanceKm = Number(race.race_distance_km || 0);

      // Buscar dados do atleta
      const { data: client } = await supabase
        .from('clients')
        .select('id, name, phone, is_active, is_frozen')
        .eq('id', race.client_id)
        .maybeSingle();

      if (!client || client.is_frozen || !client.is_active) continue;

      const events: { type: string; key: string; shouldFire: boolean; phaseLabel: string }[] = [];

      // 1) phase_taper_entry — primeira segunda na fase taper
      events.push({
        type: 'phase_taper_entry',
        key: `${race.race_date}`,
        shouldFire: phase === 'taper' && dow === 1,
        phaseLabel: 'Taper',
      });

      // 2) carboloading_start — 3 dias antes (apenas dist >= 21.1)
      events.push({
        type: 'carboloading_start',
        key: `${race.race_date}`,
        shouldFire: days === 3 && distanceKm >= 21,
        phaseLabel: 'Taper',
      });

      // 2b) protocol_7_days_pre_race — 7 dias antes
      events.push({
        type: 'protocol_7_days_pre_race',
        key: `${race.race_date}`,
        shouldFire: days === 7,
        phaseLabel: 'Taper',
      });

      // 3) gut_training_weekly — toda segunda em build/specific/peak
      events.push({
        type: 'gut_training_weekly',
        key: dateStr,
        shouldFire: dow === 1 && (phase === 'build' || phase === 'specific' || phase === 'peak'),
        phaseLabel:
          phase === 'build' ? 'Construção' : phase === 'specific' ? 'Específica' : 'Pico',
      });

      // 4) race_day
      events.push({
        type: 'race_day',
        key: race.race_date,
        shouldFire: days === 0,
        phaseLabel: 'Competição',
      });

      for (const ev of events) {
        if (!ev.shouldFire) continue;

        const templateKey = EVENT_TEMPLATE_MAP[ev.type];
        if (!templateKey) continue;

        // 1) Verificar se o template está ATIVO na Central de Mensagens
        const { data: tpl } = await supabase
          .from('whatsapp_templates')
          .select('body, is_active')
          .eq('user_id', race.user_id)
          .eq('template_key', templateKey)
          .maybeSingle();

        if (!tpl || tpl.is_active === false) {
          console.log('[race-prep] template inactive/missing:', templateKey, '— skipping');
          continue;
        }

        // 2) Verificar opt-out do atleta
        const { data: optOut } = await supabase
          .from('athlete_notification_settings')
          .select('disabled_all, disabled_template_keys')
          .eq('client_id', race.client_id)
          .maybeSingle();

        if (optOut?.disabled_all || optOut?.disabled_template_keys?.includes(templateKey)) {
          console.log('[race-prep] athlete opted out:', client.name, templateKey);
          continue;
        }

        // 3) Verificar idempotência
        const { data: already } = await supabase
          .from('np_event_dispatches')
          .select('id')
          .eq('client_id', race.client_id)
          .eq('race_id', race.id)
          .eq('event_type', ev.type)
          .eq('event_key', ev.key)
          .maybeSingle();
        if (already) continue;

        const dateBR = new Date(race.race_date + 'T00:00:00').toLocaleDateString('pt-BR');
        const message = renderTemplate(tpl.body, {
          nome: client.name,
          race_name: race.race_name || 'sua prova',
          race_date: dateBR,
          days_to_race: days,
          phase_label: ev.phaseLabel,
        });

        // Disparar via send-whatsapp existente
        const { error: sendErr } = await supabase.functions.invoke('send-whatsapp', {
          body: { clientId: race.client_id, message, templateKey },
        });

        // Registrar dispatch (mesmo se falhou, para evitar loop)
        await supabase.from('np_event_dispatches').insert({
          client_id: race.client_id,
          race_id: race.id,
          user_id: race.user_id,
          event_type: ev.type,
          event_key: ev.key,
          status: sendErr ? 'failed' : 'sent',
          error_message: sendErr ? String(sendErr.message || sendErr) : null,
        });

        processed += 1;
        results.push({ client: client.name, event: ev.type, ok: !sendErr });
        console.log('[race-prep]', client.name, ev.type, sendErr ? 'FAIL' : 'OK');
      }
    }

    return new Response(JSON.stringify({ success: true, processed, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[race-prep] error:', e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
