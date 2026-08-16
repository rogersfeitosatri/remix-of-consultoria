/**
 * ETAPA 3A — Núcleo canônico do Plano Alimentar (camada pura).
 *
 * Regras de produto codificadas aqui (sem I/O, testável):
 *  - o plano do atleta é uma sequência de VERSÕES;
 *  - existe no máximo UMA versão publicada por vez;
 *  - versão publicada é IMUTÁVEL: editar cria uma nova draft derivada dela;
 *  - IA/importação/anexo produzem apenas versões candidatas (draft);
 *  - somente publicação explícita torna o plano visível para o atleta.
 */
import { getAthleteState, type AthleteStateInput } from '@/lib/athleteState';

export type MealPlanVersionSource =
  | 'manual_editor'
  | 'classic_editor'
  | 'ai_generated'
  | 'pdf_import'
  | 'markdown_import'
  | 'attached_plan'
  | 'legacy_import'
  | 'checkin_update';

export type MealPlanVersionStatus =
  | 'draft'
  | 'reviewed'
  | 'published'
  | 'superseded'
  | 'archived';

/** Conteúdo canônico da versão: plano estruturado e/ou texto (plano anexado). */
export interface MealPlanContent {
  meals?: any[];
  day_variations?: Record<string, any>;
  daily_totals?: any;
  /** Planos anexados/importados como texto livre. */
  text?: string;
  [k: string]: any;
}

export interface MealPlanVersion {
  id: string;
  meal_plan_id: string;
  client_id: string;
  user_id: string;
  version_number: number;
  source: MealPlanVersionSource;
  status: MealPlanVersionStatus;
  content: MealPlanContent;
  orientations: any | null;
  needs_review: boolean;
  created_at: string;
  published_at: string | null;
  superseded_at: string | null;
  parent_version_id: string | null;
  ai_metadata: Record<string, any>;
  metadata: Record<string, any>;
}

export const SOURCE_LABEL: Record<MealPlanVersionSource, string> = {
  manual_editor: 'Editor inteligente',
  classic_editor: 'Editor clássico',
  ai_generated: 'Gerado por IA',
  pdf_import: 'Importado de PDF',
  markdown_import: 'Importado de Markdown',
  attached_plan: 'Plano anexado',
  legacy_import: 'Migrado do histórico',
  checkin_update: 'Ajuste do check-in',
};

export const STATUS_LABEL: Record<MealPlanVersionStatus, string> = {
  draft: 'Rascunho',
  reviewed: 'Pronto para publicar',
  published: 'Publicado',
  superseded: 'Substituído',
  archived: 'Arquivado',
};

/** Estado do plano usado na lista de planos alimentares. */
export type MealPlanListState =
  | 'no_plan'
  | 'draft'
  | 'ready'
  | 'published'
  | 'proposal';

export function isEmptyContent(content?: MealPlanContent | null): boolean {
  return !contentIsPublishable(content);
}

/** true quando a versão não tem nada publicável. */
export function contentIsPublishable(content?: MealPlanContent | null): boolean {
  if (!content) return false;
  if (Array.isArray(content.meals) && content.meals.length > 0) return true;
  const vars = content.day_variations || {};
  for (const k of Object.keys(vars)) {
    const v: any = (vars as any)[k];
    const arr = Array.isArray(v) ? v : v?.meals;
    if (Array.isArray(arr) && arr.length > 0) return true;
  }
  if (typeof content.text === 'string' && content.text.trim().length > 0) return true;
  return false;
}

/** Versão publicada corrente (a única possível). */
export function findPublished(versions: MealPlanVersion[]): MealPlanVersion | null {
  return versions.find((v) => v.status === 'published') ?? null;
}

/** Draft/reviewed mais recente — a versão em que o nutricionista está trabalhando. */
export function findWorkingDraft(versions: MealPlanVersion[]): MealPlanVersion | null {
  const open = versions
    .filter((v) => v.status === 'draft' || v.status === 'reviewed')
    .sort((a, b) => b.version_number - a.version_number);
  return open[0] ?? null;
}

/** Estado do plano para a lista/hub. */
export function planListState(
  versions: MealPlanVersion[],
  opts?: { hasPendingProposal?: boolean },
): MealPlanListState {
  if (opts?.hasPendingProposal) return 'proposal';
  const published = findPublished(versions);
  const working = findWorkingDraft(versions);
  if (working?.status === 'reviewed') return 'ready';
  if (working) return 'draft';
  if (published) return 'published';
  return 'no_plan';
}

export const LIST_STATE_LABEL: Record<MealPlanListState, string> = {
  no_plan: 'Sem plano',
  draft: 'Rascunho',
  ready: 'Pronto para publicar',
  published: 'Publicado',
  proposal: 'Proposta de ajuste',
};

/**
 * Elegibilidade canônica (Etapa 1/2A): quem pode receber AÇÃO de plano.
 * training-only, congelado, encerrado ou arquivado NÃO recebe.
 */
export function canActOnMealPlan(client: AthleteStateInput | null | undefined): boolean {
  return getAthleteState(client).canReceiveMealPlanActions;
}

/**
 * Data canônica do plano — nunca mais `ai_analyses.updated_at`.
 */
export function planDate(version?: MealPlanVersion | null): string | null {
  if (!version) return null;
  return version.published_at || version.created_at;
}

/** Rótulo curto de uma versão: "v3 — publicada em 12/08/2026". */
export function versionLabel(v: MealPlanVersion): string {
  const date = planDate(v);
  const when = date ? new Date(date).toLocaleDateString('pt-BR') : '—';
  const verb = v.status === 'published' ? 'publicada em' : 'criada em';
  return `v${v.version_number} — ${verb} ${when}`;
}

/**
 * Ao editar um plano PUBLICADO, o editor deve trabalhar sobre uma nova draft
 * derivada. Esta função só decide (não grava): retorna o que deve acontecer.
 */
export function resolveEditTarget(versions: MealPlanVersion[]):
  | { action: 'edit_draft'; versionId: string }
  | { action: 'fork_published'; parentId: string }
  | { action: 'create_first' } {
  const working = findWorkingDraft(versions);
  if (working) return { action: 'edit_draft', versionId: working.id };
  const published = findPublished(versions);
  if (published) return { action: 'fork_published', parentId: published.id };
  return { action: 'create_first' };
}
