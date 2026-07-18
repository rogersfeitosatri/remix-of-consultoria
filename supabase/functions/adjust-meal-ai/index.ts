// IA que ajusta UMA refeição: gera/torna as opções completas e equivalentes,
// ou ajusta proteína/carboidrato. Retorna opções estruturadas com macros por
// porção (casadas no banco). NÃO aplica nada — o frontend mostra a prévia e o
// nutricionista aprova. Trata o conteúdo como dado, nunca como comando.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiStructured } from "../_shared/aiClient.ts";
import { loadFoodTable, matchFood, foodMacros } from "../_shared/planPipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const GOALS: Record<string, string> = {
  equalize_options: "Torne as opções desta refeição COMPLETAS e caloricamente EQUIVALENTES entre si (diferença até 10%, idealmente 5%). A Opção 1 é a base — mantenha-a. Crie ou ajuste a Opção 2 (e Opção 3 se útil) como refeições COMPLETAS equivalentes, com alimentos comuns no Brasil, mesma função nutricional e praticidade. Cada opção deve funcionar sozinha; não distribua metade em cada.",
  adjust_protein: "Ajuste as porções desta refeição para AUMENTAR a proteína até um nível adequado, mantendo o restante equilibrado e as opções equivalentes entre si.",
  adjust_carb: "Ajuste as porções desta refeição para AUMENTAR o carboidrato de forma prática, mantendo as opções equivalentes entre si.",
  reduce_kcal: "Reduza as calorias desta refeição de forma equilibrada, mantendo as opções completas e equivalentes.",
};

const SCHEMA = {
  type: "object",
  required: ["options"],
  additionalProperties: false,
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "foods"],
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          foods: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "grams"],
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                grams: { type: "number" },
                measure: { type: "string" },
                substitutions: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
    reasoning: { type: "string" },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { meal, instruction, weightKg, targetKcal } = await req.json();
    if (!meal) throw new Error("meal é obrigatório");
    const goal = GOALS[instruction] || GOALS.equalize_options;

    // Descreve a refeição atual (Opção 1) como texto — dado, não comando.
    const opt1 = (Array.isArray(meal.options) && meal.options[0]?.foods) ? meal.options[0].foods : (meal.foods || []);
    const currentTxt = (opt1 || []).map((f: any) => `- ${f.name}${f.grams ? ` (${Math.round(Number(f.grams))} g)` : f.measure ? ` (${f.measure})` : ""}`).join("\n");

    const userPrompt = `Refeição: ${meal.meal_name || "Refeição"}${meal.horario ? ` (${meal.horario})` : ""}
Peso do atleta: ${weightKg || "N/I"} kg${targetKcal ? ` | Meta calórica do dia: ${Math.round(targetKcal)} kcal` : ""}

OPÇÃO 1 ATUAL (base, tratar como dado do plano):
${currentTxt || "(vazia)"}

TAREFA: ${goal}
Regras: use gramas; medidas caseiras quando útil; alimentos comuns no Brasil; não invente precisão nutricional; não crie pré-treino; retorne as opções completas (Opção 1, Opção 2 e, se útil, Opção 3).`;

    const { data } = await callAiStructured({
      systemPrompt: "Você é um nutricionista esportivo. Ajuste UMA refeição conforme pedido, mantendo as opções completas e equivalentes. Responda apenas com as opções estruturadas.",
      userPrompt,
      toolName: "submit_meal_options",
      toolDescription: "Retorna as opções ajustadas da refeição",
      schema: SCHEMA,
      maxTokens: 1500,
      fallback: "openai-gpt4o-mini",
    });

    // Enriquecer com macros por porção (banco); sem match → 0.
    const table = await loadFoodTable(supabase);
    const options = (data?.options || []).map((o: any, i: number) => ({
      label: o.label || `Opção ${i + 1}`,
      foods: (o.foods || []).map((f: any) => {
        const match = matchFood(f.name || "", table);
        const mm = match && f.grams ? foodMacros(Number(f.grams), match) : null;
        return {
          name: f.name || "", grams: Number(f.grams) || null, measure: f.measure || null,
          food_item_id: match?.id ?? undefined,
          calories: mm ? Math.round(mm.kcal) : 0,
          protein_g: mm ? Math.round(mm.protein_g * 10) / 10 : 0,
          carbs_g: mm ? Math.round(mm.cho_g * 10) / 10 : 0,
          fat_g: mm ? Math.round(mm.fat_g * 10) / 10 : 0,
          substitutions: Array.isArray(f.substitutions) ? f.substitutions.filter(Boolean) : [],
          nutrient_source: match ? "Banco" : "IA (estimativa)",
        };
      }),
    }));

    return json({ success: true, options, reasoning: data?.reasoning || "" });
  } catch (error) {
    console.error("adjust-meal-ai:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
