import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Knowledge base from "Tratado de Nutrição Esportiva Funcional" - Valéria Paschoal & Andréia Naves
const FUNCTIONAL_NUTRITION_KNOWLEDGE = `
## BASE DE CONHECIMENTO: Tratado de Nutrição Esportiva Funcional (Paschoal & Naves, 2014)

### PRINCÍPIOS DA NUTRIÇÃO FUNCIONAL
1. **Individualidade bioquímica**: Cada organismo é único, com necessidades nutricionais únicas e tendências únicas a doenças. Considere polimorfismos genéticos e interações com o ambiente.
2. **Biodisponibilidade de nutrientes**: Não basta consumir o nutriente, é preciso garantir absorção, excreção e aproveitamento adequados.
3. **Saúde como Vitalidade Positiva**: Mais que ausência de doença, busca-se saúde integral modulando via nutrientes e fitoquímicos todas as reações bioquímicas.

### TEIA DE INTERCONEXÕES METABÓLICAS (Institute for Functional Medicine)
A teia considera a interconexão de todos os sistemas fisiológicos:
- **Assimilação**: Digestão, absorção e integridade da barreira intestinal (microbiota, permeabilidade intestinal)
- **Defesa e Reparo**: Suporte imunológico, processo inflamatório, estresse oxidativo
- **Energia**: Metabolismo energético, função mitocondrial
- **Biotransformação e Eliminação**: Destoxificação e biotransformação hepática (fases I, II e III)
- **Transporte**: Sistema cardiovascular, fluxo linfático, distribuição de nutrientes
- **Comunicação**: Regulação hormonal e de neurotransmissores
- **Integridade Estrutural**: Ossos, articulações, músculos, membrana celular
- **Mental/Emocional/Espiritual**: Equilíbrio psicológico, eixo HPA, interação corpo-mente

### SISTEMA ATMS (Antecedentes, Gatilhos, Mediadores, Sintomas)
- Preencher a teia e identificar antecedentes, gatilhos e mediadores de cada sintoma
- Eleger os 3 sistemas com maior desequilíbrio para iniciar tratamento
- Bloquear gatilhos e modular mediadores para restabelecer equilíbrio funcional

### DESEQUILÍBRIOS E INTERVENÇÕES NUTRICIONAIS PARA ATLETAS

**Hipersensibilidades alimentares (mediadas por IgG)**:
- Geram imunocomplexos que agridem barreira intestinal
- Podem causar: sintomas respiratórios, GI, resistência periférica à insulina, adiposidade abdominal
- Investigar com rastreamento metabólico e dieta de rotação

**Inflamação e Imunidade**:
- Exercício intenso + deficiências nutricionais → imunossupressão
- NFκ-B (fator de transcrição pró-inflamatório) ativado por: alta carga glicêmica, desequilíbrio ômega-6/ômega-3, deficiência de vitamina D, falta de compostos bioativos
- Moduladores anti-inflamatórios: lignanas (linhaça), β-glucanas (cogumelos, aveia), antocianinas (açaí), licopeno (tomate), catequinas (chá-verde), curcumina

**Suporte Intestinal**:
- Glutamina (5-10g/dia) para barreira intestinal
- Probióticos de amplo espectro (Lactobacillus, Bifidobacterium)
- Enzimas digestivas antes das refeições
- Alimentos fermentados: kefir, chucrute, kombucha

**Energia e Mitocôndrias**:
- CoQ10 (100-200mg/dia), magnésio quelado (200-400mg/dia)
- Complexo B metilado (B12, folato ativo)
- Avaliar função tireoidiana e ferritina sérica

**Biotransformação Hepática**:
- NAC (600-1200mg/dia), silimarina (200-400mg/dia)
- Crucíferas para enzimas de fase II
- Reduzir exposição a xenobióticos

**Suplementação para Atletas de Endurance**:
- BCAA, creatina, carnitina, glutamina, whey protein
- Ômega-3 (EPA+DHA 2-3g/dia)
- Vitamina D3 (2000-4000 UI/dia) com monitoramento
- Zinco (15-30mg/dia), magnésio (300-400mg/dia)
- Colágeno hidrolisado (10g/dia) para articulações

**Periodização Nutricional**:
- Adaptar macro/micronutrientes conforme fase de treinamento (base, construção, pico, taper, recuperação)
- Timing nutricional: pré, durante e pós-treino
- Carb loading para provas de endurance (> 90min)
- Estratégia de hidratação individualizada

### INTERPRETAÇÃO DO RASTREAMENTO METABÓLICO
- Score total < 20: Equilíbrio funcional (menor chance de hipersensibilidades)
- Score 20-30: Atenção leve (alguns sinais de desequilíbrio)
- Score 30-40: Hipersensibilidades prováveis (investigação recomendada)
- Score 40-100: Desequilíbrio significativo (plano de intervenção individualizado)
- Score > 100: Quadro preocupante (possível associação com doenças crônicas, intervenção urgente)

### CATEGORIAS E CONDUTAS NUTRICIONAIS
Para cada categoria com score ≥ 10:
- **Assimilação**: Enzimas digestivas, probióticos, glutamina, fermentados, avaliar permeabilidade intestinal
- **Defesa/Reparo**: Vitamina D3+K2, zinco, ômega-3, curcumina, eliminar alimentos pró-inflamatórios
- **Energia**: CoQ10, magnésio, complexo B, avaliar tireoide e ferritina
- **Biotransformação**: NAC, crucíferas, silimarina, fibras solúveis, reduzir xenobióticos
- **Transporte**: Vitamina C, ferro quelado, B12+folato, flavonoides, avaliar perfil lipídico
- **Comunicação**: Magnésio glicinato, B6(P5P), triptofano/5-HTP, painel hormonal, adaptógenos
- **Integridade Estrutural**: Vitamina D3+K2, colágeno hidrolisado, magnésio, cálcio, densitometria
- **Mental/Emocional**: Ômega-3(EPA), ashwagandha, mindfulness, L-teanina, cortisol salivar
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration missing');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { screeningId } = await req.json();
    if (!screeningId) throw new Error('screeningId is required');

    console.log('Analyzing metabolic screening:', screeningId);

    // Fetch screening with client info
    const { data: screening, error: screeningError } = await supabase
      .from('metabolic_screening_responses')
      .select('*, clients(id, name, email, plan_type, service_type)')
      .eq('id', screeningId)
      .single();

    if (screeningError || !screening) throw new Error('Screening not found');

    // Fetch athlete profile
    const { data: athleteProfile } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('client_id', screening.client_id)
      .maybeSingle();

    // Fetch historical screenings for evolution context
    const { data: historicalScreenings } = await supabase
      .from('metabolic_screening_responses')
      .select('screening_date, score_total, score_assimilacao, score_defesa_reparo, score_energia, score_biotransformacao, score_transporte, score_comunicacao, score_integridade_estrutural, score_mental_emocional')
      .eq('client_id', screening.client_id)
      .neq('id', screeningId)
      .order('screening_date', { ascending: false })
      .limit(5);

    // Build prompt
    const categoryScores = [
      { name: 'Assimilação', key: 'assimilacao', score: screening.score_assimilacao },
      { name: 'Defesa e Reparo', key: 'defesa_reparo', score: screening.score_defesa_reparo },
      { name: 'Energia', key: 'energia', score: screening.score_energia },
      { name: 'Biotransformação', key: 'biotransformacao', score: screening.score_biotransformacao },
      { name: 'Transporte', key: 'transporte', score: screening.score_transporte },
      { name: 'Comunicação', key: 'comunicacao', score: screening.score_comunicacao },
      { name: 'Integridade Estrutural', key: 'integridade_estrutural', score: screening.score_integridade_estrutural },
      { name: 'Mental/Emocional', key: 'mental_emocional', score: screening.score_mental_emocional },
    ];

    const sortedCategories = [...categoryScores].sort((a, b) => b.score - a.score);
    const top3 = sortedCategories.slice(0, 3);

    const historicalContext = (historicalScreenings || []).map(h => {
      return `  ${h.screening_date}: Total=${h.score_total} | Assim=${h.score_assimilacao} Def=${h.score_defesa_reparo} Ene=${h.score_energia} Bio=${h.score_biotransformacao} Tra=${h.score_transporte} Com=${h.score_comunicacao} Int=${h.score_integridade_estrutural} Men=${h.score_mental_emocional}`;
    }).join('\n');

    const prompt = `
## RASTREAMENTO METABÓLICO DO ATLETA

**Atleta:** ${screening.clients?.name || 'N/I'}
**Data:** ${screening.screening_date}
**Score Total:** ${screening.score_total}

### Scores por Categoria:
${categoryScores.map(c => `- ${c.name}: ${c.score}/40`).join('\n')}

### TOP 3 Sistemas Mais Desequilibrados:
${top3.map((c, i) => `${i + 1}. ${c.name}: ${c.score}/40`).join('\n')}

${athleteProfile ? `
### Perfil do Atleta:
- Objetivo: ${athleteProfile.main_goal || 'N/I'}
- Peso Atual: ${athleteProfile.current_weight || 'N/I'} kg
- Peso Ideal: ${athleteProfile.ideal_weight || 'N/I'} kg
- Volume Semanal: ${athleteProfile.weekly_volume_km || 'N/I'} km
- Qualidade do Sono: ${athleteProfile.sleep_quality || 'N/I'}
- Nível de Estresse: ${athleteProfile.stress_level || 'N/I'}
- Prova Alvo: ${athleteProfile.target_race || 'N/I'}
- Data da Prova: ${athleteProfile.target_deadline || 'N/I'}
- Intolerância Lactose: ${athleteProfile.lactose_intolerance || 'N/I'}
- Intolerância Glúten: ${athleteProfile.gluten_intolerance || 'N/I'}
- Alergias: ${athleteProfile.food_allergies || 'N/I'}
- Suplementos Atuais: ${athleteProfile.current_supplements || 'N/I'}
` : 'Perfil do atleta não preenchido.'}

### Histórico de Rastreamentos (anteriores):
${historicalContext || 'Sem histórico anterior.'}

---

Analise este rastreamento metabólico considerando a base de conhecimento do Tratado de Nutrição Esportiva Funcional.
Foque nos 3 sistemas mais desequilibrados. Seja preciso, objetivo e focado no essencial para o momento do atleta.
`;

    const systemPrompt = `Você é um nutricionista esportivo funcional especializado, baseando suas análises no Tratado de Nutrição Esportiva Funcional (Paschoal & Naves).

${FUNCTIONAL_NUTRITION_KNOWLEDGE}

Responda SEMPRE em JSON com esta estrutura:
{
  "diagnostic": "Diagnóstico descritivo geral baseado nos scores (2-3 parágrafos, focado no essencial)",
  "top_imbalances": [
    {
      "system": "Nome do sistema",
      "score": numero,
      "interpretation": "Interpretação do desequilíbrio neste sistema (1-2 frases)",
      "dietary_recommendations": ["Array de 3-4 recomendações alimentares específicas"],
      "supplementation": ["Array de 2-3 suplementos com dosagem"],
      "clinical_actions": ["Array de 1-2 ações clínicas para o nutricionista"]
    }
  ],
  "general_recommendations": "Orientações gerais para o plano alimentar (1 parágrafo focado)",
  "evolution_notes": "Notas sobre evolução comparada com histórico anterior (1 parágrafo, se houver histórico)",
  "priority_actions": ["Array de 3-5 ações prioritárias para o nutricionista implementar agora"],
  "athlete_feedback": "Resumo curto e motivacional para enviar ao atleta (máximo 300 caracteres)"
}

IMPORTANTE:
- Baseie-se nos princípios da Nutrição Funcional (individualidade bioquímica, teia de interconexões)
- Use o sistema ATMS para relacionar sintomas com antecedentes e gatilhos
- Recomende suplementos com dosagens específicas baseadas em evidências
- Considere interações entre os sistemas (ex: intestino afeta imunidade e energia)
- Se houver histórico, compare evolução e ajuste recomendações
- Seja preciso e objetivo, focando no essencial para o momento do atleta`;

    console.log('Sending to Lovable AI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_completion_tokens: 3000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    let analysisResult;
    try {
      let clean = aiResponse.trim();
      if (clean.startsWith('```json')) clean = clean.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      else if (clean.startsWith('```')) clean = clean.replace(/^```\n?/, '').replace(/\n?```$/, '');
      analysisResult = JSON.parse(clean);
    } catch {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Failed to parse metabolic analysis');
    }

    // Save AI analysis to the screening record
    const { error: updateError } = await supabase
      .from('metabolic_screening_responses')
      .update({
        ai_analysis: analysisResult,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq('id', screeningId);

    if (updateError) {
      console.error('Failed to save AI analysis:', updateError);
    }

    console.log('Metabolic screening analysis completed');

    return new Response(JSON.stringify({ success: true, analysis: analysisResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-metabolic-screening:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
