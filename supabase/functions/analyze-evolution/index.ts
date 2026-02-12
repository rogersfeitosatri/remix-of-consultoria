import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration missing');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { clientId } = await req.json();
    if (!clientId) throw new Error('clientId is required');

    console.log('Analyzing evolution for client:', clientId);

    // Fetch client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
    if (clientError) throw new Error('Failed to fetch client');

    // Fetch athlete profile (for target race)
    const { data: athleteProfile } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    // Fetch all checkin responses
    const { data: checkinResponses, error: responsesError } = await supabase
      .from('checkin_responses')
      .select(`*, checkin_forms (title)`)
      .eq('client_id', clientId)
      .order('submitted_at', { ascending: true });
    if (responsesError) throw new Error('Failed to fetch checkin responses');

    // Fetch questions from first form
    const firstFormId = checkinResponses?.[0]?.form_id;
    let questions: any[] = [];
    if (firstFormId) {
      const { data: q } = await supabase
        .from('checkin_questions')
        .select('*')
        .eq('form_id', firstFormId)
        .order('order_index', { ascending: true });
      questions = q || [];
    }

    // Fetch previous AI analyses
    const { data: previousAnalyses } = await supabase
      .from('checkin_ai_analyses')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(5);

    const hasTargetRace = !!(athleteProfile?.target_race && athleteProfile?.target_deadline);
    
    // Build evolution data summary
    const evolutionData = (checkinResponses || []).map(r => {
      const answers: Record<string, any> = {};
      questions.forEach(q => {
        const resp = r.responses?.[q.id];
        const answer = resp?.answer || resp;
        if (answer) answers[q.question_text] = answer;
      });
      return {
        date: new Date(r.submitted_at).toLocaleDateString('pt-BR'),
        answers,
      };
    });

    const trendsSummary = (previousAnalyses || []).slice(0, 3).map(a => {
      return `${new Date(a.created_at).toLocaleDateString('pt-BR')}: Tendência: ${a.evolution_trend?.substring(0, 150) || 'N/A'} | Resumo: ${a.weekly_summary?.substring(0, 150) || 'N/A'}`;
    }).join('\n');

    const targetRaceSection = hasTargetRace ? `
### PROVA ALVO DO ATLETA
- **Prova:** ${athleteProfile.target_race}
- **Data da Prova:** ${new Date(athleteProfile.target_deadline).toLocaleDateString('pt-BR')}
- **Dias até a prova:** ${Math.ceil((new Date(athleteProfile.target_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} dias

IMPORTANTE: Como o atleta possui uma prova alvo cadastrada, a análise DEVE incluir:
1. Periodização nutricional específica para a prova (fase atual: base/construção/pico/taper/recuperação)
2. Ajustes sugeridos na estratégia nutricional considerando a proximidade da prova
3. Recomendações de carboidrato loading se a prova estiver próxima (< 14 dias)
4. Estratégia de hidratação e suplementação pré-prova
` : `
### SEM PROVA ALVO CADASTRADA
O atleta não possui uma prova alvo cadastrada. Forneça recomendações gerais de nutrição funcional para otimizar desempenho e composição corporal.
Sugira ao assessor que considere cadastrar uma prova alvo para orientações mais específicas de periodização nutricional.
`;

    const prompt = `
## ANÁLISE DE EVOLUÇÃO DO ATLETA

**Atleta:** ${client.name}
**Plano:** ${client.plan_type} | **Serviço:** ${client.service_type}
**Total de check-ins:** ${(checkinResponses || []).length}

${athleteProfile ? `
### Perfil do Atleta:
- Objetivo Principal: ${athleteProfile.main_goal || 'N/I'}
- Peso Atual: ${athleteProfile.current_weight || 'N/I'} kg
- Peso Ideal: ${athleteProfile.ideal_weight || 'N/I'} kg
- Altura: ${athleteProfile.height || 'N/I'} cm
- Volume Semanal: ${athleteProfile.weekly_volume_km || 'N/I'} km
- Frequência Semanal: ${athleteProfile.weekly_frequency || 'N/I'}
- Qualidade do Sono: ${athleteProfile.sleep_quality || 'N/I'}
- Nível de Estresse: ${athleteProfile.stress_level || 'N/I'}
- Intolerância Lactose: ${athleteProfile.lactose_intolerance || 'N/I'}
- Intolerância Glúten: ${athleteProfile.gluten_intolerance || 'N/I'}
- Alergias: ${athleteProfile.food_allergies || 'N/I'}
- Suplementos: ${athleteProfile.current_supplements || 'N/I'}
` : 'Perfil do atleta não preenchido.'}

${targetRaceSection}

### Dados de Evolução dos Check-ins (cronológico):
${evolutionData.map((d, i) => `**Check-in ${i + 1} (${d.date}):**\n${Object.entries(d.answers).map(([q, a]) => `  - ${q}: ${JSON.stringify(a)}`).join('\n')}`).join('\n\n')}

### Análises IA Anteriores:
${trendsSummary || 'Sem análises anteriores'}

---

Analise a evolução completa deste atleta e forneça uma análise profunda.
`;

    const systemPrompt = `Você é um nutricionista esportivo especializado em nutrição funcional e periodização nutricional para corredores.

Responda SEMPRE em JSON com esta estrutura:
{
  "overall_evolution": "Análise geral da evolução do atleta ao longo de todos os check-ins (2-3 parágrafos detalhados)",
  "nutrition_insights": "Insights de nutrição funcional baseados nos dados: padrões alimentares, déficits nutricionais suspeitos, ajustes sugeridos (1-2 parágrafos)",
  "periodization": "Análise de periodização nutricional: fase atual do treinamento, estratégia de macro/micronutrientes para a fase, ajustes de timing nutricional (1-2 parágrafos). Se houver prova alvo, detalhar a periodização específica.",
  "action_items": ["Array de 3-5 ações concretas e priorizadas para o assessor implementar"],
  "athlete_strengths": ["Array de 2-3 pontos fortes do atleta observados nos dados"],
  "attention_points": ["Array de 2-3 pontos de atenção ou riscos identificados"],
  "suggested_adjustments": "Sugestões detalhadas de ajustes na dieta e suplementação (1-2 parágrafos)"
}

IMPORTANTE:
- Baseie-se exclusivamente nos dados fornecidos
- Seja específico nas recomendações, não genérico
- Considere a periodização nutricional conforme a fase de treinamento
- Se houver prova alvo, toda análise deve considerar a proximidade da data
- Use linguagem profissional mas acessível`;

    console.log('Sending evolution analysis request to Lovable AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }), {
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
      throw new Error('Failed to parse evolution analysis');
    }

    console.log('Evolution analysis completed successfully');

    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResult,
      has_target_race: hasTargetRace,
      target_race: hasTargetRace ? {
        name: athleteProfile.target_race,
        deadline: athleteProfile.target_deadline,
      } : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-evolution:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
