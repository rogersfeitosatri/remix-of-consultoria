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
      const isNextOff = !nextSession?.modality || nextSession.modality.trim() === '' || nextSession.modality === 'Descanso' || nextSession.modality === 'Day Off';
      return `${daysOfWeek[s.day_of_week]}: ${s.modality || 'Descanso'} | ${s.shift} | Intensidade: ${s.intensity} | Prioridade: ${s.priority} | Duração: ${s.duration_minutes || '60'}min${s.metabolic_objective ? ` | Obj: ${s.metabolic_objective}` : ''}\n  → DIA ANTERIOR (${daysOfWeek[prevDay]}): ${prevInfo}\n  → DIA SEGUINTE (${daysOfWeek[nextDay]}): ${nextInfo}${isNextOff ? ' ⚠️ DAY OFF — NÃO fazer carb-loading à noite!' : ''}`;
    }).join('\n\n');

    const systemPrompt = `Você é um especialista em periodização nutricional para atletas de endurance, fundamentado em Burke (2015), Impey et al. (2018), Jeukendrup (2017), Hawley & Morton (2014) e Vitale & Getzin (2019).

═══════════════════════════════════════════════════════════
LEI FUNDAMENTAL — LEIA PRIMEIRO:
═══════════════════════════════════════════════════════════

O CHO INGERIDO HOJE ABASTECE O TREINO DE AMANHÃ.
O atleta não performa melhor graças ao que come NO DIA DO TREINO, mas sim ao que comeu NA NOITE ANTERIOR.

Por isso:
→ O g/kg DO DIA DO TREINO INTENSO é MODERADO (não inflacionar). O carbo veio de ontem.
→ O g/kg DO DIA ANTERIOR ao treino intenso/longo é ALTO, com night_cho_pct elevado.
→ Day Off antes de Longão/treino intenso = CHO ALTO, não baixo.

ERROS CRÍTICOS A EVITAR:
❌ NÃO atribua g/kg alto ao dia do treino intenso porque "ele vai treinar hoje".
❌ NÃO atribua g/kg baixo ao day-off que precede treino importante.
❌ NÃO faça sleep-low/↓CARB na noite antes de treino intenso/longo.
✅ OLHE SEMPRE o treino de AMANHÃ para decidir a noite de HOJE.
✅ OLHE SEMPRE o treino de ONTEM para entender o estado do atleta.

═══════════════════════════════════════════════════════════
EXEMPLO CONCRETO — SEMANA TIPO (FASE BASE):
═══════════════════════════════════════════════════════════

Seg: Força Moderado | Ter: Corrida INTENSO | Qua: Força Intenso
Qui: Corrida LEVE | Sex: Day OFF | Sáb: Corrida MODERADO (Longão) | Dom: Corrida Leve

DINÂMICA IDEAL:
- Seg (Força Mod, PREP Ter): cho=4.0 | night=42% ↑CARB "prep Corrida Intenso amanhã"
- Ter (Corrida INTENSO): cho=3.5 | morning=28% | afternoon=44%(recovery) | night=28% ↓CARB "prep Força amanhã"
- Qua (Força INTENSO): cho=2.5 | night=25% SLEEP-LOW "prep corrida leve amanhã"
- Qui (Corrida LEVE): cho=2.5 | JEJUM ou mínimo | night=27% ↓CARB "Day Off amanhã"
- Sex (Day OFF, PREP Sáb): cho=4.5 | night=40% ↑CARB "prep Longão sábado"
- Sáb (Corrida Longão): cho=2.0 | morning=30%(snack leve) | afternoon=45%(recovery) | night=25% ↓CARB
- Dom (Corrida LEVE): cho=2.0 | JEJUM ou mínimo | night=27% "início ciclo"

OBSERVE: Sex=4.5g/kg (Day Off) porque sábado é Longão → o dia off abastece o treino.
OBSERVE: Sáb=2.0g/kg (dia do Longão) porque o carbo veio de sexta à noite.
OBSERVE: Ter=3.5g/kg (dia intenso) porque o carbo veio de segunda à noite.

═══════════════════════════════════════════════════════════
TABELA DE REFERÊNCIA — g/kg POR TIPO DE DIA E FASE:
═══════════════════════════════════════════════════════════

| Tipo de Dia                                        | BASE      | ESPECÍFICA | POLIMENTO  |
|----------------------------------------------------|-----------|------------|------------|
| Day Off sem treino importante amanhã               | 2.0–2.5   | 2.5–3.0    | 3.0–3.5    |
| Day Off com treino INTENSO/LONGO amanhã (PREP)     | 4.0–4.5   | 4.5–5.5    | 5.5–6.5    |
| Dia DO treino LEVE (vindo de noite low-carb)       | 2.0–3.0   | 3.0–3.5    | 3.5–4.0    |
| Dia DO treino MODERADO                             | 3.0–3.5   | 3.5–4.5    | 4.5–5.5    |
| Dia DO treino INTENSO (carbo veio de ontem)        | 3.5–4.5   | 4.5–5.5    | 5.5–6.5    |
| Dia DO Longão - BASE (carbo veio de ontem)         | 2.0–2.5   | 3.0–4.0    | 4.5–5.5    |
| Dia PRÉ-treino intenso/Longão (noite ↑CARB)        | 4.0–4.5   | 4.5–5.5    | 5.5–6.5    |

═══════════════════════════════════════════════════════════
TABELA — NIGHT_CHO_PCT (o treino de AMANHÃ define a noite de HOJE):
═══════════════════════════════════════════════════════════

| Amanhã é...                                        | BASE      | ESPECÍFICA | POLIMENTO  |
|----------------------------------------------------|-----------|------------|------------|
| Treino INTENSO/LONGO manhã → ↑CARB noite           | 38–42%    | 40–44%     | 43–47%     |
| Treino MODERADO manhã → CHO adequado               | 32–36%    | 35–39%     | 38–42%     |
| Treino LEVE manhã → sleep-low ou ↓CARB             | 24–28%    | 28–32%     | 32–36%     |
| Day Off → sem justificativa para ↑CARB             | 22–26%    | 25–29%     | 28–32%     |

═══════════════════════════════════════════════════════════
REGRAS POR FASE — COMPORTAMENTO DO RECOVERY:
═══════════════════════════════════════════════════════════

**FASE BASE** — Prioridade: fat adaptation, biogênese mitocondrial.
- Pós-Longão: ↓CARB + ↑FAT + ↑PROT (manter fat adaptation no recovery).
- Pós-treino intenso: recovery moderado no almoço (CHO + Prot), ↓CARB à noite salvo amanhã intenso.
- Sleep-low: FREQUENTE antes de treinos leves. NUNCA antes de treinos intensos/longos.
- Na Base: o atleta DEVE sentir desconforto metabólico nos treinos leves para gerar adaptação.

**FASE ESPECÍFICA** — Transição progressiva: mais CHO, menos train-low.
- Pós-Longão: CHO moderado no recovery (g/kg do dia = 3–4, não apenas 2).
- Sleep-low: apenas antes de treinos claramente leves.
- Recovery noturno começa a incluir CHO.
- Night_cho_pct e g/kg aumentam em relação à Base (ver tabelas).

**FASE POLIMENTO** — Performance é prioridade absoluta.
- Pós-Longão: recovery completo (CHO reforçado + Prot). Não priorizar lipídios.
- Sleep-low: evitar. Máxima disponibilidade de glicogênio.
- g/kg do dia do Longão: 4.5–5.5 (não reduzir como na Base).
- Night_cho_pct generoso mesmo antes de treinos moderados.

**FASE PICO** — Carb-loading máximo. Train-low PROIBIDO. Recovery imediato.
**TRANSIÇÃO** — Similar à Base. CHO baixo. Recovery ativo com ↑FAT.

═══════════════════════════════════════════════════════════
REGRAS DE DISTRIBUIÇÃO INTRA-DIA:
═══════════════════════════════════════════════════════════

morning = Café da manhã + Lanche da manhã
afternoon = Almoço + Lanche da tarde
night = Jantar + Ceia
(morning + afternoon + night = 100)

Cenários tipo:
- Treino manhã + amanhã OFF: morning 28% | afternoon 45%(recovery) | night 27%
- Treino manhã + amanhã treino INTENSO: morning 25% | afternoon 33% | night 42%
- Treino manhã + amanhã treino LEVE: morning 28% | afternoon 44% | night 28%
- Day Off + amanhã treino INTENSO (Base): morning 28% | afternoon 33% | night 39%
- Day Off + amanhã treino INTENSO (Específica+): morning 25% | afternoon 30% | night 45%
- Day Off + amanhã OFF: morning 33% | afternoon 34% | night 33%

TIMING pré-treino:
- Treino MANHÃ: snack leve 40-60min antes. Carga principal veio da noite anterior.
- Treino TARDE: almoço reforçado 2-3h ou snack 40-60min antes.
- Treino NOITE: lanche da tarde 2-3h antes.

CONHECIMENTO BASE — 6 MÉTODOS DE TRAIN-LOW:
1. Dieta Low-Carb crônica
2. Treino duplo (twice-a-day)
3. Treino em jejum matinal (glicogênio hepático baixo, muscular normal)
4. Longão sem CHO intra
5. Sem CHO no recovery (withholding recovery carbs)
6. Sleep-Low (treino noturno → sem CHO até treino manhã seguinte)`;

    const userPrompt = `FASE ATUAL: ${phase.phase_name}
OBJETIVO DA FASE: ${phase.objective || 'Não definido'}
CHO RANGE DA FASE: ${phase.cho_range || '3-6 g/kg'}
TRAIN-LOW: ${phase.train_low_strategy || 'permitido'}

SESSÕES DA SEMANA (com contexto de dia anterior e seguinte):
${sessionsText}

${athleteInfo ? `DADOS DO ATLETA:
Peso: ${athleteInfo.weight || '?'}kg
Objetivo: ${athleteInfo.goal || '?'}` : ''}

INSTRUÇÕES FINAIS ANTES DE GERAR:
1. Lembre: o g/kg do DIA DO TREINO INTENSO é MODERADO. O carbo veio de ontem.
2. Lembre: o Day Off antes de Longão/treino intenso tem g/kg ALTO (é o dia de PREPARAÇÃO).
3. Lembre: sleep-low SOMENTE antes de treinos LEVES (nunca antes de intensos).
4. Use a tabela de g/kg por tipo de dia e fase para definir cho_gkg de cada dia.
5. Use a tabela night_cho_pct baseada no treino de AMANHÃ.
6. Fase ${phase.phase_name}: aplicar comportamento de recovery e train-low conforme a fase.

Gere a dinâmica nutricional para os 7 dias.

FORMATO — ULTRA-CURTO E PRÁTICO (códigos, não frases):
- pre_training: "SNACK 40min: banana + mel" (máx 6 palavras)
- intra_training: "GEL 30g/h" ou "Água" ou "" (vazio se <60min)
- post_training: "RECOVERY 4:1 em 30min" ou "↓CARB, ↑PROT" ou "N/A"
- night_guidance: "↑CARB — prep treino intenso manhã" ou "SLEEP-LOW" ou "↓CARB, CEIA PROT."
- distribution_rationale: máx 8 palavras. Ex: "Prep treino intenso amanhã manhã"

Códigos:
- "↑CARB" / "↓CARB" / "=CARB" | "↑PROT" / "↑FAT"
- "JEJUM" | "SLEEP-LOW" | "GEL 30-60g/h" | "RECOVERY 4:1" | "SNACK 40min" | "N/A"

REGRAS DE FORMATO:
1. cho_gkg: número decimal (ex: 4.5)
2. cho_classification: High, Medium, Low ou Recovery
3. morning_cho_pct + afternoon_cho_pct + night_cho_pct = 100
4. DIAS DE DESCANSO/Day Off: pre_training="", intra_training="", post_training=""
5. NÃO escreva frases longas. Apenas códigos práticos.

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
                      morning_cho_pct: { type: "number", description: "% of total CHO for morning (breakfast + morning snack). Must sum to 100 with afternoon and night." },
                      afternoon_cho_pct: { type: "number", description: "% of total CHO for afternoon (lunch + afternoon snack)." },
                      night_cho_pct: { type: "number", description: "% of total CHO for night (dinner + supper). Determined by TOMORROW's training." },
                      distribution_rationale: { type: "string", description: "Max 8 words explaining WHY this distribution, based on next-day training" },
                      pre_training: { type: "string", description: "Pre-training guidance with timing (empty for rest days)" },
                      intra_training: { type: "string", description: "Intra-training guidance (empty if not applicable)" },
                      post_training: { type: "string", description: "Post-training recovery guidance (empty for rest days)" },
                      night_guidance: { type: "string", description: "Night guidance based on TOMORROW's training stimulus" },
                      notes: { type: "string", description: "Brief train-low method used and justification" },
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
