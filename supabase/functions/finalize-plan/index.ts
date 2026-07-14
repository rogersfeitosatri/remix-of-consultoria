// Finalização: monta os dias validados no formato do plano existente
// (meal_plan + day_variations) e grava em ai_analyses. Só conclui quando todos
// os dias têm cardápio validado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { WEEKDAYS } from "../_shared/planPipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function foodLine(food: any): string {
  const main = `${food.name}${food.grams ? ` - ${Math.round(Number(food.grams))}g` : ""}${food.household_measure ? ` (${food.household_measure})` : ""}`;
  const subs = (food.substitutes || []).map((s: any) => `${s.name}${s.grams ? ` - ${Math.round(Number(s.grams))}g` : ""}${s.household_measure ? ` (${s.household_measure})` : ""}`);
  return [main, ...subs].join(" ou ");
}

// Converte um menu do pipeline para o formato meal_plan da consultoria.
function menuToMealPlanDay(menu: any) {
  const meals = (menu?.meals || []).map((meal: any) => {
    // cada alimento vira um food_group (grupo = função nutricional) com suas substituições
    const food_groups = (meal.foods || []).map((f: any) => ({ group: f.group || "Alimento", options: foodLine(f) }));
    const mm = meal._macros || {};
    const meal_macros = mm.kcal != null ? `~${mm.kcal} kcal, CHO ${mm.cho_g}g, PTN ${mm.protein_g}g, GORD ${mm.fat_g}g` : "";
    return { meal_name: meal.meal_name || "Refeição", horario: meal.horario || "", timing_note: meal.function || meal.pre_intra_post || "", food_groups, meal_macros };
  });
  const t = menu?._totals || {};
  const daily_totals = { kcal: t.kcal ?? 0, cho_g: t.cho_g ?? 0, protein_g: t.protein_g ?? 0, fat_g: t.fat_g ?? 0, cho_gkg: 0, protein_gkg: 0, fat_gkg: 0, kcal_kg: 0 };
  return { meals, daily_totals };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { jobId } = await req.json();
    if (!jobId) throw new Error("jobId is required");

    const { data: job } = await supabase.from("plan_generation_jobs").select("*").eq("id", jobId).single();
    if (!job) throw new Error("Job não encontrado");
    const { data: days } = await supabase.from("plan_generation_days").select("*").eq("job_id", jobId);

    const byDay: Record<string, any> = {};
    for (const d of days || []) byDay[d.weekday] = d;

    // Só finaliza se TODOS os dias têm cardápio (completed ou correction_required).
    const notReady = WEEKDAYS.filter((wd) => {
      const d = byDay[wd];
      return !d || !d.menu_output || !["completed", "correction_required"].includes(d.status);
    });
    if (notReady.length) {
      return json({ ready: false, pending: notReady });
    }

    await supabase.from("plan_generation_jobs").update({ status: "validating", current_stage: "finalizando" }).eq("id", jobId);

    const blueprint = job.weekly_blueprint || {};
    const day_variations: Record<string, any> = {};
    for (const wd of WEEKDAYS) {
      const d = byDay[wd];
      const menu = { ...(d.menu_output || {}), _totals: d.validation_result?.totals };
      day_variations[wd] = menuToMealPlanDay(menu);
    }
    // Base = segunda-feira (fallback para dias sem variação específica)
    const base = day_variations["seg"] || Object.values(day_variations)[0];

    const strategic_orientations = {
      meal_routine: Object.entries(blueprint.days || {}).map(([wd, d]: any) =>
        `${wd.toUpperCase()}: ${d.demand || ""} — ${(d.windows || []).map((w: any) => `${w.name} ${w.cho_level}`).join(", ")}`),
      training_strategy: [],
      supplementation: [],
      race_context: blueprint.athlete_summary || "",
    };

    const full = {
      athlete_summary: blueprint.athlete_summary || "",
      carb_estimation: { current_cho_gkg: 0, classification: "Moderada", reasoning: "Gerado pelo pipeline em etapas." },
      carb_progression: {},
      meal_plan: { ...base, day_variations },
      strategic_orientations,
      alerts: blueprint.alerts || [],
      _isNewFormat: true,
      source: "pipeline",
      updated_at: new Date().toISOString(),
    };

    const { data: profile } = await supabase.from("athlete_profiles").select("id").eq("client_id", job.client_id).maybeSingle();
    const record = {
      client_id: job.client_id, athlete_profile_id: profile?.id ?? null,
      diagnosis: full.athlete_summary, energy_expenditure: { carb_estimation: full.carb_estimation, carb_progression: {} },
      caloric_deficit: { meal_plan: full.meal_plan }, macronutrients: { strategic_orientations }, alerts: full.alerts,
      raw_response: JSON.stringify(full), model_used: "pipeline", updated_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("ai_analyses").select("id").eq("client_id", job.client_id).maybeSingle();
    if (existing) await supabase.from("ai_analyses").update(record).eq("id", existing.id);
    else await supabase.from("ai_analyses").insert(record);

    const anyIssues = WEEKDAYS.some((wd) => byDay[wd].status === "correction_required");
    await supabase.from("plan_generation_jobs").update({
      status: anyIssues ? "partially_failed" : "completed", current_stage: "concluído",
    }).eq("id", jobId);

    return json({ ready: true, success: true, status: anyIssues ? "partially_failed" : "completed" });
  } catch (error) {
    console.error("finalize-plan:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
