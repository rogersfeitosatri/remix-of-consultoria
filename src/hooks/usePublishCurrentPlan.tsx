/**
 * ETAPA 3A — Publicação canônica a partir do plano de trabalho salvo.
 *
 * Os dois editores (Clássico e Inteligente) continuam salvando o rascunho
 * onde já salvam; a PUBLICAÇÃO é sempre esta: cria uma versão imutável no
 * núcleo canônico e a torna a única vigente para o atleta.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { contentIsPublishable, type MealPlanVersionSource } from '@/lib/mealPlanCore';
import { mealPlanVersionsKey } from '@/hooks/useMealPlanVersions';

const db = supabase as any;

function parseRaw(raw: any): any {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

export function usePublishCurrentPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; source: MealPlanVersionSource }) => {
      const { data: row, error } = await db
        .from('ai_analyses')
        .select('id, raw_response, caloric_deficit')
        .eq('client_id', input.clientId)
        .maybeSingle();
      if (error) throw error;
      const raw = parseRaw(row?.raw_response);
      const content =
        raw?.meal_plan ??
        raw?.basePlan ??
        (row?.caloric_deficit as any)?.meal_plan ??
        null;
      if (!contentIsPublishable(content)) {
        throw new Error('Salve o plano antes de publicar — não há conteúdo para o atleta.');
      }
      const { data: versionId, error: cErr } = await db.rpc('create_meal_plan_version', {
        p_client_id: input.clientId,
        p_content: content,
        p_source: input.source,
        p_orientations: raw?.strategic_orientations ?? null,
        p_status: 'reviewed',
        p_metadata: { published_from: 'ai_analyses', analysis_id: row?.id ?? null },
      });
      if (cErr) throw cErr;
      const { error: pErr } = await db.rpc('publish_meal_plan_version', { p_version_id: versionId });
      if (pErr) throw pErr;
      return versionId as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: mealPlanVersionsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: ['athlete-analysis', vars.clientId] });
      qc.invalidateQueries({ queryKey: ['meal-plan-status'] });
      qc.invalidateQueries({ queryKey: ['operational-dashboard'] });
      toast.success('Plano publicado — já visível na área do atleta.');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível publicar o plano.'),
  });
}
