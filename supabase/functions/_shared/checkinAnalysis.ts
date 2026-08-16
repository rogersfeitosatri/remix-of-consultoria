// ETAPA 5B — pipeline ÚNICO de análise de check-in.
// Produção (analyze-checkin) e Playground (run-ai-skill) usam exatamente esta
// composição: mesma versão de prompt, mesmo provider/modelo, mesmas regras,
// mesmo schema de saída. A única diferença é o `environment` e a persistência.

import { callAiStructured } from "./aiClient.ts";
import { loadSkillVersion, startAiRun, finishAiRun, type AiEnvironment, type LoadedSkillVersion } from "./aiSkills.ts";

export const DEFAULT_CHECKIN_PROMPT =
  `Você é um nutricionista esportivo funcional especializado em corredores de endurance.
Analise o check-in do atleta com base nos dados fornecidos (respostas semânticas, histórico e análises anteriores).

Princípios: individualidade bioquímica, teia de interconexões metabólicas, sinais de sobrecarga/recuperação,
saúde gastrointestinal, energia disponível e aderência ao plano.

Produza uma análise objetiva em json estruturado. Nunca invente dados que não estejam no contexto.
Se faltar informação relevante, aponte isso em "alerts".`;

/** Contrato de saída da skill (json_schema estrito o suficiente para os provedores). */
export const CHECKIN_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Resumo clínico da semana (2-3 parágrafos)." },
    evolution_trend: { type: "string", description: "Tendência: positiva, estável ou negativa, com justificativa." },
    alerts: { type: "array", items: { type: "string" }, description: "Sinais de atenção para o profissional." },
    metrics: {
      type: "array",
      description: "Métricas observadas a partir das chaves semânticas.",
      items: {
        type: "object",
        properties: {
          metric_key: { type: "string" },
          value: { type: "string" },
          direction: { type: "string", enum: ["up", "down", "stable", "unknown"] },
        },
        required: ["metric_key", "value", "direction"],
      },
    },
    feedback_suggestion: { type: "string", description: "Sugestão de feedback ao atleta (máx. 500 caracteres). Requer aprovação humana." },
    plan_change_recommended: { type: "boolean", description: "true se recomenda alteração no plano alimentar." },
    proposed_changes: {
      type: "array",
      description: "Alterações sugeridas (não aplicadas automaticamente).",
      items: {
        type: "object",
        properties: {
          target: { type: "string" },
          change: { type: "string" },
          reason: { type: "string" },
        },
        required: ["target", "change", "reason"],
      },
    },
    rationale: { type: "string", description: "Raciocínio resumido que sustenta a análise." },
  },
  required: ["summary", "evolution_trend", "alerts", "metrics", "feedback_suggestion", "plan_change_recommended", "proposed_changes", "rationale"],
  additionalProperties: false,
};

export interface CheckinContext {
  clientId: string;
  ownerUserId: string;
  clientName: string;
  userPrompt: string;
  structural: boolean;
  inputSnapshot: Record<string, unknown>;
}

/** Monta o contexto dinâmico do check-in — semântica primeiro, fallback legado documentado. */
export async function buildCheckinContext(supabase: any, checkinResponseId: string): Promise<CheckinContext> {
  const { data: response, error } = await supabase
    .from("checkin_responses")
    .select(`*, checkin_forms (title, description), clients (id, name, user_id)`)
    .eq("id", checkinResponseId)
    .single();
  if (error || !response) throw new Error("Check-in não encontrado");

  const clientId = response.client_id;
  const ownerUserId = (response.clients as any)?.user_id;

  // Perguntas: preferir a VERSÃO imutável do formulário (3C); fallback para as atuais.
  let questions: any[] = [];
  if (response.form_version_id) {
    const { data } = await supabase
      .from("checkin_form_version_questions")
      .select("source_question_id, question_text, question_key, metric_key, domain, unit, is_adjustment_trigger, order_index")
      .eq("version_id", response.form_version_id)
      .order("order_index", { ascending: true });
    questions = data || [];
  }
  let semanticSource: "form_version" | "current_questions" = "form_version";
  if (!questions.length) {
    const { data } = await supabase
      .from("checkin_questions")
      .select("id, question_text, question_key, metric_key, domain, unit, is_adjustment_trigger, order_index")
      .eq("form_id", response.form_id)
      .order("order_index", { ascending: true });
    questions = (data || []).map((q: any) => ({ ...q, source_question_id: q.id }));
    semanticSource = "current_questions";
  }

  const answers = questions.map((q: any) => {
    const raw = response.responses?.[q.source_question_id];
    const answer = raw?.answer !== undefined ? raw.answer : raw;
    const comment = raw?.comment;
    const keys = [q.question_key ? `question_key=${q.question_key}` : null,
      q.metric_key ? `metric_key=${q.metric_key}` : null,
      q.unit ? `unit=${q.unit}` : null,
      q.is_adjustment_trigger ? "adjustment_trigger=true" : null]
      .filter(Boolean).join(" ");
    return `- [${keys || "sem semântica (fallback legado por texto)"}] ${q.question_text}: ${JSON.stringify(answer ?? null)}${comment ? ` (comentário: ${comment})` : ""}`;
  }).join("\n");

  const { data: history } = await supabase
    .from("checkin_responses")
    .select("id, submitted_at, responses")
    .eq("client_id", clientId)
    .order("submitted_at", { ascending: false })
    .limit(6);

  const { data: previous } = await supabase
    .from("checkin_ai_analyses")
    .select("created_at, weekly_summary, evolution_trend")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(3);

  const { data: profile } = await supabase
    .from("athlete_profiles").select("*").eq("client_id", clientId).maybeSingle();

  // Revisão estrutural (5A): o contexto vem do VÍNCULO, nunca de contagem de check-ins.
  let structuralBlock = "Este check-in NÃO corresponde a uma revisão estrutural do plano.";
  let structural = false;
  const { data: review } = await supabase
    .from("nutrition_reviews")
    .select("id, scheduled_for, cycle_key, is_structural, status")
    .eq("checkin_response_id", checkinResponseId)
    .maybeSingle();
  if (review?.is_structural) {
    structural = true;
    structuralBlock =
      `Este check-in corresponde a uma REVISÃO ESTRUTURAL do plano (ciclo ${review.cycle_key ?? "?"}, prevista para ${review.scheduled_for}). ` +
      `Faça uma análise mais ampla do ciclo completo. A conclusão da revisão é SEMPRE do profissional.`;
  }

  const userPrompt = [
    `ATLETA: ${(response.clients as any)?.name ?? "—"}`,
    `FORMULÁRIO: ${(response.checkin_forms as any)?.title ?? "—"}`,
    `DATA DO CHECK-IN: ${response.submitted_at}`,
    "",
    "===== {{checkin_answers}} =====",
    answers || "(sem respostas)",
    "",
    "===== {{athlete_profile}} =====",
    profile ? JSON.stringify(profile).slice(0, 4000) : "(sem perfil registrado)",
    "",
    "===== {{checkin_history}} =====",
    (history || []).slice(1).map((h: any, i: number) =>
      `Check-in anterior ${i + 1} (${h.submitted_at}): ${Object.keys(h.responses || {}).length} respostas`).join("\n") || "(sem histórico)",
    "",
    "===== {{previous_analyses}} =====",
    (previous || []).map((p: any) => `(${p.created_at}) ${p.evolution_trend ?? ""} — ${(p.weekly_summary ?? "").slice(0, 400)}`).join("\n") || "(sem análises anteriores)",
    "",
    "===== {{structural_review_context}} =====",
    structuralBlock,
  ].join("\n");

  return {
    clientId,
    ownerUserId,
    clientName: (response.clients as any)?.name ?? "—",
    userPrompt,
    structural,
    inputSnapshot: {
      checkin_response_id: checkinResponseId,
      client_id: clientId,
      form_id: response.form_id,
      form_version_id: response.form_version_id,
      semantic_source: semanticSource,
      structural_review_id: review?.id ?? null,
      answers_count: Object.keys(response.responses || {}).length,
    },
  };
}

export interface RunCheckinAnalysisResult {
  analysis: any;
  provider: string;
  model: string;
  skill: LoadedSkillVersion;
  runId: string | null;
  context: CheckinContext;
}

/** Executa a análise (produção ou playground) registrando ai_run em ambos os casos. */
export async function runCheckinAnalysis(
  supabase: any,
  args: { checkinResponseId: string; environment: AiEnvironment; promptVersionId?: string | null },
): Promise<RunCheckinAnalysisResult> {
  const context = await buildCheckinContext(supabase, args.checkinResponseId);
  const skill = await loadSkillVersion(
    supabase, context.ownerUserId, "checkin_analysis", DEFAULT_CHECKIN_PROMPT, args.promptVersionId ?? null,
  );

  const run = await startAiRun(supabase, {
    ownerUserId: context.ownerUserId,
    clientId: context.clientId,
    skill,
    environment: args.environment,
    inputSnapshot: context.inputSnapshot,
    metadata: { structural_review: context.structural },
  });

  try {
    const { data, provider, model } = await callAiStructured({
      systemPrompt: skill.effectivePrompt,
      userPrompt: context.userPrompt,
      toolName: "registrar_analise_checkin",
      toolDescription: "Registra a análise estruturada do check-in.",
      schema: CHECKIN_ANALYSIS_SCHEMA,
      fallback: "openai-gpt4o",
      primary: "openai",
      openaiModel: skill.model,
    });
    await finishAiRun(supabase, run, { status: "succeeded", output: data, provider, model });
    return { analysis: data, provider, model, skill, runId: run.id, context };
  } catch (e) {
    // Falha de IA é ERRO — nunca vira "sem alteração necessária".
    await finishAiRun(supabase, run, { status: "failed", error: (e as Error).message });
    throw e;
  }
}
