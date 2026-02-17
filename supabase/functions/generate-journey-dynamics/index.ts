import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessions, phase, athleteInfo } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    const sessionsText = sessions.map((s: any) =>
      `${daysOfWeek[s.day_of_week]}: ${s.modality || 'Descanso'} | ${s.shift} | Intensidade: ${s.intensity} | Prioridade: ${s.priority}${s.metabolic_objective ? ` | Obj: ${s.metabolic_objective}` : ''}`
    ).join('\n');

    const systemPrompt = `Você é um especialista em periodização nutricional para atletas de endurance (Burke, Impey, Jeukendrup).
Gere a dinâmica nutricional semanal baseada nas sessões de treino e fase atual.

REGRAS:
1. Cada dia deve ter classificação CHO: High, Medium, Low ou Recovery.
2. Dias com treino intenso/prioritário A = High CHO.
3. Dias leves ou recuperação = Low ou Recovery.
4. Train-Low: ${phase.train_low_strategy === 'permitido' ? 'Pode usar em dias leves' : phase.train_low_strategy === 'reduzido' ? 'Usar com cautela, máximo 2x/semana' : 'NÃO permitido nesta fase'}.
5. Faixa de CHO da fase: ${phase.cho_range || '3-6 g/kg'}.
6. Pré-treino: orientação de timing e composição.
7. Intra: aplicável apenas para sessões >60min de moderada/alta intensidade.
8. Pós-treino: recovery proporcional à demanda.
9. Noite: orientação para o período noturno (sleep-low quando aplicável).
10. Use evidências de Impey et al. (2018) e Burke (2015) para fundamentar.`;

    const userPrompt = `FASE ATUAL: ${phase.phase_name}
OBJETIVO DA FASE: ${phase.objective || 'Não definido'}
CHO RANGE: ${phase.cho_range || '3-6 g/kg'}
TRAIN-LOW: ${phase.train_low_strategy || 'permitido'}

SESSÕES DA SEMANA:
${sessionsText}

${athleteInfo ? `DADOS DO ATLETA:
Peso: ${athleteInfo.weight || '?'}kg
Objetivo: ${athleteInfo.goal || '?'}` : ''}

Responda APENAS em JSON válido com este formato:
{
  "dynamics": [
    {
      "day_of_week": 0,
      "cho_classification": "High|Medium|Low|Recovery",
      "pre_training": "orientação",
      "intra_training": "orientação ou vazio",
      "post_training": "orientação",
      "night_guidance": "orientação noturna",
      "notes": "justificativa breve"
    }
  ]
}

Gere exatamente 7 dias (day_of_week 0 a 6).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_dynamics",
            description: "Generate weekly nutritional dynamics for each day",
            parameters: {
              type: "object",
              properties: {
                dynamics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day_of_week: { type: "number" },
                      cho_classification: { type: "string", enum: ["High", "Medium", "Low", "Recovery"] },
                      pre_training: { type: "string" },
                      intra_training: { type: "string" },
                      post_training: { type: "string" },
                      night_guidance: { type: "string" },
                      notes: { type: "string" },
                    },
                    required: ["day_of_week", "cho_classification", "pre_training", "post_training", "night_guidance"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["dynamics"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_dynamics" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    let dynamics;
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      dynamics = parsed.dynamics;
    } else {
      // Fallback: parse from content
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const parsed = JSON.parse((jsonMatch[1] || content).trim());
      dynamics = parsed.dynamics;
    }

    return new Response(JSON.stringify({ dynamics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("generate-journey-dynamics error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
