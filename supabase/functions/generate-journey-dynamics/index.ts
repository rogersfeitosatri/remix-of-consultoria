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
      `${daysOfWeek[s.day_of_week]}: ${s.modality || 'Descanso'} | ${s.shift} | Intensidade: ${s.intensity} | Prioridade: ${s.priority} | Duração: ${s.duration_minutes || '60'}min${s.metabolic_objective ? ` | Obj: ${s.metabolic_objective}` : ''}`
    ).join('\n');

    const systemPrompt = `Você é um especialista em periodização nutricional para atletas de endurance, fundamentado em Burke (2015), Impey et al. (2018), Jeukendrup (2017), Hawley & Morton (2014) e Vitale & Getzin (2019).

CONHECIMENTO BASE — 6 MÉTODOS DE TRAIN-LOW (mysportscience.com / Hawley & Burke):
1. **Dieta Low-Carb crônica**: Redução geral de CHO na dieta. Glicogênio muscular e hepático depletados.
2. **Treino duplo no dia (twice-a-day)**: 1º treino depleta glicogênio muscular → sem CHO entre sessões → 2º treino com glicogênio baixo.
3. **Treino em jejum matinal (fasted training)**: Treino antes do café. Glicogênio hepático baixo, muscular NORMAL.
4. **Longão sem CHO intra (training without carb intake)**: Sessão longa sem ingestão de CHO.
5. **Sem CHO no recovery (withholding recovery carbs)**: Treino normal, mas sem CHO por 1-2h após.
6. **Sleep-Low (dormir com glicogênio baixo)**: Treino à noite → sem CHO até o treino da manhã seguinte.

═══════════════════════════════════════════════════════
LÓGICA CENTRAL: DISTRIBUIÇÃO INTRA-DIA DE CARBOIDRATOS
═══════════════════════════════════════════════════════

O princípio fundamental é que a distribuição de CHO ao longo do dia deve ser orientada pelo TIMING DO PRÓXIMO ESTÍMULO INTENSO, não apenas pelo treino do dia atual.

REGRA 1 — PREPARAÇÃO PRÉ-TREINO INTENSO (dia anterior):
- Se AMANHÃ há treino intenso/moderado pela MANHÃ:
  → HOJE: concentração crescente de CHO ao longo do dia
  → Manhã: 20-25% do CHO total | Almoço: 25-30% | Lanche/Tarde: 25-30% | Noite: 25-30%
  → Jantar e ceia com maior aporte de CHO para carregar reservas de glicogênio noturno

- Se AMANHÃ há treino intenso/moderado pela TARDE/NOITE:
  → HOJE à noite: moderado (não precisa carregar tanto)
  → AMANHÃ: concentração crescente até o treino
  → Café: 25-30% | Almoço: 30-35% | Pré-treino: 20-25% | Pós+Noite: 15-20%

REGRA 2 — PÓS-TREINO E RECUPERAÇÃO (fase-dependente):
- FASE BASE: Pós-treino leve/moderado → Recovery reduzido (proteína + gordura). Buscar adaptações mitocondriais. Train-low permitido.
- FASE ESPECÍFICA: Pós-treino intenso → Recovery progressivo. Iniciar suporte de CHO pós-treino para manter qualidade.
- FASE COMPETITIVA/PICO: Pós-treino → Recovery COMPLETO e imediato (4:1 CHO:Prot). Maximizar recuperação.

REGRA 3 — CHO g/kg POR DIA (baseado em tipo/intensidade/duração):
- Descanso / Day Off: 2-3 g/kg
- Treino leve (<60min, baixa intensidade): 3-4 g/kg
- Treino moderado (60-90min, moderado): 4-5 g/kg
- Treino intenso/longo (>90min ou alta intensidade): 5-7 g/kg
- Treino muito intenso/intervalado (>90min + alta intensidade): 6-8 g/kg
- Dia pré-prova ou carb-loading: 8-12 g/kg

AJUSTES POR FASE:
- Base: usar o limite INFERIOR das faixas. Ex: treino moderado = 4 g/kg, não 5.
- Específica: usar o meio das faixas. Ex: treino moderado = 4.5 g/kg.
- Competitiva: usar limite SUPERIOR. Ex: treino moderado = 5-6 g/kg.
- Pico: usar faixas máximas. Carb-loading nos últimos 2-3 dias.
- Transição: usar faixas baixas, semelhante à base.

REGRA 4 — DISTRIBUIÇÃO PERCENTUAL (morning_cho_pct + afternoon_cho_pct + night_cho_pct = 100):
- "morning" = Café da manhã + Lanche da manhã
- "afternoon" = Almoço + Lanche da tarde
- "night" = Jantar + Ceia

A distribuição deve refletir QUANDO o próximo treino intenso ocorre:
- Treino AMANHÃ de manhã → noite de hoje = maior %
- Treino HOJE à tarde → manhã e almoço = maior %
- Treino HOJE de manhã → café reforçado + recovery pós = almoço maior
- Dia de descanso → distribuição equilibrada (33/34/33)

REGRA 5 — ADAPTAÇÕES MITOCONDRIAIS NA BASE:
Na fase Base, treinos LEVES e LONGOS de baixa intensidade são oportunidades para:
- Treinar em jejum (fasted morning training)
- Reduzir CHO intra-treino para estimular oxidação lipídica
- Aplicar sleep-low na noite anterior a treinos leves
- CHO g/kg pode ser 3-4g/kg mesmo em treinos longos SE a intensidade for baixa
→ Isso ACELERA adaptações que serão exploradas nas fases seguintes

REGRA 6 — PROGRESSÃO ENTRE FASES:
A filosofia central é que à medida que se progride da Base → Específica → Competitiva:
- O CHO total g/kg AUMENTA progressivamente
- O recovery pós-treino MELHORA progressivamente
- Os métodos train-low DIMINUEM progressivamente
- A distribuição intra-dia se torna mais orientada ao SUPORTE ao treino
→ Na Base: priorizar adaptação (tolerar desconforto metabólico)
→ Na Competitiva: priorizar performance (suprimir qualquer limitação nutricional)`;

    const userPrompt = `FASE ATUAL: ${phase.phase_name}
OBJETIVO DA FASE: ${phase.objective || 'Não definido'}
CHO RANGE DA FASE: ${phase.cho_range || '3-6 g/kg'}
TRAIN-LOW: ${phase.train_low_strategy || 'permitido'}

SESSÕES DA SEMANA:
${sessionsText}

${athleteInfo ? `DADOS DO ATLETA:
Peso: ${athleteInfo.weight || '?'}kg
Objetivo: ${athleteInfo.goal || '?'}` : ''}

INSTRUÇÃO: Gere a dinâmica nutricional para os 7 dias.

Para CADA dia, defina:
1. cho_gkg: o valor em g/kg de CHO total do dia (número decimal, ex: 4.5)
2. cho_classification: High, Medium, Low ou Recovery
3. morning_cho_pct + afternoon_cho_pct + night_cho_pct = 100 (distribuição percentual)
4. distribution_rationale: 1-2 frases explicando POR QUE essa distribuição (considerar o treino do dia seguinte)
5. pre_training, intra_training, post_training, night_guidance: orientações práticas

IMPORTANTE: Analise o treino do DIA SEGUINTE ao definir a distribuição de CHO de cada dia. A noite de hoje prepara o treino de amanhã.

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
            description: "Generate weekly nutritional dynamics with CHO g/kg targets and intra-day distribution based on training stimuli, timing, and periodization phase",
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
                      cho_gkg: { type: "number", description: "Total CHO in g/kg for the day (e.g. 4.5)" },
                      morning_cho_pct: { type: "number", description: "% of total CHO allocated to morning (breakfast + morning snack). Must sum to 100 with afternoon and night." },
                      afternoon_cho_pct: { type: "number", description: "% of total CHO allocated to afternoon (lunch + afternoon snack)." },
                      night_cho_pct: { type: "number", description: "% of total CHO allocated to night (dinner + supper)." },
                      distribution_rationale: { type: "string", description: "1-2 sentences explaining WHY this distribution pattern, considering next-day training" },
                      pre_training: { type: "string", description: "Pre-training nutritional guidance with timing" },
                      intra_training: { type: "string", description: "Intra-training guidance (empty if not applicable)" },
                      post_training: { type: "string", description: "Post-training recovery guidance" },
                      night_guidance: { type: "string", description: "Night guidance considering next day stimulus" },
                      notes: { type: "string", description: "Brief evidence-based justification and train-low method used if any" },
                    },
                    required: ["day_of_week", "cho_classification", "cho_gkg", "morning_cho_pct", "afternoon_cho_pct", "night_cho_pct", "distribution_rationale", "pre_training", "post_training", "night_guidance"],
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
