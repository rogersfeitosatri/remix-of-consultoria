import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiJson } from "../_shared/aiClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration missing');

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

    const systemPrompt = `Você é um nutricionista esportivo funcional especializado em periodização nutricional para corredores, baseando suas análises no Tratado de Nutrição Esportiva Funcional (Paschoal & Naves).

## BASE DE CONHECIMENTO
Princípios: Individualidade bioquímica, Teia de Interconexões Metabólicas (8 sistemas: Assimilação, Defesa/Reparo, Energia, Biotransformação, Transporte, Comunicação, Integridade Estrutural, Mental/Emocional), Sistema ATMS (Antecedentes, Gatilhos, Mediadores, Sintomas).
Hipersensibilidades alimentares (mediadas por IgG): geram imunocomplexos, agridem barreira intestinal, podem causar resistência à insulina e adiposidade abdominal.
Inflamação: NFκ-B ativado por alta carga glicêmica, desequilíbrio ômega-6/3, deficiência de vitamina D. Moduladores: lignanas, β-glucanas, antocianinas, licopeno, catequinas, curcumina.
Suporte intestinal: glutamina (5-10g/dia), probióticos, enzimas digestivas, fermentados.
Energia mitocondrial: CoQ10 (100-200mg), magnésio quelado (200-400mg), complexo B metilado.
Suplementação endurance: ômega-3 (2-3g EPA+DHA), vitamina D3 (2000-4000UI), zinco (15-30mg), colágeno hidrolisado (10g/dia).
Periodização nutricional: adaptar macro/micro conforme fase (base, construção, pico, taper, recuperação). Timing pré/durante/pós-treino. Carb loading para provas >90min.

Responda SEMPRE em JSON com esta estrutura:
{
  "overall_evolution": "Análise geral da evolução do atleta ao longo de todos os check-ins (2-3 parágrafos detalhados)",
  "nutrition_insights": "Insights de nutrição funcional baseados nos dados (1-2 parágrafos)",
  "periodization": "Análise de periodização nutricional (1-2 parágrafos). Se houver prova alvo, detalhar a periodização específica.",
  "action_items": ["Array de 3-5 ações concretas e priorizadas"],
  "athlete_strengths": ["Array de 2-3 pontos fortes"],
  "attention_points": ["Array de 2-3 pontos de atenção"],
  "suggested_adjustments": "Sugestões detalhadas de ajustes na dieta e suplementação (1-2 parágrafos)"
}

IMPORTANTE:
- Baseie-se exclusivamente nos dados fornecidos
- Seja preciso e focado no essencial para o momento do atleta
- Considere a periodização nutricional conforme a fase de treinamento
- Se houver prova alvo, toda análise deve considerar a proximidade da data
- Use linguagem profissional mas acessível`;

    console.log('Sending evolution analysis request to Gemini (with fallback)...');

    const { data: analysisResult, provider, model } = await callAiJson({
      systemPrompt,
      userPrompt: prompt,
      maxTokens: 3000,
      fallback: 'openai-gpt4o',
    });

    console.log(`Evolution analysis received from ${provider}/${model}`);

    // Save analysis to DB (upsert by client_id)
    const { error: upsertError } = await supabase
      .from('evolution_analyses')
      .upsert({
        client_id: clientId,
        analysis: analysisResult,
        has_target_race: hasTargetRace,
        target_race_name: hasTargetRace ? athleteProfile.target_race : null,
        target_race_deadline: hasTargetRace ? athleteProfile.target_deadline : null,
      }, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('Failed to save evolution analysis:', upsertError);
      // Don't throw - still return the analysis even if save fails
    } else {
      console.log('Evolution analysis saved to DB');
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
