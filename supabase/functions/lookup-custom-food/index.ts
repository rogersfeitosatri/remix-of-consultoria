import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiStructured } from "../_shared/aiClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration is missing');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { foodName } = await req.json();
    if (!foodName?.trim()) throw new Error('foodName is required');

    const SCHEMA = {
      type: "object",
      required: ["name", "category", "calories_per_100g", "protein_per_100g", "carbs_per_100g", "fat_per_100g", "fiber_per_100g", "common_measures"],
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        category: { type: "string", enum: ["Cereais", "Carnes", "Leguminosas", "Laticínios", "Frutas", "Vegetais", "Gorduras", "Suplementos", "Outros"] },
        calories_per_100g: { type: "number" },
        protein_per_100g: { type: "number" },
        carbs_per_100g: { type: "number" },
        fat_per_100g: { type: "number" },
        fiber_per_100g: { type: "number" },
        common_measures: {
          type: "array",
          items: {
            type: "object",
            required: ["measure_name", "measure_weight_g"],
            properties: {
              measure_name: { type: "string" },
              measure_weight_g: { type: "number" },
            },
          },
        },
      },
    };

    const { data: foodData } = await callAiStructured({
      systemPrompt: `Você é um banco de dados nutricional. O usuário vai informar o nome de um alimento e você deve retornar os dados nutricionais por 100g com base na Tabela TACO, IBGE ou referências confiáveis de composição de alimentos brasileiros. Inclua medidas caseiras comuns (colher de sopa, unidade, fatia, xícara, etc.) com o peso em gramas de cada medida. SEMPRE inclua "Gramas" como uma medida com peso 1. Seja preciso nos valores. Se for um alimento composto (ex: "bolo de cenoura"), estime com base nos ingredientes típicos.`,
      userPrompt: `Alimento: "${foodName.trim()}"\n\nRetorne os dados nutricionais por 100g e as medidas caseiras comuns.`,
      toolName: 'submit_food_data',
      toolDescription: 'Submit nutritional data for the food item',
      schema: SCHEMA,
      maxTokens: 1500,
      fallback: 'openai-gpt4o-mini',
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: inserted, error: insertError } = await supabase
      .from('food_items')
      .insert({
        name: foodData.name,
        category: foodData.category,
        calories_per_100g: foodData.calories_per_100g,
        protein_per_100g: foodData.protein_per_100g,
        carbs_per_100g: foodData.carbs_per_100g,
        fat_per_100g: foodData.fat_per_100g,
        fiber_per_100g: foodData.fiber_per_100g,
        source: 'custom',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    const measures = [
      ...foodData.common_measures.filter((m: any) => m.measure_name !== 'Gramas'),
      { measure_name: 'Gramas', measure_weight_g: 1 },
    ];

    const { error: measuresError } = await supabase
      .from('food_measures')
      .insert(measures.map((m: any) => ({
        food_item_id: inserted.id,
        measure_name: m.measure_name,
        measure_weight_g: m.measure_weight_g,
      })));

    if (measuresError) throw measuresError;

    return new Response(JSON.stringify({
      success: true,
      food: {
        id: inserted.id,
        ...foodData,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in lookup-custom-food:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
