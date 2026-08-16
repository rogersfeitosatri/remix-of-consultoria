// Atualiza o plano alimentar ATUAL do atleta com base no último check-in,
// objetivos, evolução e feedback ao longo do histórico de check-ins.
// Retorna o plano atualizado (mesmo formato do analyze-athlete) + uma mensagem
// curta para o admin enviar ao atleta explicando os ajustes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiStructured } from "../_shared/aiClient.ts";
import { loadWorkingPlan } from "../_shared/mealPlanStore.ts"; // ETAPA 6B

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase configuration is missing");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, adminNote } = await req.json();
    if (!clientId) throw new Error("clientId is required");

    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Error("Cliente não encontrado");

    const { data: profile } = await supabase
      .from("athlete_profiles").select("*").eq("client_id", clientId).maybeSingle();

    // Plano atual (obrigatório — é o que será atualizado)
    // ETAPA 6B — plano de trabalho vem do store canônico, não de raw_response.
    const { data: currentAnalysis } = await supabase
      .from("ai_analyses").select("id, diagnosis").eq("client_id", clientId).maybeSingle();
    const working = await loadWorkingPlan(supabase, clientId);
    const currentPlan = working.raw;
    if (!currentPlan?.meal_plan) {
      throw new Error("Não há plano alimentar atual para atualizar. Gere o plano primeiro.");
    }

    // Anamnese mais recente (objetivos/hábitos base)
    const { data: anamnese } = await supabase
      .from("anamnese_responses")
      .select("*, anamnese_forms!inner (title)")
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Histórico de check-ins (mais recente primeiro) + textos das perguntas
    const { data: checkins } = await supabase
      .from("checkin_responses")
      .select("responses, submitted_at, form_id")
      .eq("client_id", clientId)
      .order("submitted_at", { ascending: false })
      .limit(6);

    const formIds = Array.from(new Set((checkins || []).map((c: any) => c.form_id).filter(Boolean)));
    const questionsById: Record<string, string> = {};
    if (formIds.length) {
      const { data: qs } = await supabase
        .from("checkin_questions")
        .select("id, question_text")
        .in("form_id", formIds);
      for (const q of qs || []) questionsById[q.id] = q.question_text;
    }

    if (!checkins || checkins.length === 0) {
      throw new Error("Nenhum check-in encontrado. A atualização usa o histórico de check-ins do atleta.");
    }

    const checkinHistory = (checkins || []).map((c: any, idx: number) => {
      const when = c.submitted_at ? new Date(c.submitted_at).toLocaleDateString("pt-BR") : "s/ data";
      const lines = Object.entries(c.responses || {}).map(([qid, val]: any) => {
        const q = questionsById[qid] || qid;
        const answer = val && typeof val === "object" && "answer" in val ? val.answer : val;
        const comment = val && typeof val === "object" && "comment" in val ? val.comment : null;
        const a = Array.isArray(answer) ? answer.join(", ") : answer;
        return `  - ${q}: ${a ?? "-"}${comment ? ` (obs: ${comment})` : ""}`;
      }).join("\n");
      return `CHECK-IN ${idx === 0 ? "MAIS RECENTE" : `#${idx + 1}`} (${when}):\n${lines}`;
    }).join("\n\n");

    const objectives = [
      profile?.main_goal, profile?.goal, (anamnese as any)?.main_goal,
      (client as any)?.goal, (client as any)?.objective,
    ].filter(Boolean).join(" | ") || "não informado";

    // Prova-alvo e prazo (contextualiza estratégias de CHO/periodização)
    const targetRace = (profile as any)?.target_race || (client as any)?.target_race || null;
    const targetDeadline = (profile as any)?.target_deadline || (client as any)?.target_deadline || null;
    let raceBlock = "PROVA-ALVO: não informada.";
    if (targetRace) {
      let prazo = "";
      if (targetDeadline) {
        const days = Math.round((new Date(targetDeadline).getTime() - Date.now()) / 864e5);
        prazo = days >= 0 ? ` (faltam ~${days} dias, em ${new Date(targetDeadline).toLocaleDateString("pt-BR")})` : ` (data já passou: ${new Date(targetDeadline).toLocaleDateString("pt-BR")})`;
      }
      raceBlock = `PROVA-ALVO: ${targetRace}${prazo}. Contextualize as estratégias (construção x refinamento, carb loading só se justificado).`;
    }

    // Respostas da anamnese (dinâmica de treinos/hábitos), se houver
    const anamneseBlock = anamnese?.responses
      ? `RESPOSTAS DA ANAMNESE (hábitos, rotina e dinâmica de treinos — use se houver; se faltar, siga normal):\n${JSON.stringify(anamnese.responses).slice(0, 4000)}`
      : "ANAMNESE: não disponível — siga normalmente com o plano e os check-ins.";

    const prompt = `Você vai REVISAR e, se necessário, AJUSTAR (de forma conservadora) o plano alimentar de um atleta de endurance, a partir do check-in mais recente e do histórico.

OBJETIVO DO ATLETA: ${objectives}
${raceBlock}

${anamneseBlock}

PLANO ALIMENTAR ATUAL (JSON — mantenha a mesma estrutura ao devolver):
${JSON.stringify(currentPlan.meal_plan)}

ORIENTAÇÕES ESTRATÉGICAS ATUAIS:
${JSON.stringify(currentPlan.strategic_orientations ?? {})}

HISTÓRICO DE CHECK-INS (use principalmente o MAIS RECENTE, mas considere a evolução ao longo do tempo):
${checkinHistory}

${adminNote ? `OBSERVAÇÃO DO NUTRICIONISTA: ${adminNote}\n` : ""}
TAREFA (siga as regras do sistema — ajustes conservadores, só o necessário):
1. "checkin_reading": síntese curta do check-in mais recente (sinais favoráveis e pontos de atenção).
2. Decida se o plano deve ser MANTIDO ou AJUSTADO. Se não houver necessidade real de mudança, defina "no_change_needed": true, explique em "checkin_reading" e NÃO gere adjustment_message.
3. Se ajustar: altere apenas o necessário, preservando horários/preferências/opções que seguem adequados. Nada de reduzir energia ou compensar automaticamente. Periodize CHO conforme a demanda real do treino. Relacione cada mudança a um achado do check-in ou a uma mudança objetiva de treino/prova.
4. "adjustments": lista de mudanças, cada uma com { location (refeição/estratégia), before, after, reason }.
5. "attention_points": pontos que exigem avaliação DIRETA do nutricionista (sinais de alerta, dados insuficientes) — pode ser vazio.
6. Recalcule os totais diários (kcal e g/kg) coerentes com os ajustes.
7. VARIAÇÕES POR DIA: se a dinâmica de treinos indicar que dias diferentes pedem alimentação diferente (ex.: dia de treino longo/intenso com mais carboidrato, dia de descanso com menos), preencha "day_variations" com a chave do dia (seg,ter,qua,qui,sex,sab,dom) contendo as refeições daquele dia. O plano base (meals) vale para os demais dias. Só crie variações quando fizer sentido pela rotina real de treinos; caso contrário, deixe day_variations vazio.
8. "adjustment_message": SOMENTE quando houver mudança — mensagem curta (2 a 5 frases), humana e acolhedora, para o NUTRICIONISTA enviar ao atleta, citando naturalmente o que orientou a mudança. Sem culpa, sem jargão, sem prometer cura.`;

    // Prompt da central de IA (Plano Alimentar) conduz o estilo; as regras
    // conservadoras + de formato são sempre garantidas (fluxo de ajuste por
    // check-in) para o plano sair compatível com o envio ao Zona Nutri.
    let systemPrompt = SYSTEM_PROMPT;
    try {
      const { data: customPrompt } = await supabase
        .from("ai_prompts").select("prompt_text")
        .eq("user_id", client.user_id).eq("context_key", "meal_plan_generation").maybeSingle();
      if (customPrompt?.prompt_text?.trim()) {
        systemPrompt = `${customPrompt.prompt_text.trim()}\n\n${ADJUST_FORMAT_RULES}`;
      }
    } catch { /* usa default */ }

    const { data: analysisData, provider, model } = await callAiStructured({
      systemPrompt,
      userPrompt: prompt,
      toolName: "submit_updated_plan",
      toolDescription: "Submit the updated meal plan and orientations plus an adjustment message for the athlete",
      schema: UPDATE_SCHEMA,
      fallback: 'openai-gpt4o-mini',
    });

    // Ajustes ficam como PROPOSTA (pending_update) até o admin clicar em
    // "Aplicar ajustes ao plano". Mantém o plano atual intocado para envio ao
    // Zona Nutri até a decisão explícita.
    const hasChange = !analysisData.no_change_needed && !!analysisData.meal_plan;

    const pending_update = hasChange
      ? {
          generated_at: new Date().toISOString(),
          model: `${provider}/${model}`,
          athlete_summary: analysisData.athlete_summary ?? currentPlan.athlete_summary,
          carb_estimation: analysisData.carb_estimation ?? currentPlan.carb_estimation,
          carb_progression: analysisData.carb_progression ?? currentPlan.carb_progression,
          meal_plan: analysisData.meal_plan,
          strategic_orientations: analysisData.strategic_orientations ?? currentPlan.strategic_orientations,
          alerts: analysisData.alerts ?? currentPlan.alerts,
        }
      : null;

    const merged = {
      ...currentPlan,
      // Plano atual permanece intocado — mostramos leitura, ajustes e mensagem
      // no painel; a aplicação real acontece via "Aplicar ajustes ao plano".
      adjustment_message: analysisData.adjustment_message ?? "",
      checkin_reading: analysisData.checkin_reading ?? "",
      adjustments: analysisData.adjustments ?? [],
      attention_points: analysisData.attention_points ?? [],
      no_change_needed: analysisData.no_change_needed ?? false,
      pending_update,
      _isNewFormat: true,
      last_update_reason: "checkin_update",
      updated_at: new Date().toISOString(),
    };

    const record = {
      diagnosis: merged.athlete_summary || currentAnalysis?.diagnosis || "",
      energy_expenditure: {
        carb_estimation: merged.carb_estimation,
        carb_progression: merged.carb_progression,
      },
      caloric_deficit: { meal_plan: merged.meal_plan },
      macronutrients: { strategic_orientations: merged.strategic_orientations },
      alerts: merged.alerts || [],
      raw_response: JSON.stringify(merged),
      model_used: `${provider}/${model}`,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveErr } = await supabase
      .from("ai_analyses").update(record).eq("id", currentAnalysis.id).select().single();
    if (saveErr) throw new Error(`Falha ao salvar plano atualizado: ${saveErr.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: saved,
        adjustment_message: merged.adjustment_message,
        checkin_reading: merged.checkin_reading,
        adjustments: merged.adjustments,
        attention_points: merged.attention_points,
        no_change_needed: merged.no_change_needed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("update-meal-plan error:", error);
    const status = (error as any)?.status;
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (status === 429) return json({ error: "Limite de requisições da IA excedido. Tente novamente em alguns minutos." }, 429);
    if (status === 402) return json({ error: "Créditos da IA insuficientes." }, 402);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

const SYSTEM_PROMPT = `Você é um assistente técnico de um nutricionista esportivo especializado em corredores, triatletas e atletas amadores. Sua função é REVISAR o plano alimentar atual a partir do check-in semanal, propor e aplicar AJUSTES CONSERVADORES, e preparar a devolutiva ao atleta. Você é apoio à decisão profissional: não diagnostica, não substitui avaliação clínica e não apresenta inferências como certezas.

ORDEM DO RACIOCÍNIO:
1) Mudanças de modalidade, volume, intensidade, lesão, prova-alvo e rotina.
2) Adesão e contexto das refeições fora do plano.
3) Fome, saciedade, energia, sono, intestino, treino, recuperação e sintomas.
4) Peso e composição corporal dentro do objetivo e do histórico disponível.
5) Estratégias que podem ter perdido a indicação (carb loading, pré/intra-treino de atividade suspensa).
6) Distribuição de proteínas, CHO, gorduras, fibras, frutas, vegetais e líquidos.
7) MENOR conjunto de mudanças capaz de responder aos achados.

REGRAS PARA AJUSTAR:
- Altere SOMENTE o necessário; preserve horários, preferências, opções e estrutura que seguem adequados.
- NÃO reduza energia automaticamente por aumento de peso/composição, lesão ou queda de volume de corrida.
- NÃO faça compensação alimentar por refeições fora do plano. NÃO transforme relato isolado em diagnóstico/tendência.
- Periodize CHO conforme a demanda real do treino; retire carb loading/pré/intra-treino quando a atividade for suspensa; mantenha CHO suficiente para musculação, bike, recuperação e rotina.
- Proteína ~1,4–2,0 g/kg/dia e ~0,25 g/kg (20–40 g) por refeição, individualizando; em lesão evite déficit agressivo e proteína insuficiente.
- Alimentos novos: simples, acessíveis e comuns no Brasil (arroz, feijão, aveia, pão, tapioca, cuscuz, batata, ovos, frango, leite/iogurte, frutas/legumes, castanhas). Sem produtos raros/caros. Não prometa cura; não sugira suplemento/dose sem dados e aprovação do nutri.
- Substituições na MESMA LINHA (ex: "pão francês ou tapioca ou cuscuz"), com porções reais (g, ml, unidades).

SINAIS DE ATENÇÃO (faça só ajuste conservador e destaque para avaliação DIRETA do nutri): compulsão/perda de controle/restrição compensatória; ansiedade/estresse ligados à comida; sinais de baixa disponibilidade energética/RED-S; perda/ganho rápido não explicado; fadiga importante/tontura/desmaio; alteração menstrual; lesões recorrentes/dor persistente; sintomas GI intensos; gestação/alergia/condição clínica/medicamento. Não diagnostique; não use linguagem de culpa.

MENSAGEM AO ATLETA: só quando houver mudança. PT-BR, humana e acolhedora; mostra que o check-in foi lido; explica os ajustes principais e a utilidade prática; orienta contato se houver ponto de atenção; pede para observar a resposta do corpo. Não diga que "falhou/saiu da dieta/precisa compensar". Não liste cada grama.

Se NÃO houver necessidade de ajuste: no_change_needed=true, explique por que manter é a melhor decisão e não gere adjustment_message.`;

// Regras sempre garantidas quando o prompt da central é usado neste fluxo de
// AJUSTE por check-in: mantém a disciplina conservadora + o formato do plano.
const ADJUST_FORMAT_RULES = `REGRAS OBRIGATÓRIAS DESTE AJUSTE (mesmo com prompt customizado):
- AJUSTE CONSERVADOR: altere só o necessário; NÃO reduza energia automaticamente por aumento de peso/composição, lesão ou queda de volume; NÃO faça compensação por refeições fora do plano; não transforme relato isolado em tendência/diagnóstico.
- PERIODIZAÇÃO INTELIGENTE DE CHO — "Fuel for the Work Required" (SEMPRE reavaliar no check-in):
  • Classifique cada dia da semana em nível 0 (descanso), 1 (recuperação/leve), 2 (moderado), 3 (intervalado/tempo/limiar/VO₂/musc. intensa/duplo turno) ou 4 (longão/chave/competição).
  • Redistribua o CHO conforme a demanda (Nível 0 ↓↓ • 1 ↓ • 2 = • 3 ↑ • 4 ↑↑) mantendo a média semanal próxima do alvo — não infle o total.
  • NUNCA reduza CHO em intervalado, tempo run, limiar, VO₂, longão, duplo turno ou competição.
  • Ajuste também as refeições dentro do dia conforme turno do treino (manhã → reforçar jantar véspera/café/pós; tarde → café/almoço/pré/pós; noite → almoço/lanche/pré/pós; descanso → cortar pré-treino e lanches ricos em CHO mantendo proteína, vegetais, frutas e gorduras boas; duplo turno → refeição entre sessões; longão → véspera com CHO discretamente maior + café reforçado + intra + pós).
  • Use os sinais do check-in (fadiga, fome, sono, energia, peso, qualidade dos treinos, aderência, feedback) para redistribuir dias-chave × dias leves e refinar pré/pós/estratégia de longão.
- FORMATO: alimentos que o atleta já usa; porções reais (g, ml, unidades); substituições na MESMA LINHA com "ou"; feche os totais diários (kcal e g/kg).
- VARIAÇÕES POR DIA (day_variations: seg,ter,qua,qui,sex,sab,dom) OBRIGATÓRIAS quando houver dinâmica de treino semanal. Cada dia com meals COMPLETOS (mesma estrutura do meal_plan.meals) + daily_totals ajustados pela periodização de CHO + note curta com o nível. Nunca devolva meals vazio.
- Sinais de atenção (compulsão, RED-S, sintomas GI intensos, etc.) vão para "attention_points" (avaliação direta do nutri), não viram ajuste automático.
- "adjustment_message" só quando houver mudança; "checkin_reading" sempre.`;

// Esquema = análise completa + adjustment_message
const UPDATE_SCHEMA = {
  type: "object",
  properties: {
    athlete_summary: { type: "string", description: "Resumo atualizado objetivo (máx 6 linhas)." },
    carb_estimation: {
      type: "object",
      properties: {
        current_cho_gkg: { type: "number" },
        classification: { type: "string", enum: ["Baixa", "Moderada", "Adequada", "Alta"] },
        current_protein_gkg: { type: "number" },
        current_fat_gkg: { type: "number" },
        estimated_kcal: { type: "number" },
        reasoning: { type: "string" },
      },
      required: ["current_cho_gkg", "classification", "reasoning"],
    },
    carb_progression: {
      type: "object",
      properties: {
        current: { type: "number" },
        next_target: { type: "string" },
        final_goal: { type: "number" },
        increment: { type: "string" },
        rationale: { type: "string" },
      },
      required: ["current", "next_target", "final_goal", "increment", "rationale"],
    },
    meal_plan: {
      type: "object",
      properties: {
        meals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              meal_name: { type: "string" },
              food_groups: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    group: { type: "string" },
                    options: { type: "string", description: "Opções COM PORÇÕES separadas por 'ou'" },
                  },
                  required: ["group", "options"],
                },
              },
              meal_macros: { type: "string" },
              timing_note: { type: "string" },
            },
            required: ["meal_name", "food_groups"],
          },
        },
        daily_totals: {
          type: "object",
          properties: {
            kcal: { type: "number" }, cho_g: { type: "number" }, cho_gkg: { type: "number" },
            protein_g: { type: "number" }, protein_gkg: { type: "number" },
            fat_g: { type: "number" }, fat_gkg: { type: "number" }, kcal_kg: { type: "number" },
          },
          required: ["kcal", "cho_g", "cho_gkg", "protein_g", "fat_g"],
        },
        day_variations: {
          type: "object",
          description: "Variações por dia (seg,ter,qua,qui,sex,sab,dom) já refletindo a periodização de CHO (Fuel for the Work Required). Cada dia com level (0-4), note, meals COMPLETOS (mesma estrutura de meal_plan.meals) e daily_totals ajustados.",
          properties: Object.fromEntries((['seg','ter','qua','qui','sex','sab','dom'] as const).map((d) => [d, {
            type: "object",
            properties: {
              level: { type: "integer", minimum: 0, maximum: 4 },
              note: { type: "string" },
              meals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    meal_name: { type: "string" },
                    food_groups: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { group: { type: "string" }, options: { type: "string" } },
                        required: ["group", "options"],
                      },
                    },
                    meal_macros: { type: "string" },
                    timing_note: { type: "string" },
                  },
                  required: ["meal_name", "food_groups"],
                },
              },
              daily_totals: {
                type: "object",
                properties: {
                  kcal: { type: "number" }, cho_g: { type: "number" }, cho_gkg: { type: "number" },
                  protein_g: { type: "number" }, fat_g: { type: "number" },
                },
                required: ["kcal", "cho_g", "cho_gkg", "protein_g", "fat_g"],
              },
            },
            required: ["level", "meals", "daily_totals"],
          }])),
        },
      },
      required: ["meals", "daily_totals"],
    },
    strategic_orientations: {
      type: "object",
      properties: {
        meal_routine: { type: "array", items: { type: "string" } },
        training_strategy: { type: "array", items: { type: "string" } },
        supplementation: {
          type: "array",
          items: {
            type: "object",
            properties: { supplement: { type: "string" }, recommendation: { type: "string" } },
            required: ["supplement", "recommendation"],
          },
        },
        race_context: { type: "string" },
      },
      required: ["meal_routine", "training_strategy", "supplementation"],
    },
    alerts: { type: "array", items: { type: "string" } },
    checkin_reading: {
      type: "string",
      description: "Síntese curta do check-in mais recente: sinais favoráveis e pontos de atenção.",
    },
    no_change_needed: {
      type: "boolean",
      description: "true quando o plano deve ser MANTIDO sem ajustes. Nesse caso não gerar adjustment_message.",
    },
    adjustments: {
      type: "array",
      description: "Cada ajuste feito no plano.",
      items: {
        type: "object",
        properties: {
          location: { type: "string", description: "Onde no plano (refeição/estratégia)" },
          before: { type: "string", description: "Como estava" },
          after: { type: "string", description: "Como ficou" },
          reason: { type: "string", description: "Justificativa ligada a um achado do check-in/treino" },
        },
        required: ["location", "after", "reason"],
      },
    },
    attention_points: {
      type: "array",
      items: { type: "string" },
      description: "Pontos que exigem avaliação DIRETA do nutricionista (sinais de alerta, dados insuficientes). Pode ser vazio.",
    },
    adjustment_message: {
      type: "string",
      description: "SOMENTE quando houver mudança: mensagem curta (2-5 frases) para o nutricionista enviar ao atleta explicando os ajustes e o porquê.",
    },
  },
  required: ["meal_plan", "strategic_orientations", "checkin_reading"],
  additionalProperties: false,
};
