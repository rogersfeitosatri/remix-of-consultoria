// ETAPA 2 + 3: gera UM dia do plano e valida deterministicamente (macros pelo
// código, a partir do banco de alimentos). Failover com timeout curto por
// tentativa. Persiste imediatamente em plan_generation_days.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiJson, loadFoodTable, matchFood, foodMacros, addMacros, zeroMacros, roundMacros, resolveMissingFoods, WEEKDAY_LABEL, type FoodRow, type Macros } from "../_shared/planPipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Valida o dia de forma determinística usando os macros calculados pelo código.
function validateDay(menu: any, target: any, table: FoodRow[]) {
  const issues: string[] = [];
  let dayTotals: Macros = zeroMacros();
  const meals = Array.isArray(menu?.meals) ? menu.meals : [];

  for (const meal of meals) {
    let mealMacros = zeroMacros();
    for (const food of (meal.foods || [])) {
      const m = matchFood(food.name || "", table);
      if (m) {
        food.food_id = m.id;
        const fm = foodMacros(Number(food.grams) || 0, m);
        food._macros = roundMacros(fm);
        mealMacros = addMacros(mealMacros, fm);
      } else {
        food.food_id = null;
        food._unmatched = true; // não encontrado no banco → não soma
      }
    }
    meal._macros = roundMacros(mealMacros);
    dayTotals = addMacros(dayTotals, mealMacros);
    // proteína por refeição principal (heurística: refeições com >150 kcal)
    if (mealMacros.kcal > 150 && mealMacros.protein_g < 10) {
      issues.push(`Refeição "${meal.meal_name}" com pouca proteína (${Math.round(mealMacros.protein_g)}g).`);
    }
  }

  const totals = roundMacros(dayTotals);
  // tolerância vs alvo diário (±15% kcal, ±20% CHO)
  const t = target?.daily_targets || {};
  const within = (val: number, tgt: number, pct: number) => !tgt || Math.abs(val - tgt) <= tgt * pct;
  if (t.kcal && !within(totals.kcal, t.kcal, 0.15)) issues.push(`Energia ${totals.kcal} kcal fora do alvo (${t.kcal} kcal ±15%).`);
  if (t.cho_g && !within(totals.cho_g, t.cho_g, 0.20)) issues.push(`Carboidrato ${totals.cho_g}g fora do alvo (${t.cho_g}g ±20%).`);
  if (t.protein_g && totals.protein_g < t.protein_g * 0.8) issues.push(`Proteína total ${totals.protein_g}g abaixo do alvo (${t.protein_g}g).`);
  if (t.fat_g && totals.fat_g < t.fat_g * 0.5) issues.push(`Gordura total ${totals.fat_g}g muito baixa.`);
  const unmatched = meals.flatMap((m: any) => (m.foods || []).filter((f: any) => f._unmatched).map((f: any) => f.name));
  if (unmatched.length) issues.push(`Alimentos sem correspondência no banco (não contabilizados): ${unmatched.slice(0, 6).join(", ")}.`);

  return { ok: issues.length === 0, totals, issues, menu };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let dayRowId: string | null = null;
  try {
    const { jobId, weekday } = await req.json();
    if (!jobId || !weekday) throw new Error("jobId e weekday são obrigatórios");

    const { data: job } = await supabase.from("plan_generation_jobs").select("*").eq("id", jobId).single();
    if (!job) throw new Error("Job não encontrado");
    const { data: dayRow } = await supabase.from("plan_generation_days").select("*").eq("job_id", jobId).eq("weekday", weekday).single();
    if (!dayRow) throw new Error("Dia não encontrado");
    dayRowId = dayRow.id;

    await supabase.from("plan_generation_days").update({ status: "generating", attempts: (dayRow.attempts || 0) + 1 }).eq("id", dayRow.id);

    const { data: client } = await supabase.from("clients").select("*").eq("id", job.client_id).single();
    const blueprint = job.weekly_blueprint || {};
    const dayBp = blueprint.days?.[weekday] || dayRow.strategy_input || {};
    const order = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
    const idx = order.indexOf(weekday);
    const prevBp = idx > 0 ? blueprint.days?.[order[idx - 1]] : null;
    const nextBp = idx < 6 ? blueprint.days?.[order[idx + 1]] : null;

    // Banco de alimentos permitido (lista compacta para o modelo escolher)
    const table = await loadFoodTable(supabase);
    const foodList = table.slice(0, 400).map((f) => f.name).join(", ");

    let systemPrompt = "Você é um nutricionista esportivo. Monte cardápios práticos com alimentos comuns no Brasil, respeitando as regras de periodização.";
    try {
      const { data: cp } = await supabase.from("ai_prompts").select("prompt_text").eq("user_id", job.user_id).eq("context_key", "meal_plan_generation").maybeSingle();
      if (cp?.prompt_text?.trim()) systemPrompt = cp.prompt_text.trim();
    } catch { /* default */ }

    const buildPrompt = (correction?: string[]) => `Gere o CARDÁPIO de UM ÚNICO DIA (${WEEKDAY_LABEL[weekday]}). Não gere outros dias.

BLUEPRINT DO DIA (siga as metas e níveis BAIXO/MÉDIO/ALTO):
${JSON.stringify(dayBp)}

CONTEXTO — dia anterior: ${prevBp ? JSON.stringify({ demand: prevBp.demand, next_day_prep: prevBp.next_day_prep }) : "N/I"}
CONTEXTO — dia seguinte: ${nextBp ? JSON.stringify({ demand: nextBp.demand, training_summary: nextBp.training_summary }) : "N/I"}

ALIMENTOS PERMITIDOS (use PREFERENCIALMENTE nomes desta lista, para bater com o banco):
${foodList}

${correction && correction.length ? `CORREÇÃO NECESSÁRIA (ajuste APENAS o que resolve estes problemas, mantendo o resto):\n- ${correction.join("\n- ")}\n` : ""}
Retorne SOMENTE um JSON deste dia:
{
  "weekday": "${weekday}",
  "meals": [
    {
      "meal_name": string, "horario": string, "function": string,
      "foods": [ { "name": string, "grams": number, "household_measure": string, "group": "Carboidrato"|"Proteína"|"Gordura"|"Fruta"|"Vegetal"|"Outro",
                   "substitutes": [ { "name": string, "grams": number, "household_measure": string } ] } ],
      "pre_intra_post": string
    }
  ],
  "notes": string
}
Use as quantidades em GRAMAS coerentes com as metas do blueprint. Substituições dentro do mesmo grupo funcional. Não repita listas enormes: 1–3 substitutos por alimento.`;

    // 1ª (e única) geração do dia
    const genRes = await callAiJson({ systemPrompt, userPrompt: buildPrompt(), perAttemptMs: 50_000 });

    // Alimentos fora do banco: busca macros via IA e SALVA em food_items (para
    // os próximos planos). Assim os macros ficam determinísticos e o banco cresce.
    await supabase.from("plan_generation_days").update({ status: "validating" }).eq("id", dayRow.id);
    const names: string[] = [];
    for (const meal of (genRes.data?.meals || [])) {
      for (const f of (meal.foods || [])) {
        if (f?.name) names.push(f.name);
        for (const s of (f.substitutes || [])) if (s?.name) names.push(s.name);
      }
    }
    try { await resolveMissingFoods(supabase, names, table, job.user_id); } catch { /* segue com o que tem */ }

    // Validação DETERMINÍSTICA (advisory): calcula macros e lista pendências,
    // mas NÃO reprova o dia — o nutricionista revisa/edita depois.
    const validation = validateDay(genRes.data, dayBp, table);
    const finalStatus = validation.issues.length ? "correction_required" : "completed";
    await supabase.from("plan_generation_days").update({
      status: finalStatus, menu_output: validation.menu, validation_result: { totals: validation.totals, issues: validation.issues, ok: validation.ok },
      error: null,
    }).eq("id", dayRow.id);

    // Atualiza contador do job
    const { count } = await supabase.from("plan_generation_days").select("id", { count: "exact", head: true })
      .eq("job_id", jobId).in("status", ["completed", "correction_required"]);
    await supabase.from("plan_generation_jobs").update({ completed_days: count ?? 0 }).eq("id", jobId);

    return json({ success: true, weekday, status: finalStatus, validation: { totals: validation.totals, issues: validation.issues } });
  } catch (error) {
    console.error("generate-plan-day:", error);
    if (dayRowId) {
      await supabase.from("plan_generation_days").update({ status: "failed", error: error instanceof Error ? error.message : String(error) }).eq("id", dayRowId);
    }
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
