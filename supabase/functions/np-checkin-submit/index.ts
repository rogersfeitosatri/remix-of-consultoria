// Public endpoint to submit Periodization check-in via token (no auth required)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      token,
      adherence_pct,
      gi_score,
      energy_score,
      sleep_score,
      weight_kg,
      weekly_mileage_km,
      long_run_completed,
      notes,
      symptoms,
      form_id,
      dynamic_responses,
    } = body || {};

    if (!token || typeof token !== "string") {
      return json({ error: "Token inválido." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve link context (also validates active + expiry)
    const { data: ctx, error: ctxErr } = await supabase
      .rpc("get_np_checkin_context", { p_token: token })
      .maybeSingle();

    if (ctxErr || !ctx) {
      console.error("ctx error", ctxErr);
      return json({ error: "Link inválido ou expirado." }, 400);
    }

    // Get current race phase from active race goal protocol (if any)
    let phase: string | null = null;
    let raceId: string | null = null;
    {
      const { data: race } = await supabase
        .from("np_athlete_races")
        .select("id")
        .eq("client_id", ctx.client_id)
        .eq("is_active", true)
        .maybeSingle();
      if (race?.id) {
        raceId = race.id;
        const { data: prot } = await supabase
          .from("np_phase_protocols")
          .select("phase_override")
          .eq("client_id", ctx.client_id)
          .maybeSingle();
        phase = prot?.phase_override ?? null;
      }
    }

    // Validate score ranges
    const clampInt = (v: any, min: number, max: number) => {
      const n = parseInt(String(v), 10);
      if (Number.isNaN(n)) return null;
      return Math.max(min, Math.min(max, n));
    };

    const insertPayload: any = {
      user_id: ctx.admin_user_id,
      client_id: ctx.client_id,
      link_id: ctx.link_id,
      race_id: raceId,
      phase,
      adherence_pct: adherence_pct != null ? clampInt(adherence_pct, 0, 100) : null,
      gi_score: gi_score != null ? clampInt(gi_score, 0, 10) : null,
      energy_score: energy_score != null ? clampInt(energy_score, 0, 10) : null,
      sleep_score: sleep_score != null ? clampInt(sleep_score, 0, 10) : null,
      weight_kg: weight_kg != null ? Number(weight_kg) : null,
      weekly_mileage_km: weekly_mileage_km != null ? Number(weekly_mileage_km) : null,
      long_run_completed: typeof long_run_completed === "boolean" ? long_run_completed : null,
      notes: notes ? String(notes).slice(0, 2000) : null,
      symptoms: Array.isArray(symptoms) ? symptoms.slice(0, 20) : [],
      dynamic_form_id: form_id || ctx.checkin_form_id || null,
      dynamic_responses:
        dynamic_responses && typeof dynamic_responses === "object" && !Array.isArray(dynamic_responses)
          ? dynamic_responses
          : {},
      submitted_at: new Date().toISOString(),
    };

    const { error: insErr } = await supabase
      .from("np_periodization_checkins")
      .insert(insertPayload);

    if (insErr) {
      console.error("insert error", insErr);
      return json({ error: "Erro ao salvar check-in." }, 500);
    }

    // Mark link used (single-use behavior; admin can regenerate)
    await supabase
      .from("np_periodization_checkin_links")
      .update({ used_at: new Date().toISOString(), active: false })
      .eq("id", ctx.link_id);

    // Notify admin via WhatsApp on EVERY check-in with system suggestion (advance/maintain/regress)
    try {
      const gi = insertPayload.gi_score;
      const adh = insertPayload.adherence_pct;
      const energy = insertPayload.energy_score;
      const sleep = insertPayload.sleep_score;

      // Fetch last 2 GI scores for suggestion (this one + previous)
      const { data: prevCheckins } = await supabase
        .from('np_periodization_checkins')
        .select('gi_score')
        .eq('client_id', ctx.client_id)
        .order('submitted_at', { ascending: false })
        .limit(2);
      const lastGI = prevCheckins?.[0]?.gi_score ?? gi;
      const prevGI = prevCheckins?.[1]?.gi_score ?? null;

      // Suggestion logic mirroring lib/nutriperiodiza.suggestProgression
      let suggestion = '➡️ Manter';
      let suggestionReason = 'Sintomas moderados ou histórico insuficiente.';
      const high = (lastGI != null && lastGI > 4) || (prevGI != null && prevGI > 4);
      const low = lastGI != null && lastGI <= 3 && prevGI != null && prevGI <= 3;
      if (high) {
        suggestion = '⬇️ Regredir';
        suggestionReason = `GI elevado (último: ${lastGI ?? '—'}/10). Reduzir taxa CHO em ~10 g/h.`;
      } else if (low) {
        suggestion = '⬆️ Avançar';
        suggestionReason = `GI baixo nos 2 últimos (${prevGI} e ${lastGI}). Avançar +10 g/h.`;
      }

      const adherenceTxt = adh != null ? `${adh}%` : '—';
      const energyTxt = energy != null ? `${energy}/10` : '—';
      const sleepTxt = sleep != null ? `${sleep}/10` : '—';
      const giTxt = gi != null ? `${gi}/10` : '—';
      const giAlert = gi != null && gi >= 7 ? '\n\n⚠️ *ATENÇÃO: GI alto — revisar protocolo de gut training.*' : '';

      const msg = `📋 *Novo check-in de Periodização*\n\nAtleta: *${ctx.client_name}*\nProva: ${ctx.race_name || '—'}\nFase atual: ${phase || '—'}\n\n• GI score: *${giTxt}*\n• Aderência: ${adherenceTxt}\n• Energia: ${energyTxt}\n• Sono: ${sleepTxt}\n\n*Sugestão do sistema:* ${suggestion}\n_${suggestionReason}_${giAlert}`;

      await supabase.functions.invoke('send-whatsapp', {
        body: { phone: '+5599984817697', message: msg },
      });
    } catch (alertErr) {
      console.error('Check-in notification dispatch failed', alertErr);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("np-checkin-submit fatal", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
