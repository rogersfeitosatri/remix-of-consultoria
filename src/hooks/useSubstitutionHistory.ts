// Memória de substituições do nutricionista.
// Aprende com o que foi salvo em planos anteriores para sugerir os
// substitutos mais usados ao digitar novos planos.

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PlanAst } from '@/lib/smartPlan/ast';

export interface LearnedSubstitution {
  sub_food_id: string;
  uses_count: number;
  name: string;
  category: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  source: string;
}

/** Retorna os substitutos mais usados pelo nutri logado para um alimento principal. */
export function useLearnedSubstitutions(mainFoodId: string | null | undefined) {
  return useQuery({
    queryKey: ['learned-subs', mainFoodId],
    queryFn: async (): Promise<LearnedSubstitution[]> => {
      if (!mainFoodId) return [];
      const { data: rows, error } = await (supabase as any)
        .from('plan_substitution_history')
        .select('sub_food_id, uses_count')
        .eq('main_food_id', mainFoodId)
        .order('uses_count', { ascending: false })
        .order('last_used_at', { ascending: false })
        .limit(6);
      if (error || !rows?.length) return [];
      const ids = rows.map((r: any) => r.sub_food_id);
      const { data: foods } = await (supabase as any)
        .from('food_items').select('*').in('id', ids);
      const byId = new Map<string, any>((foods || []).map((f: any) => [f.id, f]));
      return rows
        .map((r: any) => {
          const f = byId.get(r.sub_food_id);
          if (!f) return null;
          return { ...f, sub_food_id: r.sub_food_id, uses_count: r.uses_count } as LearnedSubstitution;
        })
        .filter(Boolean) as LearnedSubstitution[];
    },
    enabled: !!mainFoodId,
    staleTime: 60_000,
  });
}

/** Registra em batch todos os pares (principal → substituto) presentes em um
 *  AST enriquecido. Usa upsert por (nutricionist_id, main, sub) incrementando
 *  uses_count. Silencioso: qualquer erro é ignorado. */
export function useRecordSubstitutions() {
  return useCallback(async (asts: PlanAst[]) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;
      // Agrega pares por (main, sub) no batch atual — evita múltiplos upserts.
      const pairs = new Map<string, { main: string; sub: string; count: number }>();
      for (const ast of asts) {
        for (const meal of ast.meals) {
          for (const g of meal.groups) {
            const main = g.tokens[0];
            if (!main?.foodItemId) continue;
            for (let i = 1; i < g.tokens.length; i++) {
              const sub = g.tokens[i];
              if (!sub?.foodItemId || sub.foodItemId === main.foodItemId) continue;
              const key = `${main.foodItemId}::${sub.foodItemId}`;
              const cur = pairs.get(key);
              if (cur) cur.count += 1;
              else pairs.set(key, { main: main.foodItemId, sub: sub.foodItemId, count: 1 });
            }
          }
        }
      }
      if (pairs.size === 0) return;
      // Lê contagem atual e atualiza somando — Postgres upsert simples.
      for (const { main, sub, count } of pairs.values()) {
        const { data: existing } = await (supabase as any)
          .from('plan_substitution_history')
          .select('id, uses_count')
          .eq('nutritionist_id', uid)
          .eq('main_food_id', main)
          .eq('sub_food_id', sub)
          .maybeSingle();
        if (existing?.id) {
          await (supabase as any)
            .from('plan_substitution_history')
            .update({ uses_count: (existing.uses_count || 0) + count, last_used_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await (supabase as any)
            .from('plan_substitution_history')
            .insert({ nutritionist_id: uid, main_food_id: main, sub_food_id: sub, uses_count: count });
        }
      }
    } catch { /* silencioso — aprender não pode quebrar salvar */ }
  }, []);
}
