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

    const systemPrompt = `Você é um especialista em periodização nutricional para atletas de endurance, fundamentado em Burke (2015), Impey et al. (2018), Jeukendrup (2017) e Hawley & Morton (2014).

CONHECIMENTO BASE — 6 MÉTODOS DE TRAIN-LOW (mysportscience.com / Hawley & Burke):
1. **Dieta Low-Carb crônica**: Redução geral de CHO na dieta. Glicogênio muscular e hepático depletados. Aumento da oxidação lipídica, mas pode comprometer metabolismo de CHO. Usar com cautela.
2. **Treino duplo no dia (twice-a-day)**: 1º treino depleta glicogênio muscular → sem CHO entre sessões → 2º treino com glicogênio baixo. Máximo 1-2x/semana. Eficaz para adaptações oxidativas.
3. **Treino em jejum matinal (fasted training)**: Treino antes do café. Glicogênio hepático baixo, muscular NORMAL. Café sem açúcar permitido. Ideal para sessões leves/moderadas.
4. **Longão sem CHO intra (training without carb intake)**: Sessão longa sem ingestão de CHO. Início com glicogênio normal que vai depletando. Compromete intensidade. Usar quando qualidade não é prioritária.
5. **Sem CHO no recovery (withholding recovery carbs)**: Treino normal, mas sem CHO por 1-2h após. Pode potencializar adaptações, mas atrasa recuperação. Trade-off controlado.
6. **Sleep-Low (dormir com glicogênio baixo)**: Treino à noite → sem CHO até o treino da manhã seguinte. Amplifica sinalização molecular (AMPK, PGC-1α). Estratégia potente mas exigente.

REGRAS DE APLICAÇÃO POR FASE:
- **Base**: Train-Low PERMITIDO. Priorizar métodos 3 (jejum), 5 (sem recovery CHO) e 6 (sleep-low) em dias de treino leve/B/C. Sessões A = sempre High CHO.
- **Específica**: Train-Low REDUZIDO. Máximo 2x/semana. Apenas métodos 3 e 5. Foco em treino intestinal com CHO intra nos longões.
- **Competitiva**: Train-Low PROIBIDO. Todos os treinos com suporte completo de CHO. Simular protocolo de prova.
- **Pico**: Train-Low PROIBIDO. Carb-loading. Maximizar reservas de glicogênio.
- **Transição**: Train-Low PERMITIDO. Fase regenerativa, flexibilidade nutricional.

REGRAS GERAIS:
1. Cada dia: classificação CHO = High, Medium, Low ou Recovery.
2. Treino Intenso + Prioridade A = SEMPRE High CHO.
3. Treino Leve ou descanso = Low ou Recovery.
4. Timing importa: turno do treino define a janela nutricional.
  - Manhã: pré-treino define se é fasted ou fed.
  - Tarde/Noite: pós-treino define se é sleep-low ou recovery completo.
5. Pré-treino: 1-4h antes. CHO proporcional à demanda. Low days = proteína + gordura.
6. Intra: apenas para sessões >60min moderada/alta. 30-90g CHO/h conforme fase.
7. Pós-treino: Recovery 4:1 (CHO:Prot) proporcional à intensidade. Em dias Low: apenas proteína.
8. Noite: Se sleep-low → proteína caseína, sem CHO. Se recovery → CHO + proteína completo.
9. Considerar o estímulo do DIA SEGUINTE ao definir a orientação noturna.`;

    const userPrompt = `FASE ATUAL: ${phase.phase_name}
OBJETIVO DA FASE: ${phase.objective || 'Não definido'}
CHO RANGE: ${phase.cho_range || '3-6 g/kg'}
TRAIN-LOW: ${phase.train_low_strategy || 'permitido'}

SESSÕES DA SEMANA:
${sessionsText}

${athleteInfo ? `DADOS DO ATLETA:
Peso: ${athleteInfo.weight || '?'}kg
Objetivo: ${athleteInfo.goal || '?'}` : ''}

Gere a dinâmica nutricional para os 7 dias considerando:
- O timing dos treinos (turno) define a janela nutricional
- A intensidade e prioridade definem o suporte de CHO
- Os métodos de train-low aplicáveis à fase atual
- A recuperação entre sessões consecutivas
- O estímulo do dia seguinte influencia a orientação noturna

Responda usando a tool generate_dynamics.`;

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
            description: "Generate weekly nutritional dynamics for each day based on training stimuli and periodization phase rules",
            parameters: {
              type: "object",
              properties: {
                dynamics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      day_of_week: { type: "number", description: "0=Monday to 6=Sunday" },
                      cho_classification: { type: "string", enum: ["High", "Medium", "Low", "Recovery"] },
                      pre_training: { type: "string", description: "Pre-training nutritional guidance with timing" },
                      intra_training: { type: "string", description: "Intra-training guidance (empty if not applicable)" },
                      post_training: { type: "string", description: "Post-training recovery guidance" },
                      night_guidance: { type: "string", description: "Night guidance considering next day stimulus" },
                      notes: { type: "string", description: "Brief evidence-based justification and train-low method used if any" },
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
