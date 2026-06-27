import { createClient } from "npm:@supabase/supabase-js@2";

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration is missing');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { clientId, adminGuidance } = await req.json();
    if (!clientId) throw new Error('clientId is required');

    console.log('Analyzing athlete for client:', clientId);

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) throw new Error('Failed to fetch client data');

    const { data: profile } = await supabase
      .from('athlete_profiles')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    const { data: anamneseResponses } = await supabase
      .from('anamnese_responses')
      .select(`*, anamnese_forms!inner (title, user_id)`)
      .eq('client_id', clientId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!profile && !anamneseResponses) {
      throw new Error('Nenhum dado encontrado para análise. O atleta precisa ter preenchido a anamnese ou ter um perfil cadastrado.');
    }

    let anamneseQuestions: any[] = [];
    if (anamneseResponses?.form_id) {
      const { data: questions } = await supabase
        .from('anamnese_questions')
        .select('id, question_text, section')
        .eq('form_id', anamneseResponses.form_id)
        .order('order_index', { ascending: true });
      anamneseQuestions = questions || [];
    }

    const prompt = buildAnalysisPrompt(profile, client, anamneseResponses, anamneseQuestions, adminGuidance);

    console.log('Sending request to Lovable AI Gateway...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_athlete_analysis",
              description: "Submit the complete structured nutritional analysis for the athlete",
              parameters: ANALYSIS_SCHEMA,
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "submit_athlete_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured data");

    const analysisData = JSON.parse(toolCall.function.arguments);
    console.log('AI analysis received with sections:', Object.keys(analysisData));

    // Map to DB columns - store the new structured analysis in diagnosis (text) + raw_response (full JSON)
    const { data: existingAnalysis } = await supabase
      .from('ai_analyses')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle();

    const analysisRecord = {
      client_id: clientId,
      athlete_profile_id: profile?.id || null,
      diagnosis: analysisData.athlete_summary || '',
      energy_expenditure: {
        carb_estimation: analysisData.carb_estimation,
        carb_progression: analysisData.carb_progression,
      },
      caloric_deficit: {
        meal_plan: analysisData.meal_plan,
      },
      macronutrients: {
        strategic_orientations: analysisData.strategic_orientations,
      },
      alerts: analysisData.alerts || [],
      raw_response: JSON.stringify(analysisData),
      model_used: 'google/gemini-2.5-pro',
    };

    let result;
    if (existingAnalysis) {
      const { data: updated, error: updateError } = await supabase
        .from('ai_analyses')
        .update(analysisRecord)
        .eq('id', existingAnalysis.id)
        .select()
        .single();
      if (updateError) throw new Error('Failed to update analysis');
      result = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('ai_analyses')
        .insert(analysisRecord)
        .select()
        .single();
      if (insertError) throw new Error('Failed to save analysis');
      result = inserted;
    }

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

const SYSTEM_PROMPT = `Você é um nutricionista esportivo funcional especializado em atletas de endurance (corrida, triathlon, ciclismo), baseando suas análises no Tratado de Nutrição Esportiva Funcional (Paschoal & Naves) e evidências científicas atuais.

Sua tarefa é analisar a anamnese do atleta e gerar uma análise estruturada completa com foco em APLICAÇÃO PRÁTICA.

REGRAS:
- Linguagem simples, clara e direta
- Foco em aplicação prática
- Evitar blocos longos de texto
- Priorizar leitura rápida
- Usar os alimentos que o atleta JÁ consome para montar o plano
- Sempre manter substituições na MESMA LINHA (ex: "pão francês ou tapioca ou cuscuz")
- Considerar a prova alvo e tempo até ela para contextualizar estratégias
- Basear estimativas de CHO nos alimentos relatados na anamnese
- O PLANO ALIMENTAR DEVE TER PORÇÕES E QUANTIDADES REAIS (gramas, ml, unidades) condizentes com os alvos de macros e calorias
- Cada opção de alimento deve incluir a quantidade (ex: "2 fatias de pão francês (100g) ou 1 tapioca grande (80g) ou 1 cuscuz médio (120g)")
- A soma das refeições deve fechar com o alvo calórico e de macronutrientes definido na progressão
- Incluir ao final do plano um resumo dos totais aproximados de macros e calorias do dia`;

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    athlete_summary: {
      type: "string",
      description: "Resumo inteligente objetivo: modalidade, nível, objetivo principal, rotina de treinos, pontos de atenção comportamentais e alimentares. Máximo 6 linhas."
    },
    carb_estimation: {
      type: "object",
      description: "Estimativa nutricional atual baseada nos alimentos relatados",
      properties: {
        current_cho_gkg: { type: "number", description: "Estimativa atual de CHO em g/kg" },
        classification: { type: "string", enum: ["Baixa", "Moderada", "Adequada", "Alta"], description: "Classificação da ingestão" },
        current_protein_gkg: { type: "number", description: "Estimativa atual de proteína em g/kg" },
        current_fat_gkg: { type: "number", description: "Estimativa atual de gordura em g/kg" },
        estimated_kcal: { type: "number", description: "Estimativa de kcal total diária atual" },
        reasoning: { type: "string", description: "Breve justificativa da estimativa baseada nos alimentos citados" },
      },
      required: ["current_cho_gkg", "classification", "reasoning"],
    },
    carb_progression: {
      type: "object",
      description: "Estratégia de progressão de carboidratos",
      properties: {
        current: { type: "number", description: "CHO atual estimado g/kg" },
        next_target: { type: "string", description: "Próximo alvo (ex: 4.2–4.7 g/kg)" },
        final_goal: { type: "number", description: "Meta final de CHO g/kg" },
        increment: { type: "string", description: "Incremento sugerido (ex: +1 a +1.5 g/kg)" },
        rationale: { type: "string", description: "Justificativa da progressão considerando objetivo e fase" },
      },
      required: ["current", "next_target", "final_goal", "increment", "rationale"],
    },
    meal_plan: {
      type: "object",
      description: "Plano alimentar baseado nos hábitos do atleta",
      properties: {
        meals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              meal_name: { type: "string", description: "Nome da refeição (Café da manhã, Lanche da manhã, Almoço, Lanche da tarde, Jantar, Ceia)" },
              food_groups: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    group: { type: "string", description: "Grupo alimentar (Carboidrato, Proteína, Gordura, Fruta, Vegetal, Fibra)" },
                    options: { type: "string", description: "Opções COM PORÇÕES E QUANTIDADES separadas por 'ou' (ex: 2 fatias de pão francês (100g) ou 1 tapioca grande (80g) ou 1 cuscuz médio (120g))" },
                  },
                  required: ["group", "options"],
                },
              },
              meal_macros: { type: "string", description: "Resumo aproximado de macros da refeição (ex: ~45g CHO, ~25g PTN, ~10g LIP, ~370 kcal)" },
              timing_note: { type: "string", description: "Nota sobre timing se relevante (pré-treino, pós-treino)" },
            },
            required: ["meal_name", "food_groups"],
          },
        },
        daily_totals: {
          type: "object",
          description: "Totais diários aproximados do plano",
          properties: {
            kcal: { type: "number", description: "Total de kcal" },
            cho_g: { type: "number", description: "Total de CHO em gramas" },
            cho_gkg: { type: "number", description: "CHO em g/kg" },
            protein_g: { type: "number", description: "Total de proteína em gramas" },
            protein_gkg: { type: "number", description: "Proteína em g/kg" },
            fat_g: { type: "number", description: "Total de gordura em gramas" },
          },
          required: ["kcal", "cho_g", "cho_gkg", "protein_g", "fat_g"],
        },
      },
      required: ["meals", "daily_totals"],
    },
    strategic_orientations: {
      type: "object",
      description: "Orientações estratégicas personalizadas",
      properties: {
        meal_routine: {
          type: "array",
          items: { type: "string" },
          description: "Orientações sobre rotina alimentar (distribuição, ajustes pré/pós-treino, organização)"
        },
        training_strategy: {
          type: "array",
          items: { type: "string" },
          description: "Estratégias para treino (CHO antes/durante/depois, ajuste por volume)"
        },
        supplementation: {
          type: "array",
          items: {
            type: "object",
            properties: {
              supplement: { type: "string", description: "Nome do suplemento" },
              recommendation: { type: "string", description: "Recomendação contextualizada" },
            },
            required: ["supplement", "recommendation"],
          },
          description: "Sugestões de suplementação contextualizada"
        },
        race_context: { type: "string", description: "Contexto em relação à prova alvo (construção vs refinamento)" },
      },
      required: ["meal_routine", "training_strategy", "supplementation"],
    },
    alerts: {
      type: "array",
      items: { type: "string" },
      description: "Alertas importantes e objetivos: baixa ingestão de CHO, proteína insuficiente, falta de estratégia em treinos longos, risco de baixa disponibilidade energética, etc."
    },
  },
  required: ["athlete_summary", "carb_estimation", "carb_progression", "meal_plan", "strategic_orientations", "alerts"],
  additionalProperties: false,
};

function buildAnalysisPrompt(profile: any, client: any, anamneseResponses: any, anamneseQuestions: any[], adminGuidance?: any): string {
  let guidanceBlock = '';
  if (adminGuidance && typeof adminGuidance === 'object') {
    const g = adminGuidance;
    const lines: string[] = [];
    if (g.meals_count) lines.push(`- Número de refeições no plano: ${g.meals_count}`);
    if (g.target_kcal) lines.push(`- Meta calórica diária: ${g.target_kcal} kcal`);
    if (g.target_cho_gkg) lines.push(`- Meta de CHO: ${g.target_cho_gkg} g/kg`);
    if (g.target_protein_gkg) lines.push(`- Meta de Proteína: ${g.target_protein_gkg} g/kg`);
    if (g.target_fat_gkg) lines.push(`- Meta de Gordura: ${g.target_fat_gkg} g/kg`);
    if (g.custom_instructions && String(g.custom_instructions).trim()) {
      lines.push(`- Orientações adicionais do nutricionista: ${String(g.custom_instructions).trim()}`);
    }
    if (lines.length) {
      guidanceBlock = `\n\n## ORIENTAÇÕES OBRIGATÓRIAS DO NUTRICIONISTA RESPONSÁVEL\nUse EXATAMENTE estes parâmetros ao montar a progressão de carboidratos, o plano alimentar e os totais diários. Estes valores PREVALECEM sobre estimativas automáticas:\n${lines.join('\n')}\n`;
    }
  }

  const mealDescription = (meal: any) => {
    if (!meal) return 'Não informado';
    return `Horário: ${meal.time || 'N/I'}, Local: ${meal.location || 'N/I'}, Alimentos: ${meal.foods || 'N/I'}`;
  };

  let anamneseSection = '';
  if (anamneseResponses?.responses && anamneseQuestions.length > 0) {
    anamneseSection = `\n### Respostas da Anamnese Dinâmica\n`;
    const responses = anamneseResponses.responses;
    const groupedBySection: Record<string, string[]> = {};
    
    for (const question of anamneseQuestions) {
      const response = responses[question.id];
      if (response) {
        const section = question.section || 'Geral';
        if (!groupedBySection[section]) groupedBySection[section] = [];
        
        let answerText = '';
        if (typeof response === 'object' && response.answer !== undefined) {
          const answer = response.answer;
          answerText = Array.isArray(answer) ? answer.join(', ') : String(answer);
          if (response.comment) answerText += ` (Comentário: ${response.comment})`;
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

  if (!profile) {
    return `## DADOS DO ATLETA\n### Dados Pessoais\n- Nome: ${client.name}\n- Email: ${client.email || 'N/I'}\n- Telefone: ${client.phone || 'N/I'}\n- Prova Alvo: ${client.target_race || 'N/I'}\n${anamneseSection}${guidanceBlock}\n\nIMPORTANTE: Se peso/altura não disponíveis, use estimativas e sinalize nos alertas.`;
  }

  return `## DADOS DO ATLETA
### Dados Pessoais
- Nome: ${profile.full_name || client.name}
- Gênero: ${profile.gender || 'N/I'}
- Data de Nascimento: ${profile.birth_date || 'N/I'}
- Cidade/Estado: ${profile.city_state || 'N/I'}
- Profissão: ${profile.profession || 'N/I'}

### Medidas Corporais
- Peso Atual: ${profile.current_weight || 'N/I'} kg
- Altura: ${profile.height || 'N/I'} cm
- Peso Ideal: ${profile.ideal_weight || 'N/I'} kg
- Maior Peso: ${profile.max_weight || 'N/I'} kg
- Menor Peso Adulto: ${profile.min_adult_weight || 'N/I'} kg
- Cintura: ${profile.waist_circumference || 'N/I'} cm
- Quadril: ${profile.hip_circumference || 'N/I'} cm

### Histórico Esportivo
- Pratica Corrida: ${profile.practices_running || 'N/I'}
- Tempo de Prática: ${profile.running_time || 'N/I'}
- Frequência Semanal: ${profile.weekly_frequency || 'N/I'}
- Volume Semanal: ${profile.weekly_volume_km || 'N/I'} km
- Provas: ${profile.races_participated || 'N/I'}
- Prova Alvo: ${profile.target_race || client.target_race || 'N/I'}
- Lesões: ${profile.injury_history || 'N/I'}

### Objetivos
- Principal: ${profile.main_goal || 'N/I'}
- Secundário: ${profile.secondary_goal || 'N/I'}
- Meta Específica: ${profile.specific_target || 'N/I'}
- Prazo: ${profile.target_deadline || 'N/I'}

### Rotina
- Trabalho: ${profile.work_schedule || 'N/I'}
- Sedentário: ${profile.sedentary_work || 'N/I'}
- Horas sentado: ${profile.hours_sitting || 'N/I'}

### Sono e Estresse
- Sono: ${profile.sleep_hours || 'N/I'}h | Qualidade: ${profile.sleep_quality || 'N/I'}
- Dormir: ${profile.bedtime || 'N/I'} | Acordar: ${profile.wake_time || 'N/I'}
- Estresse: ${profile.stress_level || 'N/I'} - ${profile.stress_cause || 'N/I'}

### Dietas Anteriores
- Fez dieta: ${profile.previous_diets || 'N/I'} | Tipos: ${profile.diet_types || 'N/I'}
- Motivo de parar: ${profile.diet_stop_reason || 'N/I'}

### Suplementação
- Usa: ${profile.uses_supplements || 'N/I'} | Atuais: ${profile.current_supplements || 'N/I'}
- Já usou: ${profile.used_supplements_before || 'N/I'} | Passados: ${profile.past_supplements || 'N/I'}

### Intestino
- Função: ${profile.intestinal_function || 'N/I'} | Evacuação: ${profile.evacuation_frequency || 'N/I'}

### Restrições
- Alergias: ${profile.food_allergies || 'N/I'}
- Lactose: ${profile.lactose_intolerance || 'N/I'} | Glúten: ${profile.gluten_intolerance || 'N/I'}
- Religiosas: ${profile.religious_restrictions || 'N/I'}
- Não gosta: ${profile.disliked_foods || 'N/I'}
- Favoritos: ${profile.favorite_foods || 'N/I'}

### Rotina Alimentar Atual
- Café da Manhã: ${mealDescription(profile.meal_breakfast)}
- Lanche Manhã: ${profile.meal_morning_snack_enabled ? mealDescription(profile.meal_morning_snack) : 'Não faz'}
- Almoço: ${mealDescription(profile.meal_lunch)}
- Lanche Tarde: ${profile.meal_afternoon_snack_enabled ? mealDescription(profile.meal_afternoon_snack) : 'Não faz'}
- Jantar: ${mealDescription(profile.meal_dinner)}
- Ceia: ${profile.meal_supper_enabled ? mealDescription(profile.meal_supper) : 'Não faz'}
- Fim de semana: ${profile.weekend_changes || 'N/I'} - ${profile.weekend_description || 'N/I'}
${anamneseSection}${guidanceBlock}`;
}
