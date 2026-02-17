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

    // Build sessions text with next-day context for each day
    const sessionsByDay: Record<number, any> = {};
    sessions.forEach((s: any) => { sessionsByDay[s.day_of_week] = s; });

    const sessionsText = sessions.map((s: any) => {
      const nextDay = (s.day_of_week + 1) % 7;
      const prevDay = (s.day_of_week + 6) % 7;
      const nextSession = sessionsByDay[nextDay];
      const prevSession = sessionsByDay[prevDay];
      const nextInfo = nextSession 
        ? `${nextSession.modality || 'Descanso'} | ${nextSession.shift} | Int: ${nextSession.intensity} | Dur: ${nextSession.duration_minutes || '60'}min`
        : 'Descanso';
      const prevInfo = prevSession
        ? `${prevSession.modality || 'Descanso'} | ${prevSession.shift} | Int: ${prevSession.intensity}`
        : 'Descanso';
      const isNextOff = !nextSession?.modality || nextSession.modality.trim() === '' || nextSession.modality === 'Descanso';
      return `${daysOfWeek[s.day_of_week]}: ${s.modality || 'Descanso'} | ${s.shift} | Intensidade: ${s.intensity} | Prioridade: ${s.priority} | Duração: ${s.duration_minutes || '60'}min${s.metabolic_objective ? ` | Obj: ${s.metabolic_objective}` : ''}\n  → DIA ANTERIOR (${daysOfWeek[prevDay]}): ${prevInfo}\n  → DIA SEGUINTE (${daysOfWeek[nextDay]}): ${nextInfo}${isNextOff ? ' ⚠️ DAY OFF — NÃO fazer carb-loading à noite!' : ''}`;
    }).join('\n\n');

    const systemPrompt = `Você é um especialista em periodização nutricional para atletas de endurance, fundamentado em Burke (2015), Impey et al. (2018), Jeukendrup (2017), Hawley & Morton (2014) e Vitale & Getzin (2019).

CONHECIMENTO BASE — 6 MÉTODOS DE TRAIN-LOW (mysportscience.com / Hawley & Burke):
1. **Dieta Low-Carb crônica**: Redução geral de CHO na dieta.
2. **Treino duplo no dia (twice-a-day)**: 1º treino depleta glicogênio → sem CHO entre sessões → 2º treino com glicogênio baixo.
3. **Treino em jejum matinal (fasted training)**: Treino antes do café. Glicogênio hepático baixo, muscular NORMAL.
4. **Longão sem CHO intra (training without carb intake)**: Sessão longa sem ingestão de CHO.
5. **Sem CHO no recovery (withholding recovery carbs)**: Treino normal, mas sem CHO por 1-2h após.
6. **Sleep-Low (dormir com glicogênio baixo)**: Treino à noite → sem CHO até o treino da manhã seguinte.

═══════════════════════════════════════════════════════════
LÓGICA CENTRAL: OLHAR PARA TRÁS (DIA ATUAL) E PARA FRENTE (DIA SEGUINTE)
═══════════════════════════════════════════════════════════

ANTES DE DECIDIR A DISTRIBUIÇÃO DE CADA DIA, VOCÊ DEVE:
1. Identificar o TREINO DO DIA (modalidade, intensidade, duração, turno)
2. Identificar o TREINO DO DIA SEGUINTE (ou se é Day Off / Descanso)
3. Identificar o TREINO DO DIA ANTERIOR (para entender recovery)
4. Aplicar as regras abaixo COM BASE NESSES 3 DADOS CONCRETOS

═══════════════════════════════════════════════════════════
REGRA CRÍTICA — QUANDO AUMENTAR CHO À NOITE (carb-loading noturno):
═══════════════════════════════════════════════════════════

Aumentar CHO à noite (night_cho_pct > 35%) SÓ É JUSTIFICADO quando TODAS estas condições são verdadeiras:
✅ O dia SEGUINTE tem treino (NÃO é Day Off / Descanso)
✅ O treino do dia seguinte é de MANHÃ (turno matinal)
✅ O treino do dia seguinte é INTENSO ou LONGO (>90min OU alta intensidade)
✅ A FASE justifica carb-loading (ver regras por fase abaixo)

Se o dia seguinte é DAY OFF ou DESCANSO → night_cho_pct deve ser ≤ 30%. 
Se o dia seguinte tem treino LEVE ou MODERADO na fase de BASE → night_cho_pct normal (30-35%).
NUNCA faça carb-loading na noite anterior a um dia de descanso.

═══════════════════════════════════════════════════════════
REGRA POR FASE — QUANDO CARB-LOADING É JUSTIFICADO:
═══════════════════════════════════════════════════════════

**FASE BASE:**
- Carb-loading NÃO é necessário. Priorizar adaptações mitocondriais.
- Aumento moderado de CHO noturno (máx 35%) SOMENTE se amanhã há treino >90min E alta intensidade.
- Para treinos longos de BAIXA intensidade: NÃO fazer carb-loading. Usar train-low.
- Para treinos leves/moderados: distribuição equilibrada ou train-low.
- Dia de treino matinal na Base: o CHO principal vai no ALMOÇO (recovery), não na noite (pois o treino já passou).
- Dia pré Day Off: ↓CARB à noite. Oportunidade de sleep-low ou simplesmente reduzir.

**FASE ESPECÍFICA:**
- Carb-loading moderado permitido antes de treinos intensos/longos (>90min).
- Aumento noturno (35-40%) justificado se amanhã há treino intenso pela manhã.
- Train-low ainda pode ser usado antes de treinos leves.

**FASE COMPETITIVA:**
- Carb-loading mais agressivo antes de treinos-chave e simulados de prova.
- Aumento noturno (40-45%) justificado antes de treinos intensos/longos.
- Reduzir train-low. Priorizar disponibilidade de substrato.

**FASE PICO:**
- Carb-loading máximo nos últimos 2-3 dias pré-prova (8-12 g/kg).
- Train-low PROIBIDO.
- Máxima disponibilidade de glicogênio.

**TRANSIÇÃO:**
- Similar à Base. CHO baixo. Sem carb-loading.

═══════════════════════════════════════════════════════════
LÓGICA DO DIA DE TREINO MATINAL (atleta corre de manhã):
═══════════════════════════════════════════════════════════

Se o atleta treinou de MANHÃ, o restante do dia é PÓS-TREINO:
- O almoço é a principal refeição de RECOVERY.
- A tarde e noite devem ser orientadas pelo DIA SEGUINTE:
  → Se amanhã é Day Off: ↓CARB à noite, CEIA PROT., possível sleep-low.
  → Se amanhã é treino leve (Base): =CARB ou ↓CARB à noite.
  → Se amanhã é treino intenso: ↑CARB à noite (carb-loading justificado se a fase permitir).

NÃO faz sentido manter CHO alto à noite se o treino do dia já passou E amanhã é descanso.

═══════════════════════════════════════════════════════════
REGRAS DE DISTRIBUIÇÃO INTRA-DIA
═══════════════════════════════════════════════════════════

REGRA — DISTRIBUIÇÃO PERCENTUAL (morning_cho_pct + afternoon_cho_pct + night_cho_pct = 100):
- "morning" = Café da manhã + Lanche da manhã
- "afternoon" = Almoço + Lanche da tarde
- "night" = Jantar + Ceia

Cenários de distribuição:
- Treino HOJE de manhã + amanhã é OFF: morning 30% | afternoon 45% (recovery) | night 25%
- Treino HOJE de manhã + amanhã treino intenso manhã: morning 25% | afternoon 35% | night 40%
- Treino HOJE à tarde + amanhã OFF: morning 30% | afternoon 40% | night 30%
- Day Off + amanhã treino intenso manhã (fase específica+): morning 25% | afternoon 30% | night 45%
- Day Off + amanhã treino intenso manhã (fase BASE): morning 30% | afternoon 35% | night 35%
- Day Off + amanhã OFF: morning 33% | afternoon 34% | night 33%
- Day Off geral: distribuição equilibrada (33/34/33)

REGRA — TIMING PRÉ-TREINO POR TURNO:
- Treino pela MANHÃ: pré-treino = snack leve 40-60min antes. Carga principal de CHO veio na noite anterior (se justificado pela fase).
- Treino pela TARDE: pré-treino = almoço reforçado 2-3h antes ou snack 40-60min antes.
- Treino pela NOITE: pré-treino = lanche da tarde 2-3h antes.

REGRA — PÓS-TREINO E RECUPERAÇÃO (fase-dependente):
- FASE BASE: Recovery reduzido (↑PROT, ↑FAT, ↓CARB). Buscar adaptações mitocondriais.
- FASE ESPECÍFICA: Recovery progressivo. CHO moderado pós-treino.
- FASE COMPETITIVA/PICO: Recovery COMPLETO e imediato (4:1 CHO:Prot).

REGRA — CHO g/kg POR DIA:
- Descanso / Day Off: 2-3 g/kg
- Treino leve (<60min, baixa intensidade): 3-4 g/kg
- Treino moderado (60-90min, moderado): 4-5 g/kg
- Treino intenso/longo (>90min ou alta intensidade): 5-7 g/kg
- Treino muito intenso/intervalado (>90min + alta intensidade): 6-8 g/kg
- Dia pré-prova ou carb-loading (só fase Pico): 8-12 g/kg

AJUSTES POR FASE:
- Base: usar o limite INFERIOR das faixas. Ex: treino moderado = 4 g/kg, não 5. Day Off = 2-2.5 g/kg.
- Específica: usar o meio das faixas.
- Competitiva: usar limite SUPERIOR.
- Pico: usar faixas máximas.
- Transição: usar faixas baixas, semelhante à base.

REGRA — ADAPTAÇÕES MITOCONDRIAIS NA BASE:
Na fase Base, treinos LEVES e LONGOS de baixa intensidade são oportunidades para:
- Treinar em jejum (fasted morning training)
- Reduzir CHO intra-treino para estimular oxidação lipídica
- Aplicar sleep-low na noite anterior a treinos LEVES (nunca antes de Day Off sem propósito)
- CHO g/kg pode ser 3-4g/kg mesmo em treinos longos SE a intensidade for baixa

REGRA — PROGRESSÃO ENTRE FASES:
Base → Específica → Competitiva → Pico:
- CHO total g/kg AUMENTA progressivamente
- Recovery pós-treino MELHORA progressivamente
- Métodos train-low DIMINUEM progressivamente
- Na Base: priorizar adaptação (tolerar desconforto metabólico)
- Na Competitiva: priorizar performance (suprimir qualquer limitação nutricional)`;

    const userPrompt = `FASE ATUAL: ${phase.phase_name}
OBJETIVO DA FASE: ${phase.objective || 'Não definido'}
CHO RANGE DA FASE: ${phase.cho_range || '3-6 g/kg'}
TRAIN-LOW: ${phase.train_low_strategy || 'permitido'}

SESSÕES DA SEMANA:
${sessionsText}

${athleteInfo ? `DADOS DO ATLETA:
Peso: ${athleteInfo.weight || '?'}kg
Objetivo: ${athleteInfo.goal || '?'}` : ''}

INSTRUÇÃO CRÍTICA: Para CADA dia, analise o contexto do dia anterior e do dia seguinte informado acima.
⚠️ Se o dia seguinte é Descanso/Day Off, NÃO aumente o CHO à noite. Reduza ou mantenha equilibrado.
⚠️ Se o treino do dia já passou (treino matinal) e amanhã é Day Off, o foco é recovery no almoço e ↓CARB à noite.
⚠️ Carb-loading noturno SOMENTE se amanhã tem treino intenso/longo E a fase justifica (Específica em diante, ou >90min + alta intensidade na Base).

Gere a dinâmica nutricional para os 7 dias.

FORMATO DE RESPOSTA — ULTRA-CURTO E PRÁTICO:
Todas as orientações (pre_training, intra_training, post_training, night_guidance) devem ser CÓDIGOS CURTOS, não frases longas.

Use este padrão de linguagem:
- "↑CARB" = aumentar carboidrato  |  "↓CARB" = reduzir carboidrato  |  "=CARB" = normo carb
- "↑PROT" = aumentar proteína  |  "↓PROT" ou "=PROT"
- "↑FAT" = mais gordura (ex: abacate, nuts)
- "JEJUM" = treino em jejum
- "SLEEP-LOW" = protocolo sleep-low
- "GEL 30-60g/h" = suplementação intra com dose
- "RECOVERY 4:1" = protocolo recovery
- "SNACK 40min" = snack leve 40min antes
- "CAFÉ REFORÇ." = café da manhã reforçado
- "ALM. ↑CARB" = almoço com mais carb
- "CEIA PROT." = ceia proteica (caseína)
- "N/A" = não aplicável

Exemplos de como deve ser:
- pre_training: "SNACK 40min: banana + mel" (máx 6 palavras)
- intra_training: "GEL 30g/h" ou "Água" ou "" (vazio se <60min)
- post_training: "RECOVERY 4:1 em 30min" ou "↓CARB, só PROT" ou "N/A"
- night_guidance: "↑CARB — prep treino manhã" ou "SLEEP-LOW" ou "=CARB, CEIA PROT."
- distribution_rationale: máx 10 palavras. Ex: "Prep treino intenso manhã seguinte" ou "Recovery + prep day off"

REGRAS:
1. cho_gkg: número decimal (ex: 4.5)
2. cho_classification: High, Medium, Low ou Recovery
3. morning_cho_pct + afternoon_cho_pct + night_cho_pct = 100
4. DIAS DE DESCANSO (Day Off): pre_training="", intra_training="", post_training="". Apenas night_guidance.
5. NÃO escreva frases explicativas. Apenas códigos práticos e diretos.

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
