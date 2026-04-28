// NutriPeriodiza — Cron diário (10:00 América/Fortaleza) que dispara WhatsApp
// para 4 eventos relevantes da preparação de prova:
//  1) phase_taper_entry: na primeira segunda em que weeks_to_race <= 3
//  2) carboloading_start: 3 dias antes da prova (se distância >= 21k)
//  3) gut_training_weekly: toda segunda nas fases build/specific/peak
//  4) race_day: no dia da prova
//
// Idempotente via tabela np_event_dispatches (UNIQUE em client_id, race_id, event_type, event_key).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function buildMessage(eventType: string, ctx: {
  athleteName: string;
  raceName: string;
  raceDate: string;
  daysToRace: number;
  distanceKm: number;
  phaseLabel: string;
}): string {
  const dateBR = new Date(ctx.raceDate + 'T00:00:00').toLocaleDateString('pt-BR');
  switch (eventType) {
    case 'phase_taper_entry':
      return `🪶 *${ctx.athleteName}*, você entrou na fase TAPER da preparação para *${ctx.raceName}* (${dateBR}).\n\nHora de polir: reduzir volume, manter intensidade curta e iniciar o protocolo de carbo-loading conforme combinado. Sem testar nada novo a partir de agora!`;
    case 'carboloading_start':
      return `🍝 *${ctx.athleteName}*, faltam *${ctx.daysToRace} dias* para *${ctx.raceName}*. É hora de começar o *carbo-loading*!\n\nSiga o protocolo definido (carboidrato alto, fibra reduzida, hidratação caprichada). Em caso de dúvida, fale comigo.`;
    case 'gut_training_weekly':
      return `🦠 Bom dia, *${ctx.athleteName}*! Lembrete da semana: rodar o *treino intestinal* nos longos da fase ${ctx.phaseLabel}.\n\nNão esqueça de registrar a taxa de CHO (g/h) e os sintomas após o treino para ajustarmos a progressão.`;
    case 'race_day':
      return `🏁 É HOJE, *${ctx.athleteName}*! Sua prova: *${ctx.raceName}*.\n\nProtocolo race-day já testado: respeite o pré, intra e a hidratação. Boa prova! Estarei na torcida 🚀`;
    default:
      return `Lembrete da preparação para ${ctx.raceName}.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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

        // Verificar idempotência
        const { data: already } = await supabase
          .from('np_event_dispatches')
          .select('id')
          .eq('client_id', race.client_id)
          .eq('race_id', race.id)
          .eq('event_type', ev.type)
          .eq('event_key', ev.key)
          .maybeSingle();
        if (already) continue;

        const message = buildMessage(ev.type, {
          athleteName: client.name,
          raceName: race.race_name || 'sua prova',
          raceDate: race.race_date,
          daysToRace: days,
          distanceKm,
          phaseLabel: ev.phaseLabel,
        });

        // Disparar via send-whatsapp existente
        const { error: sendErr } = await supabase.functions.invoke('send-whatsapp', {
          body: { clientId: race.client_id, message },
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
