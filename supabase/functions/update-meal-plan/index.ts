// Atualiza o plano alimentar ATUAL do atleta com base no último check-in,
// objetivos, evolução e feedback ao longo do histórico de check-ins.
// Retorna o plano atualizado (mesmo formato do analyze-athlete) + uma mensagem
// curta para o admin enviar ao atleta explicando os ajustes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiStructured } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase configuration is missing");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, adminNote } = await req.json();
    if (!clientId) throw new Error("clientId is required");

    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Error("Cliente não encontrado");

    const { data: profile } = await supabase
      .from("athlete_profiles").select("*").eq("client_id", clientId).maybeSingle();

    // Plano atual (obrigatório — é o que será atualizado)
    const { data: currentAnalysis } = await supabase
      .from("ai_analyses").select("*").eq("client_id", clientId).maybeSingle();
    const currentPlan = currentAnalysis?.raw_response
      ? safeParse(currentAnalysis.raw_response)
      : null;
    if (!currentPlan?.meal_plan) {
      throw new Error("Não há plano alimentar atual para atualizar. Gere o plano primeiro.");
    }

    // Anamnese mais recente (objetivos/hábitos base)
    const { data: anamnese } = await supabase
      .from("anamnese_responses")
      .select("*, anamnese_forms!inner (title)")
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Histórico de check-ins (mais recente primeiro) + textos das perguntas
    const { data: checkins } = await supabase
      .from("checkin_responses")
      .select("responses, submitted_at, form_id")
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false })
      .limit(6);

    const formIds = Array.from(new Set((checkins || []).map((c: any) => c.form_id).filter(Boolean)));
    const questionsById: Record<string, string> = {};
    if (formIds.length) {
      const { data: qs } = await supabase
        .from("checkin_questions")
        .select("id, question_text")
        .in("form_id", formIds);
      for (const q of qs || []) questionsById[q.id] = q.question_text;
    }

    if (!checkins || checkins.length === 0) {
      throw new Error("Nenhum check-in encontrado. A atualização usa o histórico de check-ins do atleta.");
    }

    const checkinHistory = (checkins || []).map((c: any, idx: number) => {
      const when = c.submitted_at ? new Date(c.submitted_at).toLocaleDateString("pt-BR") : "s/ data";
      const lines = Object.entries(c.responses || {}).map(([qid, val]: any) => {
        const q = questionsById[qid] || qid;
        const answer = val && typeof val === "object" && "answer" in val ? val.answer : val;
        const comment = val && typeof val === "object" && "comment" in val ? val.comment : null;
        const a = Array.isArray(answer) ? answer.join(", ") : answer;
        return `  - ${q}: ${a ?? "-"}${comment ? ` (obs: ${comment})` : ""}`;
      }).join("\n");
      return `CHECK-IN ${idx === 0 ? "MAIS RECENTE" : `#${idx + 1}`} (${when}):\n${lines}`;
    }).join("\n\n");

    const objectives = [
      profile?.main_goal, profile?.goal, (anamnese as any)?.main_goal,
      (client as any)?.goal, (client as any)?.objective,
    ].filter(Boolean).join(" | ") || "não informado";

    const prompt = `Você vai ATUALIZAR o plano alimentar de um atleta de endurance com base na evolução dele.

OBJETIVO DO ATLETA: ${objectives}

PLANO ALIMENTAR ATUAL (JSON — mantenha a mesma estrutura ao devolver):
${JSON.stringify(currentPlan.meal_plan)}

ORIENTAÇÕES ESTRATÉGICAS ATUAIS:
${JSON.stringify(currentPlan.strategic_orientations ?? {})}

HISTÓRICO DE CHECK-INS (use principalmente o MAIS RECENTE, mas considere a evolução ao longo do tempo):
${checkinHistory}

${adminNote ? `OBSERVAÇÃO DO NUTRICIONISTA: ${adminNote}\n` : ""}
TAREFA:
1. Ajuste o plano alimentar e as orientações considerando o relato, feedback, adesão e evolução do atleta nos check-ins (peso, energia, treinos, dificuldades relatadas).
2. Mantenha o formato e os alimentos que o atleta já usa; ajuste porções/quantidades/estratégias conforme necessário.
3. Recalcule os totais diários (kcal e g/kg) coerentes com os ajustes.
4. Escreva "adjustment_message": uma mensagem curta (2 a 5 frases), calorosa e clara, para o NUTRICIONISTA ENVIAR AO ATLETA, explicando de forma simples o que mudou no plano e por quê (com base na evolução/feedback dele). Não use jargão técnico em excesso.`;

    let systemPrompt = SYSTEM_PROMPT;
    try {
      const { data: customPrompt } = await supabase
        .from("ai_prompts").select("prompt_text")
        .eq("user_id", client.user_id).eq("context_key", "meal_plan_generation").maybeSingle();
      if (customPrompt?.prompt_text?.trim()) systemPrompt = customPrompt.prompt_text;
    } catch { /* usa default */ }

    const { data: analysisData, provider, model } = await callAiStructured({
      systemPrompt,
      userPrompt: prompt,
      toolName: "submit_updated_plan",
      toolDescription: "Submit the updated meal plan and orientations plus an adjustment message for the athlete",
      schema: UPDATE_SCHEMA,
      fallback: "lovable-gemini-pro",
    });

    const merged = {
      ...currentPlan,
      athlete_summary: analysisData.athlete_summary ?? currentPlan.athlete_summary,
      carb_estimation: analysisData.carb_estimation ?? currentPlan.carb_estimation,
      carb_progression: analysisData.carb_progression ?? currentPlan.carb_progression,
      meal_plan: analysisData.meal_plan ?? currentPlan.meal_plan,
      strategic_orientations: analysisData.strategic_orientations ?? currentPlan.strategic_orientations,
      alerts: analysisData.alerts ?? currentPlan.alerts,
      adjustment_message: analysisData.adjustment_message ?? "",
      _isNewFormat: true,
      last_update_reason: "checkin_update",
      updated_at: new Date().toISOString(),
    };

    const record = {
      diagnosis: merged.athlete_summary || currentAnalysis?.diagnosis || "",
      energy_expenditure: {
        carb_estimation: merged.carb_estimation,
        carb_progression: merged.carb_progression,
      },
      caloric_deficit: { meal_plan: merged.meal_plan },
      macronutrients: { strategic_orientations: merged.strategic_orientations },
      alerts: merged.alerts || [],
      raw_response: JSON.stringify(merged),
      model_used: `${provider}/${model}`,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveErr } = await supabase
      .from("ai_analyses").update(record).eq("id", currentAnalysis.id).select().single();
    if (saveErr) throw new Error(`Falha ao salvar plano atualizado: ${saveErr.message}`);

    return new Response(
      JSON.stringify({ success: true, analysis: saved, adjustment_message: merged.adjustment_message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("update-meal-plan error:", error);
    const status = (error as any)?.status;
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (status === 429) return json({ error: "Limite de requisições da IA excedido. Tente novamente em alguns minutos." }, 429);
    if (status === 402) return json({ error: "Créditos da IA insuficientes." }, 402);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

const SYSTEM_PROMPT = `Você é um nutricionista esportivo funcional especializado em atletas de endurance (corrida, triathlon, ciclismo), baseando suas análises no Tratado de Nutrição Esportiva Funcional (Paschoal & Naves) e evidências científicas atuais.

Sua tarefa é ATUALIZAR um plano alimentar já existente com base na evolução do atleta (check-ins), mantendo aplicação prática.

REGRAS:
- Linguagem simples, clara e direta; foco em aplicação prática
- Usar os alimentos que o atleta JÁ consome; manter substituições na MESMA LINHA (ex: "pão francês ou tapioca ou cuscuz")
- Porções e quantidades REAIS (gramas, ml, unidades), coerentes com os alvos de macros e calorias
- A soma das refeições deve fechar com o alvo calórico e de macros
- Ajustar com base no relato e evolução do atleta (peso, energia, adesão, dificuldades)
- Sempre incluir a mensagem de ajuste (adjustment_message) para o atleta`;

// Esquema = análise completa + adjustment_message
const UPDATE_SCHEMA = {
  type: "object",
  properties: {
    athlete_summary: { type: "string", description: "Resumo atualizado objetivo (máx 6 linhas)." },
    carb_estimation: {
      type: "object",
      properties: {
        current_cho_gkg: { type: "number" },
        classification: { type: "string", enum: ["Baixa", "Moderada", "Adequada", "Alta"] },
        current_protein_gkg: { type: "number" },
        current_fat_gkg: { type: "number" },
        estimated_kcal: { type: "number" },
        reasoning: { type: "string" },
      },
      required: ["current_cho_gkg", "classification", "reasoning"],
    },
    carb_progression: {
      type: "object",
      properties: {
        current: { type: "number" },
        next_target: { type: "string" },
        final_goal: { type: "number" },
        increment: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["current", "next_target", "final_goal", "increment", "rationale"],
    },
    meal_plan: {
      type: "object",
      properties: {
        meals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              meal_name: { type: "string" },
              food_groups: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    group: { type: "string" },
                    options: { type: "string", description: "Opções COM PORÇÕES separadas por 'ou'" },
                  },
                  required: ["group", "options"],
                },
              },
              meal_macros: { type: "string" },
              timing_note: { type: "string" },
            },
            required: ["meal_name", "food_groups"],
          },
        },
        daily_totals: {
          type: "object",
          properties: {
            kcal: { type: "number" }, cho_g: { type: "number" }, cho_gkg: { type: "number" },
            protein_g: { type: "number" }, protein_gkg: { type: "number" },
            fat_g: { type: "number" }, fat_gkg: { type: "number" }, kcal_kg: { type: "number" },
          },
          required: ["kcal", "cho_g", "cho_gkg", "protein_g", "fat_g"],
        },
      },
      required: ["meals", "daily_totals"],
    },
    strategic_orientations: {
      type: "object",
      properties: {
        meal_routine: { type: "array", items: { type: "string" } },
        training_strategy: { type: "array", items: { type: "string" } },
        supplementation: {
          type: "array",
          items: {
            type: "object",
            properties: { supplement: { type: "string" }, recommendation: { type: "string" } },
            required: ["supplement", "recommendation"],
          },
        },
        race_context: { type: "string" },
      },
      required: ["meal_routine", "training_strategy", "supplementation"],
    },
    alerts: { type: "array", items: { type: "string" } },
    adjustment_message: {
      type: "string",
      description: "Mensagem curta (2-5 frases) para o nutricionista enviar ao atleta explicando os ajustes feitos e o porquê, com base na evolução/feedback do atleta.",
    },
  },
  required: ["meal_plan", "strategic_orientations", "adjustment_message"],
  additionalProperties: false,
};
