// Habilidade "Plano alimentar" no backend: carrega o prompt ativo + módulos
// obrigatórios ATIVOS (nunca o de PDF), monta o prompt efetivo, calcula o hash
// e registra a geração em ai_generation_log. Espelha src/lib/aiSkill.ts.

const REQUIRED_MODULES = [
  "nutricao-esportiva-funcional",
  "periodizacao-ciclo-prova",
  "formato-markdown-plano",
  "auditoria-equivalencia-opcoes",
];

export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface LoadedSkill {
  promptText: string;
  promptVersion: number | null;
  modules: { module_key: string; version_number: number | null; content: string }[];
  effectivePrompt: string;
  effectiveHash: string;
  includedModuleKeys: string[];
}

// Carrega prompt ativo (ai_prompts) + módulos ativos (ai_skill_modules) e monta.
export async function loadMealPlanSkill(
  supabase: any,
  ownerUserId: string,
  fallbackPrompt: string,
): Promise<LoadedSkill> {
  let promptText = fallbackPrompt;
  let promptVersion: number | null = null;
  try {
    const { data: cp } = await supabase.from("ai_prompts")
      .select("prompt_text, active_version_number")
      .eq("user_id", ownerUserId).eq("context_key", "meal_plan_generation").maybeSingle();
    if (cp?.prompt_text?.trim()) promptText = cp.prompt_text.trim();
    promptVersion = cp?.active_version_number ?? null;
  } catch { /* usa fallback */ }

  let modulesRows: any[] = [];
  try {
    const { data } = await supabase.from("ai_skill_modules")
      .select("module_key, content, is_active, version_number")
      .eq("user_id", ownerUserId).eq("skill_key", "meal_plan_generation");
    modulesRows = data || [];
  } catch { /* sem módulos */ }

  const byKey = new Map(modulesRows.map((m) => [m.module_key, m]));
  const parts: string[] = [promptText];
  const included: string[] = [];
  const modules: LoadedSkill["modules"] = [];
  for (const key of REQUIRED_MODULES) {
    const m = byKey.get(key);
    const content = (m?.content || "").trim();
    if (!content || !m?.is_active) continue;
    parts.push(`\n\n===== MÓDULO: references/${key}.md =====\n${content}`);
    included.push(key);
    modules.push({ module_key: key, version_number: m.version_number ?? null, content });
  }
  const effectivePrompt = parts.join("");
  return {
    promptText, promptVersion, modules,
    effectivePrompt, effectiveHash: hashString(effectivePrompt), includedModuleKeys: included,
  };
}

// Registra a geração (versões exatas usadas). Best-effort — nunca quebra o fluxo.
export async function logGeneration(
  supabase: any,
  args: {
    ownerUserId: string; clientId: string | null; skill: LoadedSkill; model: string;
    contextKey?: string; meta?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("ai_generation_log").insert({
      user_id: args.ownerUserId,
      client_id: args.clientId,
      context_key: args.contextKey ?? "meal_plan_generation",
      prompt_version_number: args.skill.promptVersion,
      module_versions: args.skill.modules.map((m) => ({ module_key: m.module_key, version_number: m.version_number })),
      effective_prompt_hash: args.skill.effectiveHash,
      effective_prompt_chars: args.skill.effectivePrompt.length,
      model: args.model,
      meta: args.meta ?? {},
    });
  } catch (e) {
    console.warn("logGeneration falhou (ignorado):", (e as Error).message);
  }
}
