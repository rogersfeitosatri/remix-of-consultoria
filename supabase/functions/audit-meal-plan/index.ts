import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiStructured } from "../_shared/aiClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration is missing');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { clientId, editedAnalysis } = await req.json();
    if (!clientId || !editedAnalysis) throw new Error('clientId and editedAnalysis are required');

    const { data: client } = await supabase
      .from('clients')
      .select('id, name, user_id')
      .eq('id', clientId)
      .single();

    if (!client) throw new Error('Client not found');

    // Try to load custom prompt
    let basePrompt = '';
    try {
      const { data: customPrompt } = await supabase
        .from('ai_prompts')
        .select('prompt_text')
        .eq('user_id', client.user_id)
        .eq('context_key', 'meal_plan_generation')
        .maybeSingle();
      if (customPrompt?.prompt_text?.trim()) {
        basePrompt = customPrompt.prompt_text + '\n\n';
      }
    } catch {}

    const AUDIT_SYSTEM_PROMPT = `${basePrompt}Você é um nutricionista esportivo funcional. O nutricionista (admin) editou manualmente o plano alimentar de um atleta e precisa que você faça uma AUDITORIA e AJUSTE do plano.

SUA TAREFA:
1. Verificar se os totais diários (daily_totals) são coerentes com as refeições listadas
2. Se o nutricionista alterou os daily_totals (kcal, macros, g/kg), AJUSTAR as porções e quantidades de cada refeição para que a soma feche com os novos alvos
3. Se o nutricionista alterou refeições/alimentos, RECALCULAR os totais para refletir as mudanças
4. Manter TODOS os alimentos e opções escolhidos pelo nutricionista — apenas ajustar quantidades/porções
5. Cada opção de alimento DEVE incluir quantidade (gramas, ml, unidades)
6. O meal_macros de cada refeição deve ser recalculado
7. Retornar o plano completo corrigido no mesmo formato estruturado

REGRAS:
- NÃO remover alimentos que o nutricionista escolheu
- NÃO adicionar alimentos novos (a menos que uma refeição esteja vazia)
- AJUSTAR apenas porções e quantidades para adequar aos macros
- Manter a mesma estrutura de refeições
- Incluir protein_gkg e fat_gkg nos daily_totals
- Manter substituições na MESMA LINHA (ex: "pão francês (100g) ou tapioca (80g)")`;

    const userPrompt = `O nutricionista editou o plano alimentar. Faça a auditoria e ajuste as porções/quantidades para que o plano feche com os alvos de macronutrientes e calorias.

PLANO EDITADO PELO NUTRICIONISTA:
${JSON.stringify(editedAnalysis, null, 2)}

Retorne o plano completo corrigido mantendo a mesma estrutura. Ajuste as porções para que os macros e calorias fiquem coerentes com os daily_totals.`;

    console.log('Auditing meal plan for client:', clientId);

    const AUDIT_SCHEMA = {
      type: "object",
      required: ["athlete_summary", "carb_estimation", "carb_progression", "meal_plan", "strategic_orientations", "alerts"],
      additionalProperties: false,
      properties: {
        athlete_summary: { type: "string" },
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
        },
        meal_plan: {
          type: "object",
          required: ["meals", "daily_totals"],
          properties: {
            meals: {
              type: "array",
              items: {
                type: "object",
                required: ["meal_name", "food_groups"],
                properties: {
                  meal_name: { type: "string" },
                  food_groups: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["group", "options"],
                      properties: {
                        group: { type: "string" },
                        options: { type: "string" },
                      },
                    },
                  },
                  meal_macros: { type: "string" },
                  timing_note: { type: "string" },
                },
              },
            },
            daily_totals: {
              type: "object",
              required: ["kcal", "cho_g", "cho_gkg", "protein_g", "fat_g"],
              properties: {
                kcal: { type: "number" },
                cho_g: { type: "number" },
                cho_gkg: { type: "number" },
                protein_g: { type: "number" },
                protein_gkg: { type: "number" },
                fat_g: { type: "number" },
                fat_gkg: { type: "number" },
                kcal_kg: { type: "number" },
              },
            },
          },
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
                properties: {
                  supplement: { type: "string" },
                  recommendation: { type: "string" },
                },
              },
            },
            race_context: { type: "string" },
          },
        },
        alerts: { type: "array", items: { type: "string" } },
      },
    };

    const { data: auditedData, provider, model } = await callAiStructured({
      systemPrompt: AUDIT_SYSTEM_PROMPT,
      userPrompt,
      toolName: 'submit_audited_plan',
      toolDescription: 'Submit the audited and adjusted meal plan',
      schema: AUDIT_SCHEMA,
      maxTokens: 4000,
      fallback: 'openai-gpt4o-mini',
    });

    console.log(`Audit completed via ${provider}/${model}`);

    // IMPORTANT: preserve the admin's STRUCTURED meal plan (foods, options,
    // substitutions, exact quantities/measures). The audit schema only returns
    // legacy text food_groups, so without this merge the audit would silently
    // discard all the structured detail the admin carefully edited.
    if (editedAnalysis?.meal_plan?.meals?.length) {
      auditedData.meal_plan = editedAnalysis.meal_plan;
    }

    // Save the audited analysis
    const updatedRaw = JSON.stringify({ ...auditedData, _isNewFormat: true });
    const { error: updateError } = await supabase
      .from('ai_analyses')
      .update({
        raw_response: updatedRaw,
        caloric_deficit: { meal_plan: auditedData.meal_plan },
        macronutrients: { strategic_orientations: auditedData.strategic_orientations },
        diagnosis: auditedData.athlete_summary,
        energy_expenditure: { carb_estimation: auditedData.carb_estimation, carb_progression: auditedData.carb_progression },
        alerts: auditedData.alerts,
        model_used: `${provider}/${model} (audit)`,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', clientId);

    if (updateError) {
      console.error('Error saving audited analysis:', updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, analysis: auditedData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in audit-meal-plan:', error);
    const status = (error as any)?.status;
    if (status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições da IA excedido. Tente novamente em alguns minutos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
