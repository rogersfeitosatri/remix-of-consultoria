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

    const insertPayload = {
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
