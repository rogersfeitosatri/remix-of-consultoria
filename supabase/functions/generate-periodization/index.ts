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
    const { athleteContext, adminInstructions, knowledgeBase, generationType, planType, blockSize, weeksToRace, periodStartDate } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const kbContent = (knowledgeBase || [])
      .sort((a: any, b: any) => (b.priority || 3) - (a.priority || 3))
      .map((kb: any) => `[${kb.title}] (tags: ${(kb.tags || []).join(', ')})\n${kb.content}`)
      .join('\n\n---\n\n');

    const typeInstructions: Record<string, string> = {
      full: `Gere uma periodização COMPLETA dividida em blocos de ${blockSize} semanas, de ${periodStartDate} até a prova. Total de ${weeksToRace} semanas.`,
      current_block: `Gere APENAS o bloco atual (próximas ${blockSize} semanas) com a tabela semanal detalhada.`,
      recalculate: `Recalcule a periodização completa usando os dados energéticos atualizados (TMB, GEE, GET, EA).`,
    };

    // Calculate number of blocks and phase distribution
    const numBlocks = Math.ceil(weeksToRace / blockSize);
    let phaseDistribution = '';
    if (numBlocks >= 4) {
      const base = Math.ceil(numBlocks * 0.3);
      const trans = Math.ceil(numBlocks * 0.3);
      const perf = Math.max(numBlocks - base - trans - 1, 1);
      const taper = 1;
      phaseDistribution = `Distribua as fases: ${base} blocos Base Metabólica, ${trans} blocos Transição, ${perf} blocos Performance, ${taper} bloco Taper (últimas 2 semanas).`;
    } else if (numBlocks >= 2) {
      phaseDistribution = `Ciclo curto: distribua entre Transição, Performance e Taper.`;
    } else {
      phaseDistribution = `Ciclo muito curto: foque em Performance e Taper.`;
    }

    const systemPrompt = `Você é o Agente Periodiza, especialista em periodização nutricional para atletas de endurance (Burke, Jeukendrup, Train Low / Compete High).

REGRAS:
1. Nunca invente dados. Use APENAS o que foi fornecido no contexto.
2. Se MLG não estiver disponível, avise que EA não pode ser calculada.
3. Se EA < 30 kcal/kg MLG, ALERTE e ajuste VCT antes de propor train-low.
4. O campo "agenda_treinos_semanal" contém os estímulos REAIS de treino por dia com GEE em kcal.
5. A tabela semanal de CADA bloco deve refletir os estímulos reais:
   - Dias com GEE alto (>600kcal, treinos-chave) → type: "high", suporte total
   - Dias com GEE moderado (200-600kcal) → type: "moderate" ou "low" conforme fase
   - Dias sem treino (GEE=0) → type: "recovery"
6. Adapte CHO g/kg por dia conforme demanda energética.
7. Cada bloco tem ${blockSize} semanas.
8. ${phaseDistribution}
9. Periodicidade: ${planType === '6_weeks' ? 'Consultas a cada 6 semanas — marque semana de ajuste profundo' : 'Consultoria mensal — ajustes a cada 4 semanas'}.

FASES NUTRICIONAIS:
- Base Metabólica: CHO 3-4 g/kg, train-low elegível em dias leves, proteína 1.8-2.2 g/kg
- Transição: CHO 4-5 g/kg, início carb-loading 24h, intra 40→60 g/h, cafeína 3 mg/kg
- Performance: CHO ≥5 g/kg, carb-loading +6 g/kg 24-48h, intra 60-90 g/h, simulação de prova
- Taper: últimas 2 semanas, manter CHO alto, reduzir volume, cuidar peso

INSTRUÇÕES DO ADMIN:
${adminInstructions || 'Nenhuma'}

BASE DE CONHECIMENTO:
${kbContent || 'Nenhuma'}`;

    const userPrompt = `${typeInstructions[generationType] || typeInstructions.full}

CONTEXTO DO ATLETA:
${JSON.stringify(athleteContext, null, 2)}

Responda em JSON VÁLIDO com este formato EXATO:
{
  "blocks": [
    {
      "block_index": 1,
      "date_start": "YYYY-MM-DD",
      "date_end": "YYYY-MM-DD",
      "phase_name": "Base Metabólica",
      "phase_targets": {
        "cho_gkg": "3.0-4.0",
        "protein_gkg": "1.8-2.2",
        "fat_guidance": "moderada",
        "fiber_guidance": "alta"
      },
      "supplements_daily": [
        {"name": "Creatina", "dose": "5g", "timing": "pós-treino"}
      ],
      "long_run_strategy": {
        "pre": "descrição",
        "intra": "g/h e composição",
        "post": "recovery"
      },
      "functional_supps": ["Ômega-3 2g", "Vitamina D 2000UI"],
      "pre_intra_strategy": {
        "pre": "composição e timing",
        "intra": "g/h de gel, sódio, água"
      },
      "weekly_table": [
        {
          "day": "Seg",
          "type": "low",
          "cho_gkg": 3.0,
          "pre_training": "",
          "intra_training": "",
          "post_training": "",
          "note": "train-low, rodagem leve"
        },
        {
          "day": "Ter",
          "type": "high",
          "cho_gkg": 5.0,
          "pre_training": "1g/kg 2h antes",
          "intra_training": "40g/h",
          "post_training": "recovery 4:1",
          "note": "treino-chave, suporte total"
        },
        {"day": "Qua", "type": "low", "cho_gkg": 3.0, "pre_training": "", "intra_training": "", "post_training": "", "note": ""},
        {"day": "Qui", "type": "high", "cho_gkg": 5.0, "pre_training": "", "intra_training": "", "post_training": "", "note": ""},
        {"day": "Sex", "type": "low", "cho_gkg": 3.0, "pre_training": "", "intra_training": "", "post_training": "", "note": ""},
        {"day": "Sáb", "type": "high", "cho_gkg": 6.0, "pre_training": "", "intra_training": "60g/h", "post_training": "", "note": "longão"},
        {"day": "Dom", "type": "recovery", "cho_gkg": 3.5, "pre_training": "", "intra_training": "", "post_training": "", "note": "recuperação"}
      ],
      "notes_admin": ""
    }
  ],
  "nutritionistNotes": ["nota 1", "nota 2"]
}

IMPORTANTE: A weekly_table DEVE ter exatamente 7 dias (Seg a Dom). O type de cada dia deve ser baseado no GEE real fornecido em agenda_treinos_semanal.

Após o JSON, adicione "---READABLE---" seguido de um resumo em português.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": OPENAI_API_KEY, "X-Lovable-AIG-SDK": "edge-function",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-luna", reasoning_effort: "none",
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
    const fullResponse = data.choices?.[0]?.message?.content || '';

    let jsonPart = fullResponse;
    let humanReadable = '';

    const separator = '---READABLE---';
    if (fullResponse.includes(separator)) {
      const parts = fullResponse.split(separator);
      jsonPart = parts[0].trim();
      humanReadable = parts[1].trim();
    }

    // Extract JSON
    const jsonMatch = jsonPart.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, jsonPart];
    const cleanJson = (jsonMatch[1] || jsonPart).trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      const objMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (objMatch) {
        parsed = JSON.parse(objMatch[0]);
      } else {
        throw new Error("Não foi possível extrair JSON da resposta");
      }
    }

    return new Response(JSON.stringify({
      blocks: parsed.blocks || [],
      nutritionistNotes: parsed.nutritionistNotes || [],
      humanReadable: humanReadable || '',
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
