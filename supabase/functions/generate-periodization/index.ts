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
    const { athleteContext, adminInstructions, knowledgeBase, generationType, manualEdits } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const kbContent = (knowledgeBase || [])
      .sort((a: any, b: any) => (b.priority || 3) - (a.priority || 3))
      .map((kb: any) => `[${kb.title}] (tags: ${(kb.tags || []).join(', ')})\n${kb.content}`)
      .join('\n\n---\n\n');

    const typeInstructions: Record<string, string> = {
      full: 'Gere uma periodização nutricional COMPLETA com todas as fases (Base, Transição, Performance, Taper).',
      next_phase: 'Gere apenas a PRÓXIMA FASE da periodização, considerando o estado atual do ciclo.',
      monthly_adjustment: 'Gere apenas o MICROAJUSTE para o próximo mês/consulta.',
      long_run_week: 'Gere o ajuste específico para a SEMANA DO LONGÃO, otimizando pré/durante/pós.',
    };

    const manualEditsContext = manualEdits
      ? `\n\nEDIÇÕES MANUAIS DO NUTRICIONISTA (prioridade máxima, manter):\n${JSON.stringify(manualEdits, null, 2)}`
      : '';

    const systemPrompt = `Você é o Agente Periodiza, um especialista em periodização nutricional para atletas de endurance baseado nas evidências de Louise Burke, Asker Jeukendrup e conceitos de Train Low / Compete High.

REGRAS OBRIGATÓRIAS:
1. Nunca invente dados do atleta. Use apenas o que foi fornecido.
2. Se faltar MLG para calcular EA, use modo "EA estimada" e avise.
3. Sempre proponha Fase 1 (Base), Fase 2 (Transição), Fase 3 (Performance) e Taper.
4. Se semanas até prova < 10, simplificar: Fase 2 → Fase 3 → Taper.
5. Fase 1: CHO ≤ 4g/kg, train-low, jejum estratégico, intra reduzido em treinos fáceis, SEM comprometer treinos-chave.
6. Fase 2: CHO 4-5g/kg, carb-loading 24-48h, intra 40→60g/h, cafeína 3mg/kg, nitrato opcional.
7. Fase 3: CHO ≥ 5g/kg, carb-loading +6g/kg 24-48h, treinar estratégia de prova, intra 60-90g/h.
8. Taper (≤14 dias): reduzir volume, manter CHO alto, ajustar calorias.
9. Sempre calcular/sugerir meta de EA por fase e alertar se EA <30.
10. Se EA <30, corrigir antes de aumentar train-low.

REGRA CRÍTICA — ESTRUTURA SEMANAL BASEADA NOS ESTÍMULOS REAIS:
11. O campo "agenda_treinos_semanal" contém os ESTÍMULOS REAIS de treino do atleta por dia da semana, incluindo zona/intensidade, duração e GEE (Gasto Energético do Exercício) em kcal.
12. A weeklyStructure de CADA FASE deve ser alinhada com esses estímulos reais:
    - Dias com GEE alto (treinos-chave, longão, tiros) → type: "high" com suporte total de CHO, pré-treino adequado e intra-treino.
    - Dias com GEE baixo/moderado (rodagens leves, musculação leve) → type: "low", elegíveis para train-low/jejum estratégico conforme a fase.
    - Dias SEM treino (GEE = 0) → type: "recovery".
13. Nos "notes" de cada dia, REFERENCIE os estímulos específicos do atleta (ex: "Longão MODERADO 90min — GEE 1480kcal → suporte total, intra 60g/h").
14. Adapte a distribuição de CHO intra-dia conforme a demanda energética: dias com GEE > 800 kcal precisam de mais suporte que dias com GEE < 300 kcal.
15. Use o "gee_total_semanal_kcal" para calcular EA semanal e sugerir VCT mínimo por fase.

INSTRUÇÕES DO ADMIN (prioridade alta):
${adminInstructions || 'Nenhuma diretriz definida.'}

BASE DE CONHECIMENTO:
${kbContent || 'Nenhum conteúdo na base de conhecimento.'}
${manualEditsContext}`;

    const userPrompt = `${typeInstructions[generationType] || typeInstructions.full}

CONTEXTO DO ATLETA:
${JSON.stringify(athleteContext, null, 2)}

Responda OBRIGATORIAMENTE em JSON válido seguindo EXATAMENTE este formato:
{
  "phasePlan": [
    {
      "phase": "Fase 1 - Base Metabólica",
      "startWeek": 1,
      "endWeek": 6,
      "targets": {
        "carb_gkg_day_range": "3.0-4.0",
        "protein_gkg_day_range": "1.8-2.2",
        "fat_guidance": "moderada",
        "fiber_guidance": "alta",
        "EA_target_kcal_kgFFM": ">=30"
      },
      "strategies": ["estratégia 1", "estratégia 2"],
      "weeklyStructure": {
        "Mon": {"type":"low","notes":"..."},
        "Tue": {"type":"high","notes":"..."},
        "Wed": {"type":"low","notes":"..."},
        "Thu": {"type":"high","notes":"..."},
        "Fri": {"type":"low","notes":"..."},
        "Sat": {"type":"high","notes":"longão ou treino-chave"},
        "Sun": {"type":"recovery","notes":"..."}
      },
      "checkpoints": ["checkpoint 1", "checkpoint 2"]
    }
  ],
  "monthlyAdjustments": [
    {
      "monthIndex": 1,
      "changes": ["mudança 1"],
      "why": "justificativa"
    }
  ],
  "taperProtocol": {
    "daysOut": 14,
    "carbLoading": {
      "enabled": true,
      "durationHours": 24,
      "carb_gkg_day": 6
    },
    "raceStrategy": {
      "breakfast": "1-2 g/kg 2-3h antes",
      "intraCHO_gph": "60-90",
      "caffeine_mgkg": "3-6 conforme tolerância",
      "sodium_strategy": "individualizado"
    }
  },
  "nutritionistNotes": ["nota 1", "nota 2"]
}

Após o JSON, adicione um separador "---HUMAN_READABLE---" seguido de um resumo em português claro para o nutricionista.`;

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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const fullResponse = data.choices?.[0]?.message?.content || '';

    // Split JSON and human readable
    let jsonPart = fullResponse;
    let humanReadable = '';
    
    const separator = '---HUMAN_READABLE---';
    if (fullResponse.includes(separator)) {
      const parts = fullResponse.split(separator);
      jsonPart = parts[0].trim();
      humanReadable = parts[1].trim();
    }

    // Extract JSON from potential markdown code blocks
    const jsonMatch = jsonPart.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, jsonPart];
    const cleanJson = (jsonMatch[1] || jsonPart).trim();

    let parsedPlan;
    try {
      parsedPlan = JSON.parse(cleanJson);
    } catch {
      // Try to find JSON object in the text
      const objMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (objMatch) {
        parsedPlan = JSON.parse(objMatch[0]);
      } else {
        throw new Error("Não foi possível extrair JSON da resposta da IA");
      }
    }

    return new Response(JSON.stringify({
      plan: parsedPlan,
      humanReadable: humanReadable || 'Resumo não disponível.',
      rawResponse: fullResponse,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("generate-periodization error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
