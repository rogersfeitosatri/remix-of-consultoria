// ETAPA 1 do pipeline: gera o BLUEPRINT SEMANAL (sem alimentos/cardápio).
// Cria o job, salva o blueprint e semeia os 7 dias (status pending).
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiJson, WEEKDAYS, WEEKDAY_LABEL } from "../_shared/planPipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
function fmtAnswer(a: any): string {
  if (a == null || a === "") return "—";
  if (Array.isArray(a)) return a.map(fmtAnswer).join(", ");
  if (typeof a !== "object") return String(a);
  if (DIAS.some((d) => d in a)) {
    return DIAS.map((d) => {
      const ss = a[d];
      if (!Array.isArray(ss) || !ss.length) return null;
      const desc = ss.filter((s: any) => s?.modalidade).map((s: any) =>
        s.modalidade === "repouso" ? "repouso" : [s.modalidade, s.turno, s.intensidade].filter(Boolean).join(" ") + (s.longao ? " (LONGÃO)" : "")).join(" + ");
      return desc ? `${d}: ${desc}` : null;
    }).filter(Boolean).join(" | ") || "sem treinos";
  }
  if ("itens" in a || "bebidas" in a) {
    const itens = Array.isArray(a.itens) ? a.itens.map((s: any) => Array.isArray(s) ? s.filter(Boolean).join(" ou ") : s).filter(Boolean).join("; ") : "";
    return `${a.horario ? a.horario + " — " : ""}${itens}${a.bebidas ? " | Bebidas: " + a.bebidas : ""}`.trim() || "—";
  }
  const vals = Object.values(a);
  if (vals.length && vals.every((v) => typeof v === "number")) return Object.entries(a).map(([k, v]) => `${k}: ${v}/5`).join(", ");
  try { return JSON.stringify(a); } catch { return String(a); }
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

    const { data: anamnese } = await supabase
      .from("anamnese_responses").select("*, anamnese_forms!inner (title, user_id)")
      .eq("client_id", clientId).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    let qById: Record<string, { text: string; section: string }> = {};
    if (anamnese?.form_id) {
      const { data: qs } = await supabase.from("anamnese_questions").select("id, question_text, section").eq("form_id", anamnese.form_id);
      for (const q of qs || []) qById[q.id] = { text: q.question_text, section: q.section || "Geral" };
    }
    let anamneseText = "";
    if (anamnese?.responses) {
      const bySec: Record<string, string[]> = {};
      for (const [qid, resp] of Object.entries<any>(anamnese.responses)) {
        const q = qById[qid]; if (!q) continue;
        const ans = resp && typeof resp === "object" && "answer" in resp ? resp.answer : resp;
        (bySec[q.section] ||= []).push(`- ${q.text}: ${fmtAnswer(ans)}`);
      }
      anamneseText = Object.entries(bySec).map(([s, l]) => `**${s}**\n${l.join("\n")}`).join("\n\n");
    }

    const targetRace = (profile as any)?.target_race || (client as any)?.target_race || null;
    const targetDeadline = (profile as any)?.target_deadline || (client as any)?.target_deadline || null;

    // Prompt da central de IA (regras nutricionais intactas)
    let systemPrompt = "Você é um nutricionista esportivo especialista em atletas de endurance. Aplique as regras de periodização (Fuel for the Work Required).";
    try {
      const { data: cp } = await supabase.from("ai_prompts").select("prompt_text").eq("user_id", client.user_id).eq("context_key", "meal_plan_generation").maybeSingle();
      if (cp?.prompt_text?.trim()) systemPrompt = cp.prompt_text.trim();
    } catch { /* default */ }

    const guidanceLines: string[] = [];
    let referenceDietText = "";
    let referenceDietSource = "";
    if (adminGuidance && typeof adminGuidance === "object") {
      const g = adminGuidance;
      if (g.meals_count) guidanceLines.push(`Número de refeições: ${g.meals_count}`);
      if (g.target_kcal) guidanceLines.push(`Meta calórica: ${g.target_kcal} kcal`);
      if (g.target_cho_gkg) guidanceLines.push(`Meta CHO: ${g.target_cho_gkg} g/kg`);
      if (g.custom_instructions) guidanceLines.push(`Instruções: ${g.custom_instructions}`);
      if (typeof g.reference_diet_text === "string" && g.reference_diet_text.trim()) {
        referenceDietText = g.reference_diet_text.trim().slice(0, 18000);
        referenceDietSource = g.reference_diet_source || "PDF de referência";
      }
    }

    const referenceBlock = referenceDietText
      ? `\n## DIETA DE REFERÊNCIA (${referenceDietSource})\nO nutricionista anexou uma dieta em PDF. USE-A como referência forte para: número/nomes/horários das refeições, preferências e restrições, alimentos habituais e tamanhos de porção. Ajuste apenas o que a periodização exigir (D0..D4, janelas em torno do treino, metas semanais).\n"""\n${referenceDietText}\n"""\n`
      : "";


    const userPrompt = `Construa APENAS o BLUEPRINT SEMANAL de periodização nutricional (NÃO gere alimentos, cardápio nem quantidades nesta etapa).

## DADOS DO ATLETA
Nome: ${profile?.full_name || client.name}
Sexo: ${profile?.gender || "N/I"} | Nascimento: ${profile?.birth_date || "N/I"}
Peso: ${profile?.weight_kg || profile?.current_weight || client.current_weight || "N/I"} kg | Altura: ${profile?.height_cm || "N/I"} cm
Objetivo: ${profile?.main_goal || profile?.goal || client.goal || "N/I"}
Prova-alvo: ${targetRace || "N/I"}${targetDeadline ? ` (data ${targetDeadline})` : ""}
${guidanceLines.length ? "Orientações do nutricionista: " + guidanceLines.join("; ") : ""}

## ANAMNESE (consumo atual, rotina, treinos, preferências, restrições)
${anamneseText || "Sem anamnese estruturada."}
${referenceBlock}


## TAREFA
Analise a rotina semanal de treinos (modalidade, duração, intensidade, turno, sessão anterior/seguinte), o consumo atual e o objetivo. Retorne SOMENTE um JSON:
{
  "athlete_summary": string,           // resumo objetivo (baseline de consumo atual, objetivo, fase, prova)
  "alerts": string[],
  "days": {
    "seg": {
      "training_summary": string,      // treino(s) e horário do dia
      "demand": "D0"|"D1"|"D2"|"D3"|"D4",
      "daily_targets": { "kcal": number, "cho_g": number, "cho_gkg": number, "protein_g": number, "fat_g": number },
      "windows": [ { "name": string, "time": string, "cho_level": "BAIXO"|"MEDIO"|"ALTO", "function": string, "protein_target_g": number } ],
      "previous_day_effect": string,   // como o dia anterior afeta este
      "next_day_prep": string          // como este dia prepara o seguinte
    },
    "ter": {...}, "qua": {...}, "qui": {...}, "sex": {...}, "sab": {...}, "dom": {...}
  }
}
Inclua os 7 dias (seg..dom). Preserve a lógica entre dias consecutivos (a noite de hoje pode abastecer o treino de amanhã cedo). NÃO inclua alimentos.`;

    // Cria o job
    const { data: job, error: jobErr } = await supabase.from("plan_generation_jobs").insert({
      user_id: client.user_id, client_id: clientId, status: "generating_blueprint",
      current_stage: "criando estratégia semanal", admin_guidance: adminGuidance ?? null, total_days: 7,
    }).select().single();
    if (jobErr) throw new Error(`Falha ao criar job: ${jobErr.message}`);

    let blueprint: any;
    try {
      const r = await callAiJson({ systemPrompt, userPrompt, perAttemptMs: 110_000 });
      blueprint = r.data;
    } catch (e) {
      await supabase.from("plan_generation_jobs").update({ status: "failed", error: (e as Error).message }).eq("id", job.id);
      throw e;
    }
    if (!blueprint?.days) {
      await supabase.from("plan_generation_jobs").update({ status: "failed", error: "Blueprint sem 'days'." }).eq("id", job.id);
      throw new Error("A IA não retornou o blueprint semanal.");
    }

    // Semeia os 7 dias
    const dayRows = WEEKDAYS.map((wd) => ({
      job_id: job.id, weekday: wd, status: "pending",
      strategy_input: blueprint.days?.[wd] ?? null,
    }));
    await supabase.from("plan_generation_days").insert(dayRows);

    await supabase.from("plan_generation_jobs").update({
      status: "generating_days", current_stage: "gerando cada dia", weekly_blueprint: blueprint,
    }).eq("id", job.id);

    return json({ success: true, job_id: job.id, blueprint, weekdays: WEEKDAYS });
  } catch (error) {
    console.error("generate-weekly-blueprint:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
