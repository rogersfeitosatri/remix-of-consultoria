/**
 * ETAPA 3A/6B — Publicação canônica.
 *
 * Publica SEMPRE a versão de trabalho do núcleo canônico
 * (`meal_plan_versions`). `ai_analyses.raw_response` só é usado como leitura
 * legada quando o atleta ainda não possui nenhuma versão (fallback read-only),
 * e nesse caso o conteúdo é migrado para uma versão antes de publicar.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { contentIsPublishable, type MealPlanVersionSource } from '@/lib/mealPlanCore';
import { mealPlanVersionsKey } from '@/hooks/useMealPlanVersions';
import { workingPlanKey } from '@/hooks/useWorkingPlan';
import { loadWorkingPlan, saveWorkingPlan } from '@/lib/planStore';
import { logOperationalEvent } from '@/lib/operationalEvents';

const db = supabase as any;

export function usePublishCurrentPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; source: MealPlanVersionSource }) => {
      const working = await loadWorkingPlan(input.clientId);
      const content = working.raw?.meal_plan ?? null;
      if (!contentIsPublishable(content)) {
        throw new Error('Salve o plano antes de publicar — não há conteúdo para o atleta.');
      }

      // Já publicado e sem draft aberto: nada a fazer.
      if (working.status === 'published') {
        throw new Error('Não há alterações novas para publicar — o plano vigente já está publicado.');
      }

      // Versão canônica de destino (cria a partir do legado quando necessário).
      const versionId = working.versionId ?? (await saveWorkingPlan({
        clientId: input.clientId,
        raw: { ...working.raw, legacy_migrated_at: working.legacy ? new Date().toISOString() : undefined },
        source: working.legacy ? 'legacy_import' : input.source,
        reviewed: true,
      }));

      const { error: pErr } = await db.rpc('publish_meal_plan_version', { p_version_id: versionId });
      if (pErr) throw pErr;

      void logOperationalEvent({
        clientId: input.clientId,
        entityType: 'meal_plan',
        entityId: versionId,
        eventType: 'meal_plan_version_published',
        metadata: { source: input.source, from_legacy: working.legacy },
      });
      return versionId as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: mealPlanVersionsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: workingPlanKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: ['athlete-analysis', vars.clientId] });
      qc.invalidateQueries({ queryKey: ['meal-plan-status'] });
      qc.invalidateQueries({ queryKey: ['operational-dashboard'] });
      toast.success('Plano publicado — já visível na área do atleta.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível publicar o plano.'),
  });
}
