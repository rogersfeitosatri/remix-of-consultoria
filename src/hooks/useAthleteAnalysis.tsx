import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logOperationalEvent } from '@/lib/operationalEvents';

export interface MealFoodGroup {
  group: string;
  options: string;
}

export interface MealOption {
  label?: string;
  foods?: any[];
  food_groups?: MealFoodGroup[];
}

export interface MealPlanMeal {
  meal_name: string;
  food_groups?: MealFoodGroup[];
  foods?: any[];
  options?: MealOption[];
  meal_macros?: string;
  timing_note?: string;
}

export interface DailyTotals {
  kcal?: number;
  cho_g?: number;
  cho_gkg?: number;
  protein_g?: number;
  protein_gkg?: number;
  fat_g?: number;
  fat_gkg?: number;
  kcal_kg?: number;
}

export interface StrategicOrientations {
  meal_routine?: string[];
  training_strategy?: string[];
  supplementation?: { supplement: string; recommendation: string }[];
  race_context?: string;
}

export interface AthleteAnalysis {
  athlete_summary?: string;
  meal_plan?: { meals?: MealPlanMeal[]; daily_totals?: DailyTotals };
  strategic_orientations?: StrategicOrientations;
  carb_estimation?: any;
  alerts?: string[];
  updated_at?: string;
}

function parseJsonField<T>(field: any): T | undefined {
  if (!field) return undefined;
  if (typeof field === 'string') {
    try { return JSON.parse(field) as T; } catch { return undefined; }
  }
  return field as T;
}

// Reconstrói a análise estruturada priorizando raw_response (formato novo),
// com fallback para as colunas Json individuais.
function parseAnalysis(row: any): AthleteAnalysis | null {
  if (!row) return null;

  if (row.raw_response) {
    try {
      const parsed = JSON.parse(row.raw_response);
      if (parsed && (parsed.meal_plan || parsed.strategic_orientations)) {
        return { ...parsed, updated_at: row.updated_at };
      }
    } catch { /* cai para o fallback */ }
  }

  const cd = parseJsonField<any>(row.caloric_deficit) || {};
  const mac = parseJsonField<any>(row.macronutrients) || {};
  const en = parseJsonField<any>(row.energy_expenditure) || {};
  return {
    athlete_summary: row.diagnosis || undefined,
    meal_plan: cd.meal_plan,
    strategic_orientations: mac.strategic_orientations,
    carb_estimation: en.carb_estimation,
    alerts: row.alerts || undefined,
    updated_at: row.updated_at,
  };
}

export function useAthleteAnalysis(clientId?: string | null) {
  return useQuery({
    queryKey: ['athlete-analysis', clientId],
    enabled: !!clientId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<AthleteAnalysis | null> => {
      if (!clientId) return null;
      const { data, error } = await (supabase as any)
        .from('ai_analyses')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      const analysis = parseAnalysis(data);

      // ETAPA 3A/6B — o plano do atleta é SEMPRE a versão publicada.
      const { data: pub } = await (supabase as any)
        .from('meal_plan_versions')
        .select('content, orientations, published_at')
        .eq('client_id', clientId)
        .eq('status', 'published')
        .maybeSingle();
      if (pub?.content) {
        return {
          ...(analysis || {}),
          meal_plan: pub.content,
          strategic_orientations: pub.orientations ?? analysis?.strategic_orientations,
          updated_at: pub.published_at || analysis?.updated_at,
        } as AthleteAnalysis;
      }
      // Fallback legado READ-ONLY (atleta ainda não migrado) — medido para que
      // possamos remover quando chegar a zero.
      if (analysis?.meal_plan) {
        void logOperationalEvent({
          clientId,
          entityType: 'meal_plan',
          entityId: clientId,
          eventType: 'legacy_meal_plan_fallback_used',
          metadata: { surface: 'athlete_area' },
        });
      }
      return analysis;
    },
  });
}
