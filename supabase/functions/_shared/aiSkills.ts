// ETAPA 5B — Central de IA canônica (backend).
// Carrega a VERSÃO ATIVA do prompt de uma skill, monta o PROMPT EFETIVO (mesma
// composição usada por produção e pelo playground) e registra cada execução em
// ai_runs. Espelha src/lib/aiSkills.ts.

export type AiSkillKey = "meal_plan_generation" | "checkin_analysis";

export interface SkillConfig {
  key: AiSkillKey;
  provider: "openai";
  model: string;
  maxTokens: number;
  systemRules: string[];
}

export const SKILL_CONFIG: Record<AiSkillKey, SkillConfig> = {
  meal_plan_generation: {
    key: "meal_plan_generation",
    provider: "openai",
    model: "gpt-5.6-luna",
    maxTokens: 4000,
    systemRules: [
      "A geração nunca publica: o resultado entra como versão draft em meal_plan_versions.",
      "A versão publicada é imutável — alterações criam nova versão.",
    ],
  },
  checkin_analysis: {
    key: "checkin_analysis",
    provider: "openai",
    model: "gpt-5.6-luna",
    maxTokens: 2000,
    systemRules: [
      "Você NÃO conclui o check-in, NÃO publica feedback e NÃO conclui revisão nutricional.",
      "Suas saídas são sugestões que exigem aprovação humana explícita.",
      "Leia as respostas pelas chaves semânticas (question_key/metric_key) quando existirem.",
      "Se faltar informação, diga explicitamente — nunca invente dados clínicos.",
    ],
  },
};

export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface LoadedSkillVersion {
  skillKey: AiSkillKey;
  promptText: string;
  versionId: string | null;
  versionNumber: number | null;
  versionStatus: string | null;
  provider: string;
  model: string;
  maxTokens: number;
  effectivePrompt: string;
  effectiveHash: string;
}

/**
 * Carrega a versão do prompt: por padrão a ATIVA (produção).
 * `versionId` permite o playground testar um DRAFT sem ativar.
 */
export async function loadSkillVersion(
  supabase: any,
  ownerUserId: string,
  skillKey: AiSkillKey,
  fallbackPrompt: string,
  versionId?: string | null,
): Promise<LoadedSkillVersion> {
  const cfg = SKILL_CONFIG[skillKey];
  let promptText = fallbackPrompt;
  let vId: string | null = null;
  let vNum: number | null = null;
  let vStatus: string | null = null;
  let provider = cfg.provider;
  let model = cfg.model;

  try {
    let q = supabase.from("ai_prompt_versions")
      .select("id, version_number, prompt_text, status, provider, model, max_tokens")
      .eq("user_id", ownerUserId).eq("context_key", skillKey);
    q = versionId ? q.eq("id", versionId) : q.eq("status", "active");
    const { data } = await q.maybeSingle();
    if (data?.prompt_text?.trim()) {
      promptText = data.prompt_text.trim();
      vId = data.id;
      vNum = data.version_number;
      vStatus = data.status;
      if (data.provider) provider = data.provider;
      if (data.model) model = data.model;
    }
  } catch (_e) { /* usa fallback */ }

  // Compatibilidade: instalações antigas ainda podem ter só ai_prompts.
  if (!vId && !versionId) {
    try {
      const { data } = await supabase.from("ai_prompts")
        .select("prompt_text, active_version_number")
        .eq("user_id", ownerUserId).eq("context_key", skillKey).maybeSingle();
      if (data?.prompt_text?.trim()) {
        promptText = data.prompt_text.trim();
        vNum = data.active_version_number ?? null;
      }
    } catch (_e) { /* ignore */ }
  }

  const effectivePrompt = [
    promptText,
    `\n\n===== REGRAS DO SISTEMA (não negociáveis) =====\n${cfg.systemRules.map((r) => `- ${r}`).join("\n")}`,
  ].join("");

  return {
    skillKey,
    promptText,
    versionId: vId,
    versionNumber: vNum,
    versionStatus: vStatus,
    provider,
    model,
    maxTokens: cfg.maxTokens,
    effectivePrompt,
    effectiveHash: hashString(effectivePrompt),
  };
}

export type AiEnvironment = "production" | "test" | "playground";

/** Abre um ai_run (status running). Nunca lança. */
export async function startAiRun(
  supabase: any,
  args: {
    ownerUserId: string;
    clientId?: string | null;
    skill: LoadedSkillVersion;
    environment: AiEnvironment;
    inputSnapshot: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
): Promise<{ id: string | null; startedAt: number }> {
  const startedAt = Date.now();
  try {
    const { data } = await supabase.from("ai_runs").insert({
      user_id: args.ownerUserId,
      client_id: args.clientId ?? null,
      skill_key: args.skill.skillKey,
      prompt_version_id: args.skill.versionId,
      prompt_version_number: args.skill.versionNumber,
      effective_prompt_hash: args.skill.effectiveHash,
      effective_prompt_chars: args.skill.effectivePrompt.length,
      provider: args.skill.provider,
      model: args.skill.model,
      environment: args.environment,
      status: "running",
      input_snapshot: args.inputSnapshot,
      metadata: args.metadata ?? {},
    }).select("id").single();
    return { id: data?.id ?? null, startedAt };
  } catch (e) {
    console.warn("startAiRun falhou (ignorado):", (e as Error).message);
    return { id: null, startedAt };
  }
}

/** Fecha um ai_run. Retry sempre cria run novo — nunca sobrescreve o anterior. */
export async function finishAiRun(
  supabase: any,
  run: { id: string | null; startedAt: number },
  patch: {
    status: "succeeded" | "failed";
    output?: unknown;
    error?: string | null;
    provider?: string;
    model?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  if (!run.id) return;
  try {
    await supabase.from("ai_runs").update({
      status: patch.status,
      output_snapshot: patch.output === undefined ? null : { output: patch.output },
      error: patch.error ?? null,
      duration_ms: Date.now() - run.startedAt,
      ...(patch.provider ? { provider: patch.provider } : {}),
      ...(patch.model ? { model: patch.model } : {}),
      ...(patch.metadata ? { metadata: patch.metadata } : {}),
    }).eq("id", run.id);
  } catch (e) {
    console.warn("finishAiRun falhou (ignorado):", (e as Error).message);
  }
}
