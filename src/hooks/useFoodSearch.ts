import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  source: string;
}

export interface FoodMeasure {
  id: string;
  food_item_id: string;
  measure_name: string;
  measure_weight_g: number;
}

export interface SelectedFood {
  temp_id: string;
  food_item_id: string;
  name: string;
  group: string;
  measure_id: string;
  measure_name: string;
  measure_weight_g: number;
  quantity: number;
  weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export function calcNutrients(food: FoodItem, weightG: number) {
  const factor = weightG / 100;
  return {
    calories: Math.round(food.calories_per_100g * factor * 10) / 10,
    protein_g: Math.round(food.protein_per_100g * factor * 10) / 10,
    carbs_g: Math.round(food.carbs_per_100g * factor * 10) / 10,
    fat_g: Math.round(food.fat_per_100g * factor * 10) / 10,
    fiber_g: Math.round(food.fiber_per_100g * factor * 10) / 10,
  };
}

export function useFoodSearch(query: string) {
  return useQuery({
    queryKey: ['food-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const { data, error } = await (supabase as any)
        .from('food_items')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(15);
      if (error) throw error;
      return (data ?? []) as FoodItem[];
    },
    enabled: query.length >= 2,
    staleTime: 60_000,
  });
}

export function useFoodMeasures(foodItemId: string | null) {
  return useQuery({
    queryKey: ['food-measures', foodItemId],
    queryFn: async () => {
      if (!foodItemId) return [];
      const { data, error } = await (supabase as any)
        .from('food_measures')
        .select('*')
        .eq('food_item_id', foodItemId)
        .order('measure_weight_g', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FoodMeasure[];
    },
    enabled: !!foodItemId,
    staleTime: 300_000,
  });
}

export function useLookupCustomFood() {
  const [isLooking, setIsLooking] = useState(false);

  const lookupFood = useCallback(async (foodName: string): Promise<FoodItem | null> => {
    setIsLooking(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-custom-food', {
        body: { foodName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.food) return null;
      return {
        id: data.food.id,
        name: data.food.name,
        category: data.food.category,
        calories_per_100g: data.food.calories_per_100g,
        protein_per_100g: data.food.protein_per_100g,
        carbs_per_100g: data.food.carbs_per_100g,
        fat_per_100g: data.food.fat_per_100g,
        fiber_per_100g: data.food.fiber_per_100g,
        source: 'custom',
      };
    } finally {
      setIsLooking(false);
    }
  }, []);

  return { lookupFood, isLooking };
}
