// Importa uma dieta que o atleta JÁ possui (texto colado do PDF/plano atual) e
// a estrutura no formato do plano da consultoria (refeições, alimentos, opções
// com porções, totais). Vira o plano base — depois pode ser ajustado pela IA
// com o check-in (update-meal-plan). NÃO inventa alimentos: estrutura o que veio.
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

    const { clientId, planText } = await req.json();
    if (!clientId) throw new Error("clientId is required");
    if (!planText || String(planText).trim().length < 20) {
      throw new Error("Cole o texto da dieta atual do atleta para importar.");
    }

    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Error("Cliente não encontrado");
    const { data: profile } = await supabase
      .from("athlete_profiles").select("id").eq("client_id", clientId).maybeSingle();

    const prompt = `Abaixo está a DIETA ATUAL do atleta (copiada do plano/PDF existente). Estruture-a EXATAMENTE como está, sem inventar alimentos, quantidades ou refeições que não estejam no texto.

DIETA ATUAL (texto):
"""
${String(planText).slice(0, 12000)}
"""

REGRAS:
- Preserve os nomes e a ordem das refeições e os horários, se houver.
- Preserve alimentos, porções, medidas caseiras e substituições. Substituições (separadas por "ou") viram várias "options" do mesmo grupo.
- Não crie alimentos novos nem altere quantidades. Se algum macro/total não estiver no texto, estime aproximadamente e deixe claro que é estimativa no campo reasoning.
- Se houver orientações/estratégias no texto (pré/pós-treino, suplementos), coloque em strategic_orientations.`;

    const { data: structured, provider, model } = await callAiStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: prompt,
      toolName: "submit_imported_plan",
      toolDescription: "Structure the athlete's existing diet into the meal plan format",
      schema: IMPORT_SCHEMA,
      fallback: "lovable-gemini-pro",
    });

    const full = {
      athlete_summary: structured.athlete_summary ?? "",
      carb_estimation: structured.carb_estimation ?? { current_cho_gkg: 0, classification: "Moderada", reasoning: "Importado da dieta atual." },
      carb_progression: structured.carb_progression ?? {},
      meal_plan: structured.meal_plan,
      strategic_orientations: structured.strategic_orientations ?? { meal_routine: [], training_strategy: [], supplementation: [], race_context: "" },
      alerts: structured.alerts ?? [],
      _isNewFormat: true,
      source: "imported_diet",
      updated_at: new Date().toISOString(),
    };

    const record = {
      client_id: clientId,
      athlete_profile_id: profile?.id ?? null,
      diagnosis: full.athlete_summary || "",
      energy_expenditure: { carb_estimation: full.carb_estimation, carb_progression: full.carb_progression },
      caloric_deficit: { meal_plan: full.meal_plan },
      macronutrients: { strategic_orientations: full.strategic_orientations },
      alerts: full.alerts,
      raw_response: JSON.stringify(full),
      model_used: `${provider}/${model}`,
    };

    const { data: existing } = await supabase
      .from("ai_analyses").select("id").eq("client_id", clientId).maybeSingle();

    let saved;
    if (existing) {
      const { data, error } = await supabase.from("ai_analyses")
        .update({ ...record, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single();
      if (error) throw new Error(`Falha ao salvar: ${error.message}`);
      saved = data;
    } else {
      const { data, error } = await supabase.from("ai_analyses").insert(record).select().single();
      if (error) throw new Error(`Falha ao salvar: ${error.message}`);
      saved = data;
    }

    return new Response(JSON.stringify({ success: true, analysis: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("import-meal-plan error:", error);
    const status = (error as any)?.status;
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (status === 429) return json({ error: "Limite de requisições da IA excedido." }, 429);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const SYSTEM_PROMPT = `Você organiza dietas já prontas no formato estruturado de um sistema de nutrição esportiva. Sua tarefa é APENAS estruturar fielmente a dieta recebida — não é criar, nem otimizar, nem alterar quantidades. Mantenha alimentos, porções, medidas caseiras, substituições ("ou"), refeições e horários exatamente como no texto. Só estime macros/totais quando não estiverem no texto, deixando claro que é estimativa.`;

const IMPORT_SCHEMA = {
  type: "object",
  properties: {
    athlete_summary: { type: "string" },
    carb_estimation: {
      type: "object",
      properties: {
        current_cho_gkg: { type: "number" },
        classification: { type: "string", enum: ["Baixa", "Moderada", "Adequada", "Alta"] },
        reasoning: { type: "string" },
      },
      required: ["reasoning"],
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
              timing_note: { type: "string" },
              food_groups: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    group: { type: "string" },
                    options: { type: "string", description: "Alimentos com porções, substituições separadas por 'ou'" },
                  },
                  required: ["group", "options"],
                },
              },
              meal_macros: { type: "string" },
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
        },
      },
      required: ["meals"],
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
    },
    alerts: { type: "array", items: { type: "string" } },
  },
  required: ["meal_plan"],
  additionalProperties: false,
};
