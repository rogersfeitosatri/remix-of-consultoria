import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const { imageBase64, scanType } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = scanType === 'calorimetry'
      ? `Você é um especialista em nutrição esportiva. Analise esta imagem de um exame de calorimetria indireta.
Extraia os dados encontrados e responda SEMPRE usando a tool extract_body_data.
Se algum campo não estiver visível, use null.`
      : `Você é um especialista em nutrição esportiva. Analise esta imagem de um exame de bioimpedância (BIA).
Extraia os dados encontrados e responda SEMPRE usando a tool extract_body_data.
Se algum campo não estiver visível, use null.
Procure por: peso, % gordura, massa gorda (kg), % massa magra, massa magra (kg), água corporal, taxa metabólica basal, gordura visceral, massa muscular.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna", reasoning_effort: "none",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Extraia os dados deste exame de ${scanType === 'calorimetry' ? 'calorimetria indireta' : 'bioimpedância'}.` },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_body_data",
              description: "Extract body composition or calorimetry data from an exam image",
              parameters: {
                type: "object",
                properties: {
                  weight: { type: "number", description: "Peso corporal em kg" },
                  fat_percentage: { type: "number", description: "Percentual de gordura corporal (%)" },
                  fat_kg: { type: "number", description: "Massa gorda em kg" },
                  lean_mass_percentage: { type: "number", description: "Percentual de massa magra (%)" },
                  lean_mass_kg: { type: "number", description: "Massa magra em kg" },
                  body_water_percentage: { type: "number", description: "Percentual de água corporal (%)" },
                  body_water_kg: { type: "number", description: "Água corporal em kg" },
                  bmr_kcal: { type: "number", description: "Taxa Metabólica Basal (TMB/BMR) em kcal" },
                  visceral_fat: { type: "number", description: "Gordura visceral (índice ou nível)" },
                  muscle_mass_kg: { type: "number", description: "Massa muscular em kg" },
                  bone_mass_kg: { type: "number", description: "Massa óssea em kg" },
                  metabolic_age: { type: "number", description: "Idade metabólica" },
                  exam_date: { type: "string", description: "Data do exame no formato YYYY-MM-DD, se visível" },
                  notes: { type: "string", description: "Observações adicionais relevantes encontradas" },
                },
                required: [],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_body_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const bodyData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(bodyData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-body-composition error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao processar exame" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
