/**
 * ETAPA 6B — Store canônico do Plano Alimentar (edge functions).
 *
 * `ai_analyses.raw_response` deixa de ser store do plano. Toda função que
 * produzia/alterava plano grava agora em `meal_plan_versions` (draft), e a
 * publicação continua sendo exclusivamente humana (publish_meal_plan_version).
 */

export type MealPlanSource =
  | "manual_editor"
  | "classic_editor"
  | "ai_generated"
  | "pdf_import"
  | "markdown_import"
  | "attached_plan"
  | "legacy_import"
  | "checkin_update";

export interface WorkingPlan {
  versionId: string | null;
  status: string | null;
  raw: Record<string, any>;
  legacy: boolean;
}

const OPEN = ["draft", "reviewed"];

function parseRaw(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function versionToRaw(v: any): Record<string, any> {
  return {
    ...(v?.metadata || {}),
    meal_plan: v?.content || {},
    strategic_orientations: v?.orientations ?? undefined,
  };
}

function splitRaw(raw: Record<string, any>) {
  const metadata: Record<string, any> = {};
  for (const k of Object.keys(raw || {})) {
    if (k === "meal_plan" || k === "strategic_orientations") continue;
    metadata[k] = raw[k];
  }
  return { content: raw?.meal_plan ?? {}, orientations: raw?.strategic_orientations ?? null, metadata };
}

async function fetchVersions(supabase: any, clientId: string) {
  const { data } = await supabase
    .from("meal_plan_versions")
    .select("*")
    .eq("client_id", clientId)
    .order("version_number", { ascending: false });
  return (data || []) as any[];
}

/** Plano de trabalho canônico (draft aberto; senão publicada; senão legado read-only). */
export async function loadWorkingPlan(supabase: any, clientId: string): Promise<WorkingPlan> {
  const versions = await fetchVersions(supabase, clientId);
  const working = versions.find((v) => OPEN.includes(v.status));
  const published = versions.find((v) => v.status === "published");
  const chosen = working || published;
  if (chosen) {
    return { versionId: chosen.id, status: chosen.status, raw: versionToRaw(chosen), legacy: false };
  }
  const { data: row } = await supabase
    .from("ai_analyses")
    .select("id, raw_response")
    .eq("client_id", clientId)
    .maybeSingle();
  const raw = parseRaw(row?.raw_response);
  const hasPlan = !!raw?.meal_plan;
  if (hasPlan) {
    // Diagnóstico: sem conteúdo clínico no log.
    console.log("legacy_meal_plan_fallback_used", JSON.stringify({ client_id: clientId, ai_analysis_id: row?.id ?? null }));
  }
  return { versionId: null, status: null, raw, legacy: hasPlan };
}

/** Cria/atualiza a versão de trabalho. Nunca toca na publicada. */
export async function saveWorkingPlan(
  supabase: any,
  input: { clientId: string; raw: Record<string, any>; source: MealPlanSource; reviewed?: boolean; aiRunId?: string | null; userId?: string | null },
): Promise<string> {
  const { content, orientations, metadata } = splitRaw(input.raw || {});
  const versions = await fetchVersions(supabase, input.clientId);
  const working = versions.find((v) => OPEN.includes(v.status));
  const published = versions.find((v) => v.status === "published");

  if (working) {
    const patch: Record<string, any> = {
      content,
      orientations,
      metadata: { ...(working.metadata || {}), ...metadata },
      updated_at: new Date().toISOString(),
    };
    if (input.reviewed) patch.status = "reviewed";
    const { error } = await supabase
      .from("meal_plan_versions")
      .update(patch)
      .eq("id", working.id)
      .in("status", OPEN);
    if (error) throw error;
    return working.id as string;
  }

  const { data, error } = await supabase.rpc("create_meal_plan_version", {
    p_client_id: input.clientId,
    p_content: content,
    p_source: input.source,
    p_orientations: orientations,
    p_parent_version_id: published?.id ?? null,
    p_ai_metadata: input.aiRunId ? { ai_run_id: input.aiRunId } : {},
    p_metadata: metadata,
    p_status: input.reviewed ? "reviewed" : "draft",
  });
  if (error) throw error;
  return data as string;
}

/** Versão publicada (fonte oficial para envio ao atleta / integrações). */
export async function loadPublishedPlan(supabase: any, clientId: string) {
  const { data } = await supabase
    .from("meal_plan_versions")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "published")
    .maybeSingle();
  return data || null;
}
