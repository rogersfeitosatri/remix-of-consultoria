/**
 * ETAPA 6B — Store canônico do Plano Alimentar (frontend).
 *
 * REGRA DE OURO: `ai_analyses.raw_response` NÃO é mais store do plano.
 * O plano operacional vive exclusivamente em `meal_plans` + `meal_plan_versions`.
 *
 * Este módulo expõe o "plano de trabalho" (draft vigente; na falta dele, a
 * versão publicada) num formato compatível com o objeto `raw` legado
 * ({ meal_plan, strategic_orientations, ... }), para que os editores existentes
 * continuem funcionando sem redesign — mas gravando SEMPRE no núcleo canônico.
 *
 * Leitura legada (`ai_analyses.raw_response`) existe apenas como FALLBACK
 * READ-ONLY para atletas cujo plano ainda não foi migrado, e é medida via
 * evento `legacy_meal_plan_fallback_used`.
 */
import { supabase } from '@/integrations/supabase/client';
import { logOperationalEvent } from '@/lib/operationalEvents';
import {
  findPublished,
  findWorkingDraft,
  type MealPlanVersion,
  type MealPlanVersionSource,
} from '@/lib/mealPlanCore';

const db = supabase as any;

/** Chaves que NUNCA vão para metadata (têm coluna canônica própria). */
const CANONICAL_KEYS = ['meal_plan', 'strategic_orientations'];

export interface WorkingPlan {
  /** Versão de trabalho (draft/reviewed) ou publicada, quando não há draft. */
  versionId: string | null;
  versionNumber: number | null;
  status: MealPlanVersion['status'] | null;
  /** Objeto compatível com o antigo `raw_response` (somente plano). */
  raw: any;
  /** true quando o conteúdo veio do fallback legado (read-only). */
  legacy: boolean;
  versions: MealPlanVersion[];
}

export function versionToRaw(v?: MealPlanVersion | null): any {
  if (!v) return {};
  const meta = (v.metadata || {}) as Record<string, any>;
  return {
    ...meta,
    meal_plan: v.content || {},
    strategic_orientations: v.orientations ?? undefined,
  };
}

export function rawToVersionFields(raw: any): {
  content: any;
  orientations: any;
  metadata: Record<string, any>;
} {
  const src = raw || {};
  const metadata: Record<string, any> = {};
  for (const k of Object.keys(src)) {
    if (CANONICAL_KEYS.includes(k)) continue;
    metadata[k] = src[k];
  }
  return {
    content: src.meal_plan ?? {},
    orientations: src.strategic_orientations ?? null,
    metadata,
  };
}

async function logLegacyFallback(clientId: string, analysisId?: string | null) {
  await logOperationalEvent({
    clientId,
    entityType: 'meal_plan',
    entityId: clientId,
    eventType: 'legacy_meal_plan_fallback_used',
    // sem conteúdo clínico — apenas rastreio de uso do fallback
    metadata: { ai_analysis_id: analysisId ?? null, surface: 'web' },
  });
}

export async function fetchVersions(clientId: string): Promise<MealPlanVersion[]> {
  const { data, error } = await db
    .from('meal_plan_versions')
    .select('*')
    .eq('client_id', clientId)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return (data || []) as MealPlanVersion[];
}

/**
 * Plano de trabalho canônico. Nenhum writer deve ler `raw_response` para saber
 * "qual é a dieta atual" — use esta função.
 */
export async function loadWorkingPlan(clientId: string): Promise<WorkingPlan> {
  const versions = await fetchVersions(clientId);
  const working = findWorkingDraft(versions);
  const published = findPublished(versions);
  const chosen = working || published;
  if (chosen) {
    return {
      versionId: chosen.id,
      versionNumber: chosen.version_number,
      status: chosen.status,
      raw: versionToRaw(chosen),
      legacy: false,
      versions,
    };
  }
  // Fallback legado READ-ONLY (atleta ainda não migrado).
  const { data: row } = await db
    .from('ai_analyses')
    .select('id, raw_response')
    .eq('client_id', clientId)
    .maybeSingle();
  let raw: any = {};
  try {
    raw = typeof row?.raw_response === 'string' ? JSON.parse(row.raw_response) : (row?.raw_response || {});
  } catch { raw = {}; }
  const hasPlan = !!raw?.meal_plan;
  if (hasPlan) void logLegacyFallback(clientId, row?.id);
  return {
    versionId: null,
    versionNumber: null,
    status: null,
    raw,
    legacy: hasPlan,
    versions,
  };
}

export interface SaveWorkingPlanInput {
  clientId: string;
  /** Objeto no formato legado; será decomposto em content/orientations/metadata. */
  raw: any;
  source: MealPlanVersionSource;
  /** Marca a versão como "pronta para publicar". */
  reviewed?: boolean;
  /** Vincula a execução de IA que originou o rascunho (Etapa 5B). */
  aiRunId?: string | null;
}

/**
 * Salva o plano de trabalho no núcleo canônico.
 * - Se existe draft/reviewed aberto → atualiza (nunca a publicada).
 * - Se não existe → cria nova versão derivada da publicada.
 * NUNCA grava plano em `ai_analyses.raw_response`.
 */
export async function saveWorkingPlan(input: SaveWorkingPlanInput): Promise<string> {
  const { content, orientations, metadata } = rawToVersionFields(input.raw);
  const versions = await fetchVersions(input.clientId);
  const working = findWorkingDraft(versions);
  const published = findPublished(versions);

  if (working) {
    const patch: Record<string, any> = {
      content,
      orientations,
      metadata: { ...(working.metadata || {}), ...metadata },
      updated_at: new Date().toISOString(),
    };
    if (input.reviewed) patch.status = 'reviewed';
    const { error } = await db
      .from('meal_plan_versions')
      .update(patch)
      .eq('id', working.id)
      .in('status', ['draft', 'reviewed']);
    if (error) throw error;
    return working.id;
  }

  const { data, error } = await db.rpc('create_meal_plan_version', {
    p_client_id: input.clientId,
    p_content: content,
    p_source: input.source,
    p_orientations: orientations,
    p_parent_version_id: published?.id ?? null,
    p_ai_metadata: input.aiRunId ? { ai_run_id: input.aiRunId } : {},
    p_metadata: metadata,
    p_status: input.reviewed ? 'reviewed' : 'draft',
  });
  if (error) throw error;
  return data as string;
}

/** Atualiza somente as orientações oficiais do plano de trabalho. */
export async function saveWorkingOrientations(
  clientId: string,
  orientations: any,
  source: MealPlanVersionSource = 'manual_editor',
): Promise<string> {
  const current = await loadWorkingPlan(clientId);
  return saveWorkingPlan({
    clientId,
    raw: { ...current.raw, strategic_orientations: orientations },
    source,
  });
}

/**
 * @deprecated NÃO USAR. `ai_analyses.raw_response` guarda apenas saída bruta de
 * IA. Para plano alimentar use loadWorkingPlan/saveWorkingPlan.
 */
export function getMealPlanFromAiAnalysis(): never {
  throw new Error(
    'ai_analyses.raw_response não é store de plano (Etapa 6B). Use loadWorkingPlan/saveWorkingPlan.',
  );
}
