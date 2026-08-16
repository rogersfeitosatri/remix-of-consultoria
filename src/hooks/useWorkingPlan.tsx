/**
 * ETAPA 6B — Hook único de acesso ao plano de trabalho canônico.
 * Substitui as leituras diretas de `ai_analyses.raw_response` nos editores.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadWorkingPlan, saveWorkingPlan, type WorkingPlan, type SaveWorkingPlanInput } from '@/lib/planStore';
import { mealPlanVersionsKey } from '@/hooks/useMealPlanVersions';

export function workingPlanKey(clientId?: string) {
  return ['working-plan', clientId] as const;
}

export function useWorkingPlan(clientId?: string) {
  return useQuery({
    queryKey: workingPlanKey(clientId),
    enabled: !!clientId,
    staleTime: 0,
    queryFn: async (): Promise<WorkingPlan> => loadWorkingPlan(clientId!),
  });
}

/** Salva no núcleo canônico e invalida todas as superfícies dependentes. */
export function useSaveWorkingPlan() {
  const qc = useQueryClient();
  return async (input: SaveWorkingPlanInput) => {
    const versionId = await saveWorkingPlan(input);
    await qc.invalidateQueries({ queryKey: workingPlanKey(input.clientId) });
    qc.invalidateQueries({ queryKey: mealPlanVersionsKey(input.clientId) });
    qc.invalidateQueries({ queryKey: ['athlete-analysis', input.clientId] });
    qc.invalidateQueries({ queryKey: ['ai_analysis', input.clientId] });
    qc.invalidateQueries({ queryKey: ['meal-plan-status'] });
    return versionId;
  };
}
