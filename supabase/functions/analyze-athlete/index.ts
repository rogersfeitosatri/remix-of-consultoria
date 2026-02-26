import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration is missing');
    }

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId } = await req.json();

    if (!clientId) {
      throw new Error('clientId is required');
    }

    console.log('Analyzing athlete for client:', clientId);

    // Fetch client data first (required)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      throw new Error('Failed to fetch client data');
    }

    // Fetch athlete profile (optional - some athletes only have anamnese)
    const { data: profile, error: profileError } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile (non-critical):', profileError);
    }

    // Fetch anamnese responses (dynamic form) - this is the main source of data
    const { data: anamneseResponses, error: anamneseError } = await supabase
      .from('anamnese_responses')
      .select(`
        *,
        anamnese_forms!inner (
          title,
          user_id
        )
      `)
      .eq('client_id', clientId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anamneseError) {
      console.error('Error fetching anamnese:', anamneseError);
    }

    // Must have either profile or anamnese responses
    if (!profile && !anamneseResponses) {
      throw new Error('Nenhum dado encontrado para análise. O atleta precisa ter preenchido a anamnese ou ter um perfil cadastrado.');
    }

    // Fetch anamnese questions if we have responses
    let anamneseQuestions: any[] = [];
    if (anamneseResponses?.form_id) {
      const { data: questions } = await supabase
        .from('anamnese_questions')
        .select('id, question_text, section')
        .eq('form_id', anamneseResponses.form_id)
        .order('order_index', { ascending: true });
      
      anamneseQuestions = questions || [];
    }

    console.log('Client:', client.name);
    console.log('Profile found:', !!profile);
    console.log('Anamnese responses found:', !!anamneseResponses);

    // Build the prompt for ChatGPT
    const prompt = buildAnalysisPrompt(profile, client, anamneseResponses, anamneseQuestions);

    console.log('Sending request to Lovable AI...');

    // Call Lovable AI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Você é um nutricionista esportivo funcional especializado em corredores, baseando suas análises no Tratado de Nutrição Esportiva Funcional (Paschoal & Naves).

Princípios: Individualidade bioquímica, Teia de Interconexões Metabólicas (Assimilação, Defesa/Reparo, Energia, Biotransformação, Transporte, Comunicação, Integridade Estrutural, Mental/Emocional), Sistema ATMS.
Considere hipersensibilidades alimentares (IgG), modulação do NFκ-B, suporte intestinal, energia mitocondrial, biotransformação hepática.
Suplementação: ômega-3, vitamina D3, zinco, magnésio, CoQ10, glutamina, colágeno, BCAA conforme necessidade individual.

Analise os dados do atleta e forneça uma análise estruturada em JSON com os seguintes campos:
- diagnosis: string com diagnóstico detalhado da situação atual do atleta (considere aspectos funcionais)
- energy_expenditure: objeto com { bmr: number (TMB), tdee: number (GET), training_expenditure: number (gasto treino), formula_used: string }
- caloric_deficit: objeto com { recommended_deficit: number (kcal), target_calories: number, deficit_percentage: number, timeline_weeks: number }
- macronutrients: objeto com { protein_g_kg: number, carbs_g_kg: number, fat_g_kg: number, protein_total: number, carbs_total: number, fat_total: number }
- alerts: array de strings com alertas importantes e recomendações baseadas em nutrição funcional

Responda APENAS com o JSON válido, sem markdown ou texto adicional.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      throw new Error(`Lovable AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('Lovable AI response received');

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

    // Check if analysis already exists for this client
    const { data: existingAnalysis } = await supabase
      .from('ai_analyses')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle();

    const analysisRecord = {
      client_id: clientId,
      athlete_profile_id: profile?.id || null,
      diagnosis: analysisData.diagnosis,
      energy_expenditure: analysisData.energy_expenditure,
      caloric_deficit: analysisData.caloric_deficit,
      macronutrients: analysisData.macronutrients,
      alerts: analysisData.alerts || [],
      raw_response: aiResponse,
      model_used: 'google/gemini-3-flash-preview',
    };

    let result;
    if (existingAnalysis) {
      // Update existing analysis
      const { data: updated, error: updateError } = await supabase
        .from('ai_analyses')
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
        .from('ai_analyses')
        .insert(analysisRecord)
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting analysis:', insertError);
        throw new Error('Failed to save analysis');
      }
      result = inserted;
    }

    // Update client status
    await supabase
      .from('clients')
      .update({ athlete_status: 'analysis_complete' })
      .eq('id', clientId);

    console.log('Analysis saved successfully');

    return new Response(JSON.stringify({ success: true, analysis: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-athlete function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildAnalysisPrompt(profile: any, client: any, anamneseResponses: any, anamneseQuestions: any[]): string {
  const mealDescription = (meal: any) => {
    if (!meal) return 'Não informado';
    return `Horário: ${meal.time || 'N/I'}, Local: ${meal.location || 'N/I'}, Alimentos: ${meal.foods || 'N/I'}`;
  };

  // Build anamnese section from dynamic form responses
  let anamneseSection = '';
  if (anamneseResponses?.responses && anamneseQuestions.length > 0) {
    anamneseSection = `
### Respostas da Anamnese Dinâmica
`;
    const responses = anamneseResponses.responses;
    const groupedBySection: Record<string, string[]> = {};
    
    for (const question of anamneseQuestions) {
      const response = responses[question.id];
      if (response) {
        const section = question.section || 'Geral';
        if (!groupedBySection[section]) {
          groupedBySection[section] = [];
        }
        
        let answerText = '';
        if (typeof response === 'object' && response.answer !== undefined) {
          const answer = response.answer;
          answerText = Array.isArray(answer) ? answer.join(', ') : String(answer);
          if (response.comment) {
            answerText += ` (Comentário: ${response.comment})`;
          }
        } else {
          answerText = Array.isArray(response) ? response.join(', ') : String(response);
        }
        
        groupedBySection[section].push(`- ${question.question_text}: ${answerText || 'Não respondido'}`);
      }
    }
    
    for (const [section, answers] of Object.entries(groupedBySection)) {
      anamneseSection += `\n**${section}**\n${answers.join('\n')}\n`;
    }
  }

  // If no profile exists, use only anamnese data
  if (!profile) {
    return `
## DADOS DO ATLETA CORREDOR
### Dados Pessoais
- Nome: ${client.name}
- Email: ${client.email || 'Não informado'}
- Telefone: ${client.phone || 'Não informado'}

${anamneseSection}

Por favor, analise esses dados da anamnese e forneça:
1. Diagnóstico completo da situação atual do atleta (pontos de atenção, objetivos, possíveis riscos ou limitações)
2. Estimativa de gasto energético (TMB, GET, gasto com treinos) - use valores estimados baseados nas informações disponíveis
3. Déficit calórico adequado para corredor (considerando performance e recuperação)
4. Sugestão de macronutrientes em g/kg de peso corporal
5. Alertas importantes e recomendações específicas

IMPORTANTE: Se alguma informação essencial (peso, altura, idade) não estiver disponível nas respostas, use valores médios para estimativas mas sinalize claramente nos alertas que são estimativas.
`;
  }

  return `
## DADOS DO ATLETA CORREDOR

### Dados Pessoais
- Nome: ${profile.full_name || client.name}
- Gênero: ${profile.gender || 'Não informado'}
- Data de Nascimento: ${profile.birth_date || 'Não informada'}
- Cidade/Estado: ${profile.city_state || 'Não informado'}
- Profissão: ${profile.profession || 'Não informada'}

### Medidas Corporais
- Peso Atual: ${profile.current_weight || 'N/I'} kg
- Altura: ${profile.height || 'N/I'} cm
- Peso Ideal (desejado): ${profile.ideal_weight || 'N/I'} kg
- Maior Peso: ${profile.max_weight || 'N/I'} kg
- Menor Peso Adulto: ${profile.min_adult_weight || 'N/I'} kg
- Circunferência Cintura: ${profile.waist_circumference || 'N/I'} cm
- Circunferência Quadril: ${profile.hip_circumference || 'N/I'} cm

### Histórico de Corrida
- Pratica Corrida: ${profile.practices_running || 'N/I'}
- Tempo de Prática: ${profile.running_time || 'N/I'}
- Frequência Semanal: ${profile.weekly_frequency || 'N/I'}
- Volume Semanal: ${profile.weekly_volume_km || 'N/I'} km
- Provas Participadas: ${profile.races_participated || 'N/I'}
- Histórico de Lesões: ${profile.injury_history || 'N/I'}

### Objetivos
- Objetivo Principal: ${profile.main_goal || 'N/I'}
- Objetivo Secundário: ${profile.secondary_goal || 'N/I'}
- Meta Específica: ${profile.specific_target || 'N/I'}
- Prazo: ${profile.target_deadline || 'N/I'}

### Rotina e Trabalho
- Horário de Trabalho: ${profile.work_schedule || 'N/I'}
- Trabalho Sedentário: ${profile.sedentary_work || 'N/I'}
- Horas Sentado por Dia: ${profile.hours_sitting || 'N/I'}

### Sono e Estresse
- Horas de Sono: ${profile.sleep_hours || 'N/I'}
- Qualidade do Sono: ${profile.sleep_quality || 'N/I'}
- Horário de Dormir: ${profile.bedtime || 'N/I'}
- Horário de Acordar: ${profile.wake_time || 'N/I'}
- Nível de Estresse: ${profile.stress_level || 'N/I'}
- Causa do Estresse: ${profile.stress_cause || 'N/I'}

### Histórico de Dietas
- Fez Dieta Antes: ${profile.previous_diets || 'N/I'}
- Tipos de Dieta: ${profile.diet_types || 'N/I'}
- Motivo de Parar: ${profile.diet_stop_reason || 'N/I'}
- Acompanhamento Nutricional Atual: ${profile.nutritional_followup || 'N/I'}

### Suplementação
- Usa Suplementos: ${profile.uses_supplements || 'N/I'}
- Suplementos Atuais: ${profile.current_supplements || 'N/I'}
- Já Usou Suplementos: ${profile.used_supplements_before || 'N/I'}
- Suplementos Passados: ${profile.past_supplements || 'N/I'}

### Função Intestinal
- Funcionamento Intestinal: ${profile.intestinal_function || 'N/I'}
- Frequência de Evacuação: ${profile.evacuation_frequency || 'N/I'}
- Problemas Intestinais: ${JSON.stringify(profile.intestinal_problems) || 'N/I'}

### Restrições Alimentares
- Alergias Alimentares: ${profile.food_allergies || 'N/I'}
- Intolerância à Lactose: ${profile.lactose_intolerance || 'N/I'}
- Intolerância ao Glúten: ${profile.gluten_intolerance || 'N/I'}
- Restrições Religiosas: ${profile.religious_restrictions || 'N/I'}
- Alimentos que Não Gosta: ${profile.disliked_foods || 'N/I'}
- Alimentos Favoritos: ${profile.favorite_foods || 'N/I'}

### Rotina Alimentar Atual
- Café da Manhã: ${mealDescription(profile.meal_breakfast)}
- Lanche da Manhã: ${profile.meal_morning_snack_enabled ? mealDescription(profile.meal_morning_snack) : 'Não faz'}
- Almoço: ${mealDescription(profile.meal_lunch)}
- Lanche da Tarde: ${profile.meal_afternoon_snack_enabled ? mealDescription(profile.meal_afternoon_snack) : 'Não faz'}
- Jantar: ${mealDescription(profile.meal_dinner)}
- Ceia: ${profile.meal_supper_enabled ? mealDescription(profile.meal_supper) : 'Não faz'}
- Muda nos Finais de Semana: ${profile.weekend_changes || 'N/I'}
- Descrição Fim de Semana: ${profile.weekend_description || 'N/I'}
${anamneseSection}
Por favor, analise esses dados e forneça:
1. Diagnóstico completo da situação atual do atleta (pontos de atenção, objetivos, possíveis riscos ou limitações)
2. Estimativa de gasto energético (TMB, GET, gasto com treinos)
3. Déficit calórico adequado para corredor (considerando performance e recuperação)
4. Sugestão de macronutrientes em g/kg de peso corporal
5. Alertas importantes e recomendações específicas
`;
}
