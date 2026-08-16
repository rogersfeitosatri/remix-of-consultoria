/**
 * ETAPA 3A — Acesso único ao núcleo canônico de plano alimentar.
 * Editor Clássico e Editor Inteligente usam ESTE hook (nenhum grava direto).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  type MealPlanVersion,
  type MealPlanVersionSource,
  type MealPlanContent,
  findPublished,
  findWorkingDraft,
  contentIsPublishable,
} from '@/lib/mealPlanCore';

const db = supabase as any;

export function mealPlanVersionsKey(clientId?: string) {
  return ['meal-plan-versions', clientId] as const;
}

export function useMealPlanVersions(clientId?: string) {
  return useQuery({
    queryKey: mealPlanVersionsKey(clientId),
    enabled: !!clientId,
    staleTime: 0,
    queryFn: async (): Promise<MealPlanVersion[]> => {
      const { data, error } = await db
        .from('meal_plan_versions')
        .select('*')
        .eq('client_id', clientId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return (data || []) as MealPlanVersion[];
    },
  });
}

/** Versão publicada (fonte da verdade para a área do atleta e para envios). */
export function usePublishedMealPlan(clientId?: string) {
  const q = useMealPlanVersions(clientId);
  return { ...q, published: findPublished(q.data || []) };
}

interface CreateVersionInput {
  clientId: string;
  content: MealPlanContent;
  orientations?: any;
  source: MealPlanVersionSource;
  parentVersionId?: string | null;
  aiMetadata?: Record<string, any>;
  metadata?: Record<string, any>;
  /** true => marca como "pronto para publicar" (sem publicar). */
  reviewed?: boolean;
}

export function useCreateMealPlanVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateVersionInput): Promise<string> => {
      const { data, error } = await db.rpc('create_meal_plan_version', {
        p_client_id: input.clientId,
        p_content: input.content ?? {},
        p_source: input.source,
        p_orientations: input.orientations ?? null,
        p_parent_version_id: input.parentVersionId ?? null,
        p_ai_metadata: input.aiMetadata ?? {},
        p_metadata: input.metadata ?? {},
        p_status: input.reviewed ? 'reviewed' : 'draft',
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: mealPlanVersionsKey(vars.clientId) });
    },
  });
}

/** Atualiza uma DRAFT (nunca uma publicada — o banco bloqueia). */
export function useUpdateMealPlanDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      versionId: string;
      clientId: string;
      content?: MealPlanContent;
      orientations?: any;
      reviewed?: boolean;
    }) => {
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (input.content !== undefined) patch.content = input.content;
      if (input.orientations !== undefined) patch.orientations = input.orientations;
      if (input.reviewed !== undefined) patch.status = input.reviewed ? 'reviewed' : 'draft';
      const { error } = await db
        .from('meal_plan_versions')
        .update(patch)
        .eq('id', input.versionId)
        .in('status', ['draft', 'reviewed']);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: mealPlanVersionsKey(vars.clientId) });
    },
  });
}

/** Publicação: única forma de o plano chegar ao atleta. Transacional (RPC). */
export function usePublishMealPlanVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { versionId: string; clientId: string }) => {
      const { error } = await db.rpc('publish_meal_plan_version', {
        p_version_id: input.versionId,
      });
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: mealPlanVersionsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: ['meal-plan-status'] });
      qc.invalidateQueries({ queryKey: ['operational-dashboard'] });
      qc.invalidateQueries({ queryKey: ['athlete-plan'] });
      toast.success('Plano publicado para o atleta');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível publicar o plano'),
  });
}

/**
 * Salvar + publicar em um passo (botão "Publicar" dos dois editores).
 * Reaproveita a draft aberta; se o vigente estiver publicado, cria versão nova.
 */
export function useSaveAndPublishMealPlan() {
  const create = useCreateMealPlanVersion();
  const update = useUpdateMealPlanDraft();
  const publish = usePublishMealPlanVersion();

  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      content: MealPlanContent;
      orientations?: any;
      source: MealPlanVersionSource;
      versions: MealPlanVersion[];
    }) => {
      if (!contentIsPublishable(input.content)) {
        throw new Error('O plano está vazio — nada a publicar.');
      }
      const working = findWorkingDraft(input.versions);
      let versionId: string;
      if (working) {
        await update.mutateAsync({
          versionId: working.id,
          clientId: input.clientId,
          content: input.content,
          orientations: input.orientations,
          reviewed: true,
        });
        versionId = working.id;
      } else {
        versionId = await create.mutateAsync({
          clientId: input.clientId,
          content: input.content,
          orientations: input.orientations,
          source: input.source,
          parentVersionId: findPublished(input.versions)?.id ?? null,
          reviewed: true,
        });
      }
      await publish.mutateAsync({ versionId, clientId: input.clientId });
      return versionId;
    },
  });
}
