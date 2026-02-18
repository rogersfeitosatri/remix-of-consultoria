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
PRINCÍPIO FUNDAMENTAL: O CHO DO DIA SERVE AO TREINO DO DIA SEGUINTE
═══════════════════════════════════════════════════════════

A disponibilidade de glicogênio para um treino matinal depende do CHO ingerido NA NOITE ANTERIOR.
Portanto: o planejamento de CHO de cada dia é orientado principalmente pelo ESTÍMULO DO DIA SEGUINTE.

ANTES DE DECIDIR A DISTRIBUIÇÃO DE CADA DIA, VOCÊ DEVE:
1. Identificar o TREINO DO DIA SEGUINTE (esse é o driver principal da noite)
2. Identificar o TREINO DO DIA (para guiar pré, intra e pós-treino, e o g/kg total)
3. Identificar o TREINO DO DIA ANTERIOR (para entender o estado de recovery)
4. Aplicar as regras abaixo COM BASE NESSES 3 DADOS CONCRETOS

═══════════════════════════════════════════════════════════
REGRA CRÍTICA — CARB-LOADING NOTURNO (PREPARAÇÃO PARA O DIA SEGUINTE):
═══════════════════════════════════════════════════════════

A noite de HOJE prepara o glicogênio para o TREINO DE AMANHÃ.

✅ AUMENTAR CHO à noite (night_cho_pct 38-45%) quando:
   - Amanhã tem treino INTENSO ou LONGO pela MANHÃ (>90min OU alta intensidade)
   - A fase justifica (Específica → sem restrição; Base → apenas se >90min + alta intensidade)

⛔ REDUZIR ou manter CHO BAIXO à noite quando:
   - Amanhã é Day Off ou Descanso → night_cho_pct ≤ 28% (sleep-low ou ↓CARB)
   - Amanhã tem treino LEVE ou MODERADO (Base): night_cho_pct 28-33% (possível sleep-low)
   - Amanhã tem treino leve: oportunidade de treinar com glicogênio baixo (adaptação mitocondrial)

NUNCA faça carb-loading na noite anterior a um dia de descanso.
NUNCA reduza o CHO da noite se amanhã é treino intenso pela manhã.

═══════════════════════════════════════════════════════════
REGRA ESPECIAL — DIA ANTES DO LONGÃO (FASE BASE):
═══════════════════════════════════════════════════════════

Longão = treino longo de baixa-moderada intensidade (corrida >60-90min, baixa intensidade).

**DIA ANTERIOR ao Longão (noite):**
- night_cho_pct: 35-40% (pequeno carb-loading para suportar a duração)
- cho_gkg: usar faixa superior do dia (ex: se é treino moderado, usar 4.5-5 g/kg)
- night_guidance: "↑CARB — prep Longão amanhã manhã"

**DIA DO LONGÃO (Base):**
- cho_gkg: REDUZIR em relação ao dia anterior. Ex: 2-3 g/kg.
  → O carb principal já veio na noite anterior. Pós-Longão na Base = ↓CARB para estimular metabolismo lipídico.
- morning: snack leve pré-treino (banana + mel)
- intra: Água ou solução hipotônica (Base = oportunidade de train-low intra)
- post_training: ↓CARB, ↑PROT, ↑FAT (recovery com gordura na fase Base)
- night_guidance: orientado pelo dia SEGUINTE ao Longão

EXEMPLO CONCRETO (fase Base):
- Sexta (dia antes do Longão sábado): cho_gkg=4.5, night_cho_pct=38%, night_guidance="↑CARB — prep Longão sábado"
- Sábado (Longão manhã): cho_gkg=2.0-2.5, morning=30%(snack leve), afternoon=42%(almoço pós-treino), night=28%(orientado por domingo)
- Se domingo é Day Off: sábado à noite → ↓CARB ainda mais, sleep-low

═══════════════════════════════════════════════════════════
REGRA — TREINO INTENSO MATINAL VS. TREINO LEVE MATINAL (FASE BASE):
═══════════════════════════════════════════════════════════

**Treino INTENSO pela MANHÃ (corrida intervalada, alta intensidade):**
- A noite ANTERIOR deve ter CHO ELEVADO (carb-loading na noite de ontem)
- O dia do treino intenso: cho_gkg moderado (4-5 g/kg em Base), pois o principal veio da noite anterior
- Pré-treino: snack leve 40-60min antes (banana, torrada + mel)
- Pós-treino: ↑PROT + CHO moderado no almoço (recovery ativo)
- Noite do dia do treino intenso: orientar pelo DIA SEGUINTE

**Treino LEVE pela MANHÃ (corrida fácil, curta, <60min, baixa intensidade):**
- A noite ANTERIOR pode ter CHO BAIXO (sleep-low → treinar com glicogênio parcialmente depletado)
- Isso estimula adaptações mitocondriais (fat oxidation ↑)
- Pré-treino: pode ser em JEJUM ou snack mínimo
- Pós-treino: recovery com ↑PROT, ↑FAT, ↓CARB (Base)
- cho_gkg do dia: 2.5-3.5 g/kg

**ERRO A EVITAR:** NÃO aplique sleep-low antes de treino intenso. NÃO faça carb-loading antes de treino leve.

═══════════════════════════════════════════════════════════
REGRA POR FASE — CHO g/kg E COMPORTAMENTO GERAL:
═══════════════════════════════════════════════════════════

**FASE BASE:**
- Prioridade: adaptações mitocondriais, metabolismo lipídico, eficiência metabólica
- Day Off: 2-2.5 g/kg
- Treino leve: 2.5-3.5 g/kg
- Treino moderado: 3.5-4.5 g/kg
- Treino intenso/longo: 4-5 g/kg (o CHO do dia do treino intenso é moderado; o carb-loading veio na noite anterior)
- Dia PRÉ-treino intenso/longo: cho_gkg pode ser 4-5 g/kg com night_cho_pct alto
- Longão dia (pós-treino): cho_gkg = 2-3 g/kg (↓CARB para adaptação lipídica)
- Sleep-low: permitido antes de treinos LEVES
- Carb-loading noturno: SOMENTE se amanhã tem treino intenso/longo (>90min + alta intensidade)

**FASE ESPECÍFICA:**
- Carb-loading moderado antes de treinos intensos/longos
- night_cho_pct 35-40% se amanhã tem treino intenso manhã
- cho_gkg: usar meio das faixas padrão
- Train-low ainda aplicável antes de treinos leves

**FASE COMPETITIVA:**
- Carb-loading mais agressivo (40-45% noite)
- Recovery completo e imediato pós-treino
- Train-low reduzido

**FASE PICO:**
- Carb-loading máximo (8-12 g/kg nos últimos 2-3 dias)
- Train-low PROIBIDO

**TRANSIÇÃO:**
- Similar à Base. CHO baixo. Sem carb-loading.

═══════════════════════════════════════════════════════════
LÓGICA DO DIA DE TREINO MATINAL (pós-treino):
═══════════════════════════════════════════════════════════

Se o atleta treinou de MANHÃ:
- Almoço = refeição principal de RECOVERY (maior % de CHO do dia, pós-treino imediato)
- Noite = orientada pelo TREINO DE AMANHÃ:
  → Amanhã é Day Off: ↓CARB noite, CEIA PROT., sleep-low
  → Amanhã treino leve (Base): =CARB ou ↓CARB noite (possível sleep-low)
  → Amanhã treino intenso manhã: ↑CARB noite (carb-loading → fase deve justificar)

═══════════════════════════════════════════════════════════
REGRAS DE DISTRIBUIÇÃO INTRA-DIA
═══════════════════════════════════════════════════════════

REGRA — DISTRIBUIÇÃO PERCENTUAL (morning_cho_pct + afternoon_cho_pct + night_cho_pct = 100):
- "morning" = Café da manhã + Lanche da manhã
- "afternoon" = Almoço + Lanche da tarde
- "night" = Jantar + Ceia

Cenários de distribuição:
- Treino HOJE manhã + amanhã OFF: morning 30% | afternoon 45% (recovery) | night 25%
- Treino HOJE manhã + amanhã treino INTENSO manhã: morning 25% | afternoon 33% | night 42%
- Treino HOJE manhã + amanhã treino LEVE manhã (Base): morning 28% | afternoon 42% | night 30%
- Treino HOJE à tarde + amanhã OFF: morning 30% | afternoon 40% | night 30%
- Day Off + amanhã treino INTENSO manhã (Específica+): morning 25% | afternoon 30% | night 45%
- Day Off + amanhã treino INTENSO manhã (Base): morning 28% | afternoon 33% | night 39%
- Day Off + amanhã treino LEVE manhã (Base): morning 33% | afternoon 37% | night 30%
- Day Off + amanhã OFF: morning 33% | afternoon 34% | night 33%

REGRA — TIMING PRÉ-TREINO POR TURNO:
- Treino pela MANHÃ: pré-treino = snack leve 40-60min antes. Carga principal de CHO veio na noite ANTERIOR.
- Treino pela TARDE: pré-treino = almoço reforçado 2-3h antes ou snack 40-60min antes.
- Treino pela NOITE: pré-treino = lanche da tarde 2-3h antes.

REGRA — PÓS-TREINO E RECUPERAÇÃO (fase-dependente):
- FASE BASE: Recovery com ↑PROT + ↑FAT + ↓CARB. Metabolismo lipídico e adaptação mitocondrial.
- FASE ESPECÍFICA: Recovery progressivo. CHO moderado pós-treino.
- FASE COMPETITIVA/PICO: Recovery COMPLETO e imediato (4:1 CHO:Prot).

REGRA — PROGRESSÃO ENTRE FASES:
Base → Específica → Competitiva → Pico:
- CHO total g/kg AUMENTA progressivamente
- Recovery pós-treino MELHORA progressivamente (mais CHO no pós)
- Métodos train-low DIMINUEM progressivamente
- Na Base: tolerar desconforto metabólico para adaptação
- Na Competitiva: suprimir qualquer limitação nutricional`;

    const userPrompt = `FASE ATUAL: ${phase.phase_name}
OBJETIVO DA FASE: ${phase.objective || 'Não definido'}
CHO RANGE DA FASE: ${phase.cho_range || '3-6 g/kg'}
TRAIN-LOW: ${phase.train_low_strategy || 'permitido'}

SESSÕES DA SEMANA:
${sessionsText}

${athleteInfo ? `DADOS DO ATLETA:
Peso: ${athleteInfo.weight || '?'}kg
Objetivo: ${athleteInfo.goal || '?'}` : ''}

INSTRUÇÃO CRÍTICA: Para CADA dia, a noite de HOJE prepara o glicogênio para o TREINO DE AMANHÃ.

⚠️ REGRA PRINCIPAL: A noite antes de treino INTENSO/LONGO pela manhã = ↑CARB (carb-loading).
⚠️ A noite antes de treino LEVE pela manhã (Base) = ↓CARB ou sleep-low.
⚠️ A noite antes de Day Off = ↓CARB sempre (sleep-low ou simplesmente reduzir).

⚠️ DIA DO LONGÃO (Base): O carb-loading veio NA NOITE ANTERIOR. O cho_gkg DO DIA do longão deve ser MENOR (2-3 g/kg), com recovery pós-treino priorizando ↑PROT + ↑FAT + ↓CARB para estimular metabolismo lipídico e adaptação mitocondrial.

⚠️ DIA ANTERIOR AO LONGÃO: cho_gkg MAIOR (4-5 g/kg em Base), night_cho_pct 35-40%, night_guidance="↑CARB — prep Longão amanhã".

⚠️ NUNCA aplique sleep-low antes de treino intenso/longo. Isso é um erro grave.
⚠️ NUNCA faça carb-loading antes de Day Off ou treino leve (Base).

⚠️ FASE BASE — g/kg corretos:
   - Day Off: 2-2.5 g/kg
   - Dia anterior ao Longão: 4-4.5 g/kg (noite ↑CARB)
   - Dia DO Longão (após treino): 2-2.5 g/kg (↓CARB pós, ↑FAT, metabolismo lipídico)
   - Treino leve manhã: 2.5-3.5 g/kg (possível sleep-low na noite anterior)
   - Treino intenso: 4-5 g/kg (carb-loading veio da noite anterior)

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
