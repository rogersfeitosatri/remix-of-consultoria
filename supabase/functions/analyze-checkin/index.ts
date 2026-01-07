import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration is missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { checkinResponseId } = await req.json();

    if (!checkinResponseId) {
      throw new Error('checkinResponseId is required');
    }

    console.log('Analyzing checkin response:', checkinResponseId);

    // Fetch the check-in response with form info
    const { data: checkinResponse, error: responseError } = await supabase
      .from('checkin_responses')
      .select(`
        *,
        checkin_forms (title, description),
        clients (id, name, email)
      `)
      .eq('id', checkinResponseId)
      .single();

    if (responseError) {
      console.error('Error fetching checkin response:', responseError);
      throw new Error('Failed to fetch checkin response');
    }

    if (!checkinResponse) {
      throw new Error('Check-in response not found');
    }

    const clientId = checkinResponse.client_id;

    // Fetch form questions to understand the responses
    const { data: questions, error: questionsError } = await supabase
      .from('checkin_questions')
      .select('*')
      .eq('form_id', checkinResponse.form_id)
      .order('order_index', { ascending: true });

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
    }

    // Fetch historical check-in responses for this client
    const { data: historicalResponses, error: historyError } = await supabase
      .from('checkin_responses')
      .select(`
        *,
        checkin_forms (title)
      `)
      .eq('client_id', clientId)
      .order('submitted_at', { ascending: false })
      .limit(10);

    if (historyError) {
      console.error('Error fetching history:', historyError);
    }

    // Fetch previous AI analyses for context
    const { data: previousAnalyses, error: analysesError } = await supabase
      .from('checkin_ai_analyses')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (analysesError) {
      console.error('Error fetching previous analyses:', analysesError);
    }

    // Fetch athlete profile for additional context
    const { data: athleteProfile } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    console.log('Data fetched successfully for:', checkinResponse.clients?.name);

    // Build the prompt for ChatGPT
    const prompt = buildAnalysisPrompt(
      checkinResponse,
      questions || [],
      historicalResponses || [],
      previousAnalyses || [],
      athleteProfile
    );

    console.log('Sending request to OpenAI...');

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um nutricionista esportivo especializado em corredores, analisando check-ins semanais de atletas.
Sua função é analisar o check-in atual, comparar com o histórico e gerar insights para o assessor.

Responda SEMPRE em JSON com a seguinte estrutura:
{
  "weekly_summary": "Resumo detalhado da semana do atleta (2-3 parágrafos)",
  "evolution_trend": "Análise da tendência de evolução baseada no histórico (positiva/estável/negativa e explicação)",
  "alerts": ["Array de alertas importantes que o assessor deve saber"],
  "suggested_feedback": "Sugestão de feedback personalizado para enviar ao atleta via WhatsApp (tom motivacional e profissional, máximo 500 caracteres)"
}

IMPORTANTE:
- Seja específico e baseado nos dados fornecidos
- Compare com check-ins anteriores quando disponível
- Identifique padrões e tendências
- O feedback sugerido deve ser empático e motivacional
- Nunca invente informações que não estão nos dados`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('OpenAI response received');

    // Parse the AI response
    let analysisData;
    try {
      // Remove markdown code blocks if present
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      analysisData = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Failed to parse AI analysis response');
    }

    // Check if analysis already exists for this check-in
    const { data: existingAnalysis } = await supabase
      .from('checkin_ai_analyses')
      .select('id')
      .eq('checkin_response_id', checkinResponseId)
      .maybeSingle();

    const analysisRecord = {
      checkin_response_id: checkinResponseId,
      client_id: clientId,
      weekly_summary: analysisData.weekly_summary,
      evolution_trend: analysisData.evolution_trend,
      alerts: analysisData.alerts || [],
      suggested_feedback: analysisData.suggested_feedback,
      raw_response: aiResponse,
      model_used: 'gpt-4o-mini',
    };

    let result;
    if (existingAnalysis) {
      // Update existing analysis
      const { data: updated, error: updateError } = await supabase
        .from('checkin_ai_analyses')
        .update(analysisRecord)
        .eq('id', existingAnalysis.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating analysis:', updateError);
        throw new Error('Failed to update analysis');
      }
      result = updated;
    } else {
      // Insert new analysis
      const { data: inserted, error: insertError } = await supabase
        .from('checkin_ai_analyses')
        .insert(analysisRecord)
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting analysis:', insertError);
        throw new Error('Failed to save analysis');
      }
      result = inserted;

      // Create pending feedback record
      const { error: feedbackError } = await supabase
        .from('checkin_feedbacks')
        .insert({
          checkin_response_id: checkinResponseId,
          client_id: clientId,
          ai_analysis_id: result.id,
          suggested_feedback: analysisData.suggested_feedback,
          status: 'pending',
        });

      if (feedbackError) {
        console.error('Error creating feedback record:', feedbackError);
      }
    }

    console.log('Analysis saved successfully');

    return new Response(JSON.stringify({ success: true, analysis: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-checkin function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildAnalysisPrompt(
  currentResponse: any,
  questions: any[],
  historicalResponses: any[],
  previousAnalyses: any[],
  athleteProfile: any
): string {
  // Format current responses with question text
  const formattedResponses = questions.map(q => {
    const response = currentResponse.responses?.[q.id];
    const answer = response?.answer || response;
    const comment = response?.comment;
    
    return `- ${q.question_text}: ${JSON.stringify(answer)}${comment ? ` (Comentário: ${comment})` : ''}`;
  }).join('\n');

  // Format historical data
  const historicalSummary = historicalResponses.slice(1, 5).map((r, i) => {
    const date = new Date(r.submitted_at).toLocaleDateString('pt-BR');
    return `Check-in ${i + 1} (${date}): ${Object.keys(r.responses || {}).length} perguntas respondidas`;
  }).join('\n');

  // Format previous analyses trends
  const trendsSummary = previousAnalyses.slice(0, 3).map((a, i) => {
    const date = new Date(a.created_at).toLocaleDateString('pt-BR');
    return `${date}: ${a.evolution_trend?.substring(0, 100) || 'N/A'}...`;
  }).join('\n');

  return `
## CHECK-IN ATUAL

**Atleta:** ${currentResponse.clients?.name || 'N/I'}
**Data do Check-in:** ${new Date(currentResponse.submitted_at).toLocaleDateString('pt-BR')}
**Formulário:** ${currentResponse.checkin_forms?.title || 'Check-in'}

### Respostas do Check-in Atual:
${formattedResponses || 'Nenhuma resposta registrada'}

${athleteProfile ? `
### Perfil do Atleta (para contexto):
- Objetivo Principal: ${athleteProfile.main_goal || 'N/I'}
- Peso Atual: ${athleteProfile.current_weight || 'N/I'} kg
- Peso Ideal: ${athleteProfile.ideal_weight || 'N/I'} kg
- Volume Semanal: ${athleteProfile.weekly_volume_km || 'N/I'} km
- Qualidade do Sono: ${athleteProfile.sleep_quality || 'N/I'}
- Nível de Estresse: ${athleteProfile.stress_level || 'N/I'}
` : ''}

### Histórico de Check-ins (últimos 4):
${historicalSummary || 'Sem histórico anterior'}

### Tendências Anteriores (últimas 3 análises):
${trendsSummary || 'Sem análises anteriores'}

---

Por favor, analise este check-in e forneça:
1. Resumo da semana do atleta
2. Tendência de evolução comparando com histórico
3. Alertas importantes para o assessor
4. Sugestão de feedback motivacional para enviar ao atleta
`;
}