// v2: gera SOMENTE o plano-base (refeições uma única vez) em UMA chamada ao
// Gemini. O calendário/carbload/mapa semanal é calculado no frontend por código
// determinístico (src/lib/planV2.ts). Guarda em ai_analyses.raw_response com
// planModelVersion: 2. Não gera 7 dias.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiJson } from "../_shared/planPipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const PT_TO_WEEKDAY: Record<string, string> = {
  "segunda": "monday", "terça": "tuesday", "terca": "tuesday", "quarta": "wednesday",
  "quinta": "thursday", "sexta": "friday", "sábado": "saturday", "sabado": "saturday", "domingo": "sunday",
};

// Extrai a resposta de "training_week" da anamnese e o dia do longão.
function extractTraining(anamnese: any, questions: any[]): { trainingWeek: any; longRunWeekday: string | null } {
  if (!anamnese?.responses) return { trainingWeek: null, longRunWeekday: null };
  const q = (questions || []).find((x) =>
    x.question_type === "training_week" || /frequ[êe]ncia semanal|treino semanal|rotina de treino/i.test(x.question_text || ""));
  if (!q) return { trainingWeek: null, longRunWeekday: null };
  const resp = anamnese.responses[q.id];
  const tw = resp && typeof resp === "object" && "answer" in resp ? resp.answer : resp;
  if (!tw || typeof tw !== "object") return { trainingWeek: null, longRunWeekday: null };
  let longRun: string | null = null;
  for (const [ptDay, sessions] of Object.entries<any>(tw)) {
    const arr = Array.isArray(sessions) ? sessions : [sessions];
    if (arr.some((s: any) => s?.longao)) { longRun = PT_TO_WEEKDAY[ptDay.toLowerCase()] || null; break; }
  }
  return { trainingWeek: tw, longRunWeekday: longRun };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { clientId, adminGuidance } = await req.json();
    if (!clientId) throw new Error("clientId is required");

    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Error("Cliente não encontrado");
    const { data: profile } = await supabase.from("athlete_profiles").select("*").eq("client_id", clientId).maybeSingle();

    // Idempotência simples: não regenerar se já está gerando.
    const { data: existingRow } = await supabase.from("ai_analyses").select("id, raw_response").eq("client_id", clientId).maybeSingle();
    let existing: any = null;
    try { existing = existingRow?.raw_response ? JSON.parse(existingRow.raw_response) : null; } catch { /* */ }
    if (existing?.status === "generating") return json({ error: "Geração já em andamento." }, 409);

    const { data: anamnese } = await supabase
      .from("anamnese_responses").select("*, anamnese_forms!inner (user_id)")
      .eq("client_id", clientId).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    let questions: any[] = [];
    if (anamnese?.form_id) {
      const { data: qs } = await supabase.from("anamnese_questions").select("id, question_text, question_type, section").eq("form_id", anamnese.form_id);
      questions = qs || [];
    }
    const { trainingWeek, longRunWeekday } = extractTraining(anamnese, questions);

    // Contexto compacto da anamnese (hábitos/preferências) — texto curto.
    let anamneseText = "";
    if (anamnese?.responses) {
      const lines: string[] = [];
      for (const q of questions) {
        const r = anamnese.responses[q.id];
        if (r == null) continue;
        const a = r && typeof r === "object" && "answer" in r ? r.answer : r;
        const txt = typeof a === "object" ? JSON.stringify(a).slice(0, 300) : String(a);
        lines.push(`- ${q.question_text}: ${txt}`);
      }
      anamneseText = lines.join("\n").slice(0, 6000);
    }

    let systemPrompt = "Você é um nutricionista esportivo de endurance. Gere um plano ÚNICO e prático (não gere 7 dias).";
    try {
      const { data: cp } = await supabase.from("ai_prompts").select("prompt_text").eq("user_id", client.user_id).eq("context_key", "meal_plan_generation").maybeSingle();
      if (cp?.prompt_text?.trim()) systemPrompt = cp.prompt_text.trim();
    } catch { /* default */ }

    const guidance = adminGuidance && typeof adminGuidance === "object"
      ? Object.entries(adminGuidance).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("; ") : "";

    const userPrompt = `Gere APENAS o PLANO-BASE (um único conjunto de refeições, NÃO gere 7 dias diferentes). As variações por dia de treino são aplicadas depois pelo sistema.

## ATLETA
Nome: ${profile?.full_name || client.name} | Peso: ${profile?.weight_kg || profile?.current_weight || client.current_weight || "N/I"} kg
Objetivo: ${profile?.main_goal || profile?.goal || client.goal || "N/I"}
Prova-alvo: ${profile?.target_race || client.target_race || "N/I"} ${profile?.target_deadline ? "(data " + profile.target_deadline + ")" : ""}
${guidance ? "Orientações do nutricionista: " + guidance : ""}

## ANAMNESE (hábitos, preferências, restrições)
${anamneseText || "N/I"}

## SAÍDA (JSON, apenas o plano-base)
{
  "athlete_summary": string,
  "alerts": string[],
  "dailyTargets": { "kcal": number, "cho_g": number, "protein_g": number, "fat_g": number },
  "meals": [
    { "id": "breakfast"|"morning_snack"|"lunch"|"afternoon_snack"|"dinner"|"supper",
      "name": string, "defaultTime": "HH:MM",
      "mainOption": { "foods": [ { "name": string, "grams": number, "measure": string } ] },
      "substitutions": [ { "label": string, "foods": [ { "name": string, "grams": number, "measure": string } ] } ],
      "generalInstructions": string[],
      "macros": { "kcal": number, "cho_g": number, "protein_g": number, "fat_g": number } }
  ],
  "carbBlocks": [ { "id": "CARB_BLOCK_01", "label": string, "options": [ { "foods": [ { "name": string, "grams": number, "measure": string } ] } ] } ],
  "generalInstructions": string[]
}
Regras: cada refeição aparece UMA vez, com id único. Use alimentos que o atleta já consome. Substituições dentro do mesmo grupo. Crie 1–2 carbBlocks reutilizáveis para reforço de carboidrato. Não escreva orientações por dia da semana.`;

    // Marca "generating"
    const genStub = { planModelVersion: 2, status: "generating", updatedAt: new Date().toISOString() };
    if (existingRow) await supabase.from("ai_analyses").update({ raw_response: JSON.stringify({ ...(existing || {}), ...genStub }) }).eq("id", existingRow.id);

    let result: any;
    try {
      const r = await callAiJson({ systemPrompt, userPrompt, perAttemptMs: 60_000 });
      result = r.data;
    } catch (e) {
      return json({ error: (e as Error).message }, 502);
    }
    if (!Array.isArray(result?.meals) || !result.meals.length) throw new Error("A IA não retornou o plano-base.");

    // Garante ids únicos
    const seen = new Set<string>();
    result.meals.forEach((m: any, i: number) => {
      if (!m.id || seen.has(m.id)) m.id = `meal_${i + 1}`;
      seen.add(m.id);
    });

    const basePlan = {
      planVersion: 2, athleteId: clientId, generatedAt: new Date().toISOString(),
      meals: result.meals, carbBlocks: result.carbBlocks || [], generalInstructions: result.generalInstructions || [],
      dailyTargets: result.dailyTargets || null,
    };
    const stored = {
      planModelVersion: 2, status: "active",
      basePlan,
      inputs: { longRunWeekday, trainingWeek, raceDate: profile?.target_deadline || client.target_deadline || null },
      athlete_summary: result.athlete_summary || "",
      alerts: result.alerts || [],
      generatedAt: new Date().toISOString(),
      // compat com telas antigas que leem meal_plan.meals: espelha o base como meal_plan
      meal_plan: { meals: [], daily_totals: basePlan.dailyTargets || {} },
      _isNewFormat: true,
    };

    const record = {
      client_id: clientId, athlete_profile_id: profile?.id ?? null,
      diagnosis: stored.athlete_summary, alerts: stored.alerts,
      raw_response: JSON.stringify(stored), model_used: "v2-base", updated_at: new Date().toISOString(),
      energy_expenditure: {} as any, macronutrients: {} as any, caloric_deficit: { meal_plan: stored.meal_plan } as any,
    };
    if (existingRow) await supabase.from("ai_analyses").update(record).eq("id", existingRow.id);
    else await supabase.from("ai_analyses").insert(record);

    return json({ success: true, planModelVersion: 2, longRunWeekday });
  } catch (error) {
    console.error("generate-base-plan:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
