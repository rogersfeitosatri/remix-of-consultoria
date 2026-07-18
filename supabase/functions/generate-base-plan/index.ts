// v2: gera SOMENTE o plano-base (refeições uma única vez) em UMA chamada ao
// Gemini. O calendário/carbload/mapa semanal é calculado no frontend por código
// determinístico (src/lib/planV2.ts). Guarda em ai_analyses.raw_response com
// planModelVersion: 2. Não gera 7 dias.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiJson, loadFoodTable, matchFood, foodMacros } from "../_shared/planPipeline.ts";
import { loadMealPlanSkill, logGeneration } from "../_shared/skillPrompt.ts";

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

// Peso da anamnese (ANAMNESE COMPLETA: peso_altura.peso_kg; formulários antigos:
// pergunta de "peso atual"). Sobrepõe o valor possivelmente defasado do perfil.
function extractWeightKg(anamnese: any, questions: any[]): number | null {
  if (!anamnese?.responses) return null;
  const qs = questions || [];
  const q = qs.find((x: any) => /peso/i.test(x.question_text || "") && /atual/i.test(x.question_text || ""))
    || qs.find((x: any) => /peso e altura|peso.*altura/i.test(x.question_text || ""))
    || qs.find((x: any) => /peso/i.test(x.question_text || ""));
  if (!q) return null;
  let a: any = anamnese.responses[q.id];
  a = a && typeof a === "object" && "answer" in a ? a.answer : a;
  if (a && typeof a === "object") a = a.peso_kg ?? a.peso ?? a.weight_kg ?? a.current_weight;
  const n = Number(String(a ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isFinite(n) && n > 20 && n < 300 ? n : null;
}

function foodText(f: any): string {
  return `${f.name}${f.grams ? ` ${Math.round(Number(f.grams))}g` : ""}${f.measure ? ` (${f.measure})` : ""}`;
}
// Alimento estruturado (com macros por porção casadas no banco de alimentos),
// para o editor mostrar e recalcular. Sem match → macros 0 (nutri completa via IA/banco).
function structFood(f: any, table: any[]): any {
  const grams = Number(f.grams) || 0;
  const match = matchFood(f.name || "", table);
  const mm = match && grams ? foodMacros(grams, match) : null;
  return {
    name: f.name || "", grams: grams || null, measure: f.measure || null,
    food_item_id: match?.id ?? undefined,
    calories: mm ? Math.round(mm.kcal) : 0,
    protein_g: mm ? Math.round(mm.protein_g * 10) / 10 : 0,
    carbs_g: mm ? Math.round(mm.cho_g * 10) / 10 : 0,
    fat_g: mm ? Math.round(mm.fat_g * 10) / 10 : 0,
    nutrient_source: match ? "Banco" : undefined,
  };
}
// Classe do alimento pelo macro dominante (energia) — para casar substituições.
function foodClass(f: any): "carb" | "protein" | "fat" {
  const c = (Number(f.carbs_g) || 0) * 4, p = (Number(f.protein_g) || 0) * 4, fa = (Number(f.fat_g) || 0) * 9;
  if (c >= p && c >= fa) return "carb";
  if (p >= fa) return "protein";
  return "fat";
}
function subLabel(f: any): string {
  return `${f.name}${f.grams ? ` — ${Math.round(Number(f.grams))} g` : f.measure ? ` — ${f.measure}` : ""}`;
}
// Converte o plano-base v2 para v1. IMPORTANTE: as `substitutions` do v2 são
// TROCAS DE INGREDIENTE (arroz→macarrão, carne→frango) e NÃO refeições completas.
// Então montamos UMA opção completa (Opção 1) e embutimos cada substituição no
// alimento de mesma função nutricional (nunca criando "Opção 2" incompleta).
function mirrorToMealPlan(meals: any[], table: any[]): any[] {
  return (meals || []).map((m: any) => {
    const mainFoods = (m.mainOption?.foods || []).map((f: any) => structFood(f, table));
    // anexa substituições ao alimento principal de mesma classe (fallback: 1º)
    for (const sub of (m.substitutions || [])) {
      for (const sf of (sub.foods || [])) {
        const s = structFood(sf, table);
        const cls = foodClass(s);
        const target = mainFoods.find((mf: any) => foodClass(mf) === cls) || mainFoods[0];
        if (target) target.substitutions = [...(target.substitutions || []), subLabel(s)];
      }
    }
    const options = [{ label: "Opção 1", foods: mainFoods }];
    const mainTxt = mainFoods.map((f: any) => `${f.name}${f.grams ? ` ${f.grams}g` : ""}${(f.substitutions || []).length ? ` ou ${f.substitutions.join("; ")}` : ""}`).join(" + ");
    const mm = m.macros || {};
    return {
      meal_name: m.name, horario: m.defaultTime || "",
      timing_note: (m.generalInstructions || [])[0] || "",
      options, foods: mainFoods,
      food_groups: mainFoods.map((f: any) => ({ group: f.name, options: [`${f.name}${f.grams ? ` ${f.grams}g` : ""}`, ...(f.substitutions || [])].join(" ou ") })),
      meal_macros: mm.kcal != null ? `~${Math.round(mm.kcal)} kcal, CHO ${Math.round(mm.cho_g || 0)}g, PTN ${Math.round(mm.protein_g || 0)}g, LIP ${Math.round(mm.fat_g || 0)}g` : "",
    };
  });
}
// ---------- Encaixe determinístico por dia da semana (para o Zona Nutri) ----------
// Espelha a lógica de src/lib/planV2.ts (mapa semanal + carbload) para materializar
// meal_plan.day_variations (seg…dom). O ZN lê essas variações e envia o plano
// "encaixado" em cada dia. Só criamos variação para os dias que diferem da base;
// os demais caem na base automaticamente no envio.
const WEEKDAYS_EN = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const EN_TO_PT_KEY: Record<string, string> = {
  monday: "seg", tuesday: "ter", wednesday: "qua", thursday: "qui", friday: "sex", saturday: "sab", sunday: "dom",
};
const PT_LABEL: Record<string, string> = {
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo",
};
function prevWeekday(w: string, back: number): string {
  const i = WEEKDAYS_EN.indexOf(w as any);
  if (i < 0) return w;
  return WEEKDAYS_EN[(i - back + 7) % 7];
}
function carbloadDaysFor(longRunWeekday: string | null, numberOfDays: number): string[] {
  if (!longRunWeekday) return [];
  const n = numberOfDays >= 2 ? 2 : 1;
  const days: string[] = [];
  for (let k = 1; k <= n; k++) days.push(prevWeekday(longRunWeekday, k));
  return days.reverse();
}
function sessionsForWeekday(trainingWeek: any, wdEn: string): any[] {
  if (!trainingWeek || typeof trainingWeek !== "object") return [];
  const key = Object.keys(trainingWeek).find((k) => PT_TO_WEEKDAY[k.toLowerCase()] === wdEn);
  if (!key) return [];
  const s = trainingWeek[key];
  return Array.isArray(s) ? s : s ? [s] : [];
}
// Texto do carbBlock (reforço de carboidrato) para os dias de carbload.
function carbBlockText(carbBlocks: any[]): string {
  const b = (carbBlocks || [])[0];
  if (!b) return "";
  const opt = (b.options || [])[0];
  return (opt?.foods || []).map(foodText).join(" + ");
}
// Constrói meal_plan.day_variations só para os dias que diferem da base.
function buildDayVariations(basePlan: any, trainingWeek: any, longRunWeekday: string | null, dailyTotals: any, table: any[]): Record<string, any> {
  const baseMeals = mirrorToMealPlan(basePlan.meals, table);
  const carbSet = new Set(carbloadDaysFor(longRunWeekday, 1));
  const carbTxt = carbBlockText(basePlan.carbBlocks);
  const variations: Record<string, any> = {};
  for (const wdEn of WEEKDAYS_EN) {
    const sessions = sessionsForWeekday(trainingWeek, wdEn).filter((s: any) => s?.modalidade && s.modalidade !== "repouso");
    const isLongRun = wdEn === longRunWeekday || sessions.some((s: any) => s?.longao);
    const isCarbload = carbSet.has(wdEn);
    const isQuality = sessions.some((s: any) => /intenso/i.test(s?.intensidade || ""));
    if (!isLongRun && !isCarbload && !isQuality) continue; // dia-base → cai na base no envio

    let dayNote = "";
    if (isCarbload) dayNote = "Preparação para o longão: use a opção completa de carboidrato e evite alimentos novos.";
    else if (isLongRun) dayNote = "Dia de longão: capriche no carboidrato de fácil digestão antes do treino e recupere com CHO + proteína.";
    else if (isQuality) dayNote = "Treino de qualidade: priorize a opção completa de carboidrato para render bem.";

    const meals = baseMeals.map((m: any, i: number) => (i === 0 ? { ...m, timing_note: dayNote || m.timing_note } : { ...m }));
    if (isCarbload && carbTxt) {
      meals.push({
        meal_name: "Reforço de carboidrato (carbload)", horario: "", timing_note: "Bloco adicional nos dias de preparação para o longão.",
        food_groups: [{ group: "Carbload", options: carbTxt }], meal_macros: "",
      });
    }
    const key = EN_TO_PT_KEY[wdEn];
    variations[key] = { label: PT_LABEL[key], meals, daily_totals: dailyTotals || {} };
  }
  return variations;
}

// Fallback determinístico: estrutura mínima segura, marcada para revisão.
function fallbackBasePlan(): any {
  const meal = (id: string, name: string, time: string) => ({
    id, name, defaultTime: time,
    mainOption: { foods: [] }, substitutions: [], generalInstructions: ["Preencher com o nutricionista."], macros: {},
  });
  return {
    athlete_summary: "Plano-base em modo de segurança (IA indisponível). Preencha as refeições e regenere quando possível.",
    alerts: [], dailyTargets: {},
    meals: [meal("breakfast", "Café da manhã", "07:00"), meal("lunch", "Almoço", "12:00"), meal("afternoon_snack", "Lanche da tarde", "16:00"), meal("dinner", "Jantar", "20:00")],
    carbBlocks: [], generalInstructions: [],
  };
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
    const weightKg = extractWeightKg(anamnese, questions) ?? profile?.weight_kg ?? profile?.current_weight ?? client.current_weight ?? null;
    // Resumo textual da semana de treino (dia: sessões) para a IA periodizar.
    const trainingSummary = trainingWeek && typeof trainingWeek === "object"
      ? Object.entries(trainingWeek as Record<string, any>).map(([dia, sess]) => {
          const arr = Array.isArray(sess) ? sess : sess ? [sess] : [];
          const parts = arr.filter((s: any) => s?.modalidade && s.modalidade !== "repouso")
            .map((s: any) => `${s.modalidade}${s.turno ? " " + s.turno : ""}${s.intensidade ? " " + s.intensidade : ""}${s.longao ? " (LONGÃO)" : ""}`);
          return parts.length ? `- ${dia}: ${parts.join(" + ")}` : `- ${dia}: descanso`;
        }).join("\n")
      : "";

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

    // Prompt efetivo da habilidade "Plano alimentar": prompt ativo + módulos
    // obrigatórios ATIVOS (nunca o de PDF). A geração é registrada no fim.
    const skill = await loadMealPlanSkill(supabase, client.user_id, "Você é um nutricionista esportivo de endurance. Gere um plano ÚNICO e prático (não gere 7 dias).");
    const systemPrompt = skill.effectivePrompt;

    const guidance = adminGuidance && typeof adminGuidance === "object"
      ? Object.entries(adminGuidance).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("; ") : "";

    const userPrompt = `Gere APENAS o PLANO-BASE (um único conjunto de refeições, NÃO gere 7 dias diferentes). As variações por dia de treino são aplicadas depois pelo sistema.

## ATLETA
Nome: ${profile?.full_name || client.name} | Peso: ${weightKg || "N/I"} kg
Objetivo: ${profile?.main_goal || profile?.goal || client.goal || "N/I"}
Prova-alvo: ${profile?.target_race || client.target_race || "N/I"} ${profile?.target_deadline ? "(data " + profile.target_deadline + ")" : ""}
Dia do longão: ${longRunWeekday || "N/I"}
${guidance ? "Orientações do nutricionista: " + guidance : ""}

## ROTINA SEMANAL DE TREINO (para periodizar carboidratos e definir kcal/kg pela Skill)
${trainingSummary || "N/I"}

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

    // Observabilidade
    const t0 = Date.now();
    let usedFallback = false;
    let result: any = null;
    let provider = "-", model = "-";
    try {
      const r = await callAiJson({ systemPrompt, userPrompt, perAttemptMs: 60_000 });
      result = r.data; provider = r.provider; model = r.model;
    } catch (e) {
      console.warn("generate-base-plan: IA falhou, usando fallback determinístico:", (e as Error).message);
    }
    if (!Array.isArray(result?.meals) || !result.meals.length) {
      // Fallback determinístico: estrutura-base segura, marcada para revisão.
      usedFallback = true;
      result = fallbackBasePlan();
    }
    console.log("generate-base-plan obs:", JSON.stringify({
      clientId, provider, model, usedFallback, durationMs: Date.now() - t0,
      inputChars: userPrompt.length, mealsOut: result?.meals?.length ?? 0,
    }));

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
    // Espelha o plano-base no formato v1 (meal_plan.meals) para o app do atleta,
    // o envio ao Zona Nutri e telas legadas renderizarem sem mudança.
    // Banco de alimentos para casar macros por porção (editor mostra e recalcula).
    const foodTable = await loadFoodTable(supabase);
    const mealPlanMeals = mirrorToMealPlan(basePlan.meals, foodTable);
    // Encaixa o plano em cada dia da semana (carbload/longão/qualidade) para que o
    // envio ao Zona Nutri vá per_day. Dias sem diferença caem na base no envio.
    const dayVariations = buildDayVariations(basePlan, trainingWeek, longRunWeekday, basePlan.dailyTargets, foodTable);

    const stored = {
      planModelVersion: 2, status: usedFallback ? "requires_review" : "active",
      basePlan,
      inputs: { longRunWeekday, trainingWeek, raceDate: profile?.target_deadline || client.target_deadline || null },
      athlete_summary: result.athlete_summary || "",
      alerts: [...(result.alerts || []), ...(usedFallback ? ["Plano-base gerado em modo de segurança (IA indisponível) — revise antes de enviar."] : [])],
      planVersionNumber: (existing?.planVersionNumber || 0) + 1,
      generatedAt: new Date().toISOString(),
      meal_plan: { meals: mealPlanMeals, daily_totals: basePlan.dailyTargets || {}, day_variations: dayVariations },
      _isNewFormat: true,
    };

    const record = {
      client_id: clientId, athlete_profile_id: profile?.id ?? null,
      diagnosis: stored.athlete_summary, alerts: stored.alerts,
      raw_response: JSON.stringify(stored), model_used: `v2-base/${model}`, updated_at: new Date().toISOString(),
      energy_expenditure: {} as any, macronutrients: {} as any, caloric_deficit: { meal_plan: stored.meal_plan } as any,
    };
    if (existingRow) await supabase.from("ai_analyses").update(record).eq("id", existingRow.id);
    else await supabase.from("ai_analyses").insert(record);

    // Registra a versão exata do prompt/módulos usada nesta geração.
    await logGeneration(supabase, {
      ownerUserId: client.user_id, clientId, skill, model: `v2-base/${model}`,
      meta: { usedFallback, provider, planVersionNumber: stored.planVersionNumber, includedModules: skill.includedModuleKeys },
    });

    return json({ success: true, planModelVersion: 2, longRunWeekday, status: stored.status, usedFallback, promptVersion: skill.promptVersion, includedModules: skill.includedModuleKeys });
  } catch (error) {
    console.error("generate-base-plan:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
