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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    const sessionsByDay: Record<number, any> = {};
    sessions.forEach((s: any) => { sessionsByDay[s.day_of_week] = s; });

    // Build carb-loading map: which days BEFORE a long run need carb-loading
    const carbLoadingDays: Record<number, { targetDay: string; hours: number }> = {};
    sessions.forEach((s: any) => {
      if (s.is_long_run && s.carb_loading_enabled && s.carb_loading_hours) {
        const hours = s.carb_loading_hours;
        // 24h = 1 day before, 48h = 2 days before
        const daysBack = hours === 48 ? 2 : 1;
        for (let d = 1; d <= daysBack; d++) {
          const prepDay = (s.day_of_week - d + 7) % 7;
          carbLoadingDays[prepDay] = {
            targetDay: daysOfWeek[s.day_of_week],
            hours,
          };
        }
      }
    });

    const sessionsText = sessions.map((s: any) => {
      const nextDay = (s.day_of_week + 1) % 7;
      const prevDay = (s.day_of_week + 6) % 7;
      const nextSession = sessionsByDay[nextDay];
      const prevSession = sessionsByDay[prevDay];
      const nextInfo = nextSession
        ? `${nextSession.modality || 'Descanso'} | ${nextSession.shift} | Int: ${nextSession.intensity} | Dur: ${nextSession.duration_minutes || '60'}min${nextSession.is_long_run ? ' 🏃 LONGÃO' : ''}`
        : 'Descanso';
      const prevInfo = prevSession
        ? `${prevSession.modality || 'Descanso'} | ${prevSession.shift} | Int: ${prevSession.intensity}`
        : 'Descanso';
      const isNextOff = !nextSession?.modality || nextSession.modality.trim() === '' || nextSession.modality === 'Descanso' || nextSession.modality === 'Day Off';
      
      let longRunTag = '';
      if (s.is_long_run) {
        longRunTag = ` 🏃 LONGÃO`;
        if (s.carb_loading_enabled) {
          longRunTag += ` | CARB-LOADING ${s.carb_loading_hours}h ANTES (NÃO no dia!)`;
        }
      }
      
      const carbLoadPrep = carbLoadingDays[s.day_of_week];
      let prepTag = '';
      if (carbLoadPrep) {
        prepTag = `\n  ⚡ CARB-LOADING OBRIGATÓRIO: este dia é DIA DE PREPARAÇÃO para Longão de ${carbLoadPrep.targetDay} (${carbLoadPrep.hours}h antes). CHO ALTO + night_cho_pct ELEVADO.`;
      }

      return `${daysOfWeek[s.day_of_week]}: ${s.modality || 'Descanso'} | ${s.shift} | Intensidade: ${s.intensity} | Prioridade: ${s.priority} | Duração: ${s.duration_minutes || '60'}min${longRunTag}${s.metabolic_objective ? ` | Obj: ${s.metabolic_objective}` : ''}\n  → DIA ANTERIOR (${daysOfWeek[prevDay]}): ${prevInfo}\n  → DIA SEGUINTE (${daysOfWeek[nextDay]}): ${nextInfo}${isNextOff ? ' ⚠️ DAY OFF — NÃO fazer carb-loading à noite!' : ''}${prepTag}`;
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

═══════════════════════════════════════════════════════════
REGRA CRÍTICA — CARB-LOADING PARA LONGÃO:
═══════════════════════════════════════════════════════════

O CARB-LOADING para treinos longos (longão) acontece EXCLUSIVAMENTE nos dias ANTERIORES, 
NUNCA no dia do treino longo em si.

QUANDO O ADMIN MARCA UM TREINO COMO "LONGÃO" COM CARB-LOADING:
- Se carb-loading 24h: O DIA ANTERIOR ao longão recebe g/kg ALTO e night_cho_pct ELEVADO
- Se carb-loading 48h: Os 2 DIAS ANTERIORES ao longão recebem g/kg ALTO e night_cho_pct ELEVADO

O DIA DO LONGÃO em si:
- Na FASE BASE: g/kg BAIXO (2.0-2.5), foco em fat adaptation
  - morning: snack leve 40-60min antes
  - afternoon: recovery com ↓CARB, ↑FAT, ↑PROT
  - night: ↓CARB (sleep-low se amanhã é leve/off)
- Na FASE ESPECÍFICA: g/kg MODERADO (3.0-4.0)
- Na FASE POLIMENTO: g/kg MODERADO-ALTO (4.5-5.5)

❌ ERRO CRÍTICO: Atribuir g/kg alto AO DIA DO LONGÃO. O carbo já foi carregado antes!
✅ CORRETO: O carb-loading está nos dias de PREPARAÇÃO, o dia do longão usa o glicogênio já estocado.

Os dias marcados como "CARB-LOADING OBRIGATÓRIO" nas sessões DEVEM ter:
- g/kg elevado conforme a tabela de referência (linha "Dia PRÉ-treino intenso/Longão")
- night_cho_pct elevado (38-47% conforme fase)
- night_guidance com "↑CARB — prep Longão [dia]"

═══════════════════════════════════════════════════════════
ERROS CRÍTICOS A EVITAR:
═══════════════════════════════════════════════════════════

❌ NÃO atribua g/kg alto ao dia do treino intenso porque "ele vai treinar hoje".
❌ NÃO atribua g/kg baixo ao day-off que precede treino importante.
❌ NÃO faça sleep-low/↓CARB na noite antes de treino intenso/longo.
❌ NÃO faça carb-loading NO DIA DO LONGÃO. O carbo vem dos dias anteriores!
✅ OLHE SEMPRE o treino de AMANHÃ para decidir a noite de HOJE.
✅ OLHE SEMPRE o treino de ONTEM para entender o estado do atleta.
✅ OLHE os marcadores de CARB-LOADING OBRIGATÓRIO nas sessões.

═══════════════════════════════════════════════════════════
EXEMPLO CONCRETO — SEMANA COM LONGÃO SÁBADO (CARB-LOADING 24h, FASE BASE):
═══════════════════════════════════════════════════════════

Seg: Força Moderado | Ter: Corrida INTENSO | Qua: Força Intenso
Qui: Corrida LEVE | Sex: Day OFF ⚡CARB-LOADING | Sáb: Corrida Longão 🏃 | Dom: Corrida Leve

DINÂMICA IDEAL:
- Seg (Força Mod, PREP Ter): cho=4.0 | night=42% ↑CARB "prep Corrida Intenso amanhã"
- Ter (Corrida INTENSO): cho=3.5 | morning=28% | afternoon=44%(recovery) | night=28% ↓CARB
- Qua (Força INTENSO): cho=2.5 | night=25% SLEEP-LOW "prep corrida leve amanhã"
- Qui (Corrida LEVE): cho=2.5 | JEJUM ou mínimo | night=27% ↓CARB
- Sex (Day OFF ⚡CARB-LOADING): cho=4.5 | night=42% ↑CARB "CARB-LOADING prep Longão sábado"
- Sáb (Corrida Longão): cho=2.0 | morning=30%(snack leve) | afternoon=45%(recovery ↓CARB ↑FAT ↑PROT) | night=25% ↓CARB
- Dom (Corrida LEVE): cho=2.0 | JEJUM ou mínimo | night=27%

OBSERVE: Sex=4.5g/kg (Day Off COM carb-loading) porque sábado é Longão → preparação.
OBSERVE: Sáb=2.0g/kg (dia do Longão) porque o carbo veio de sexta à noite. Recovery com ↓CARB na Base.

═══════════════════════════════════════════════════════════
EXEMPLO — LONGÃO COM CARB-LOADING 48h (FASE BASE):
═══════════════════════════════════════════════════════════

Se longão é Sábado com carb-loading 48h:
- Qui: cho=4.0 ⚡CARB-LOADING dia 1 | night=40% ↑CARB "prep Longão sáb, dia 1 de 2"
- Sex: cho=4.5 ⚡CARB-LOADING dia 2 | night=42% ↑CARB "prep Longão sáb, dia 2 de 2"
- Sáb: cho=2.0 (longão, usa glicogênio estocado)

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
| Dia CARB-LOADING (marcado pelo admin)              | 4.0–5.0   | 5.0–6.0    | 6.0–7.0    |

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

**FASE ESPECÍFICA** — Transição progressiva: mais CHO, menos train-low.
- Pós-Longão: CHO moderado no recovery.
- Sleep-low: apenas antes de treinos claramente leves.

**FASE POLIMENTO** — Performance é prioridade absoluta.
- Pós-Longão: recovery completo (CHO reforçado + Prot).
- Sleep-low: evitar.

**FASE PICO** — Carb-loading máximo. Train-low PROIBIDO.
**TRANSIÇÃO** — Similar à Base. CHO baixo.

═══════════════════════════════════════════════════════════
REGRAS DE DISTRIBUIÇÃO INTRA-DIA:
═══════════════════════════════════════════════════════════

morning = Café da manhã + Lanche da manhã
afternoon = Almoço + Lanche da tarde
night = Jantar + Ceia
(morning + afternoon + night = 100)

TIMING pré-treino:
- Treino MANHÃ: snack leve 40-60min antes. Carga principal veio da noite anterior.
- Treino TARDE: almoço reforçado 2-3h ou snack 40-60min antes.
- Treino NOITE: lanche da tarde 2-3h antes.`;

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
1. Lembre: o g/kg do DIA DO LONGÃO é BAIXO/MODERADO conforme fase. O carbo-loading foi feito nos dias anteriores.
2. Os dias marcados com ⚡ CARB-LOADING OBRIGATÓRIO DEVEM ter g/kg alto e night_cho_pct elevado.
3. O DIA DO LONGÃO NÃO recebe carb-loading. Ele usa o glicogênio já estocado dos dias anteriores.
4. Sleep-low SOMENTE antes de treinos LEVES (nunca antes de intensos/longos).
5. Use a tabela de g/kg por tipo de dia e fase para definir cho_gkg de cada dia.
6. Use a tabela night_cho_pct baseada no treino de AMANHÃ.
7. Fase ${phase.phase_name}: aplicar comportamento de recovery e train-low conforme a fase.

Gere a dinâmica nutricional para os 7 dias.

FORMATO — ULTRA-CURTO E PRÁTICO (códigos, não frases):
- pre_training: "SNACK 40min: banana + mel" (máx 6 palavras)
- intra_training: "GEL 30g/h" ou "Água" ou "" (vazio se <60min)
- post_training: "RECOVERY 4:1 em 30min" ou "↓CARB, ↑PROT" ou "N/A"
- night_guidance: "↑CARB — prep Longão sáb" ou "SLEEP-LOW" ou "↓CARB, CEIA PROT."
- distribution_rationale: máx 8 palavras. Ex: "CARB-LOADING prep Longão sábado"

Códigos:
- "↑CARB" / "↓CARB" / "=CARB" | "↑PROT" / "↑FAT"
- "JEJUM" | "SLEEP-LOW" | "GEL 30-60g/h" | "RECOVERY 4:1" | "SNACK 40min" | "N/A"

REGRAS DE FORMATO:
1. cho_gkg: número decimal (ex: 4.5)
2. cho_classification: High, Medium, Low ou Recovery
3. morning_cho_pct + afternoon_cho_pct + night_cho_pct = 100
4. DIAS DE DESCANSO/Day Off SEM carb-loading: pre_training="", intra_training="", post_training=""
5. DIAS DE CARB-LOADING (mesmo se Day Off): night_guidance DEVE ter "↑CARB — prep Longão [dia]"
6. NÃO escreva frases longas. Apenas códigos práticos.

Responda usando a tool generate_dynamics.`;

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
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_dynamics",
            description: "Generate weekly nutritional dynamics with CHO g/kg targets and intra-day distribution based on training stimuli, timing, and periodization phase. Carb-loading for long runs happens BEFORE the long run day, NOT on the day itself.",
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
                      cho_gkg: { type: "number", description: "Total CHO in g/kg for the day" },
                      morning_cho_pct: { type: "number", description: "% of total CHO for morning" },
                      afternoon_cho_pct: { type: "number", description: "% of total CHO for afternoon" },
                      night_cho_pct: { type: "number", description: "% of total CHO for night. On carb-loading days this MUST be high (38-47%)." },
                      distribution_rationale: { type: "string", description: "Max 8 words. On carb-loading days: 'CARB-LOADING prep Longão [dia]'" },
                      pre_training: { type: "string", description: "Pre-training guidance (empty for rest days without carb-loading)" },
                      intra_training: { type: "string", description: "Intra-training guidance" },
                      post_training: { type: "string", description: "Post-training recovery guidance" },
                      night_guidance: { type: "string", description: "Night guidance. On carb-loading days: '↑CARB — prep Longão [dia]'" },
                      notes: { type: "string", description: "Brief justification" },
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
