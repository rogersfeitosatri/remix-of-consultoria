import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Pencil,
  Save,
  Brain,
  Plus,
  Minus,
  Trash2,
  X,
  UtensilsCrossed,
  TrendingUp,
  Utensils,
  Loader2,
  ChevronUp,
  ChevronDown,
  Copy,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import FoodSearchAutocomplete, { GROUP_TO_CATEGORIES } from './FoodSearchAutocomplete';
import { type SelectedFood, useFoodMeasures } from '@/hooks/useFoodSearch';

interface MealScheduleData {
  cafe_da_manha?: { horario?: string } | null;
  lanche_manha?: { horario?: string } | null;
  lanche_manha_enabled?: boolean;
  almoco?: { horario?: string } | null;
  lanche_tarde?: { horario?: string } | null;
  lanche_tarde_enabled?: boolean;
  jantar?: { horario?: string } | null;
  ceia?: { horario?: string } | null;
  ceia_enabled?: boolean;
}

interface EditableMealPlanProps {
  analysis: any;
  clientId: string;
  athleteWeightKg?: number | null;
  mealSchedule?: MealScheduleData;
  onUpdated: () => void;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function sumFoods(foods: SelectedFood[]) {
  return foods.reduce(
    (acc, f) => ({
      calories: Math.round((acc.calories + f.calories) * 10) / 10,
      protein_g: Math.round((acc.protein_g + f.protein_g) * 10) / 10,
      carbs_g: Math.round((acc.carbs_g + f.carbs_g) * 10) / 10,
      fat_g: Math.round((acc.fat_g + f.fat_g) * 10) / 10,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}


// Extrai kcal + macros de uma string de meal_macros gerada pela IA,
// no formato "~367 kcal | ~42g CHO | ~27.6g PTN | ~9g LIP" (aceita variações).
// Usado para somar refeições legadas (texto) no total diário até que sejam convertidas.
function parseMealMacrosString(s: string | undefined | null): { calories: number; carbs_g: number; protein_g: number; fat_g: number } | null {
  if (!s) return null;
  const kcal = s.match(/(\d+(?:[.,]\d+)?)\s*kcal/i);
  const cho = s.match(/(\d+(?:[.,]\d+)?)\s*g?\s*CHO/i);
  const ptn = s.match(/(\d+(?:[.,]\d+)?)\s*g?\s*(?:PTN|PROT)/i);
  const lip = s.match(/(\d+(?:[.,]\d+)?)\s*g?\s*(?:LIP|GORD|FAT)/i);
  if (!kcal && !cho && !ptn && !lip) return null;
  const n = (m: RegExpMatchArray | null) => (m ? parseFloat(m[1].replace(',', '.')) : 0);
  return { calories: n(kcal), carbs_g: n(cho), protein_g: n(ptn), fat_g: n(lip) };
}

function extractMealTimes(schedule?: MealScheduleData): string[] {
  if (!schedule) return [];
  const times: string[] = [];
  const entries: [string, any, boolean][] = [
    ['Cafe da manha', schedule.cafe_da_manha, true],
    ['Lanche da manha', schedule.lanche_manha, schedule.lanche_manha_enabled !== false],
    ['Almoco', schedule.almoco, true],
    ['Lanche da tarde', schedule.lanche_tarde, schedule.lanche_tarde_enabled !== false],
    ['Jantar', schedule.jantar, true],
    ['Ceia', schedule.ceia, schedule.ceia_enabled !== false],
  ];
  for (const [label, meal, enabled] of entries) {
    if (!enabled || !meal) continue;
    const h = (meal as any)?.horario;
    if (h) times.push(`${h} - ${label}`);
    else times.push(label);
  }
  return times;
}

function parseTimeFromMealName(name: string): string {
  const match = name.match(/^(\d{1,2}[:\.]?\d{0,2})\s*[-–]?\s*/);
  return match ? match[1].replace('.', ':') : '';
}

function cleanFoodName(name: string): string {
  let n = name.trim();
  n = n.replace(/^(?:fatias?\s+de|pedaços?\s+de|colheres?\s+(?:de\s+(?:sopa|cha|sobremesa)\s+(?:de\s+)?)?|xicaras?\s+de|porco?e?s?\s+de|files?\s+de|copos?\s+de|potes?\s+de|unidades?\s+de)\s*/i, '');
  n = n.replace(/\s+(?:m[eé]dia|grande|pequena|m[eé]dio|pequeno|inteiro|inteira|cozida|cozido|grelhada|grelhado|light|zero\s*lactose)$/i, '');
  n = n.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return n;
}

function extractFoodInfo(text: string): { searchTerm: string; weightG: number; qty: number } {
  text = text.trim();
  if (!text) return { searchTerm: '', weightG: 0, qty: 1 };
  // "50g de queijo minas light" or "150 g macarrão"
  let m = text.match(/^(\d+(?:[.,]\d+)?)\s*g\s+(?:de\s+)?(.+)/i);
  if (m) {
    return { searchTerm: cleanFoodName(m[2]), weightG: parseFloat(m[1].replace(',', '.')), qty: 1 };
  }
  // "1 fatias de pão francês (100g)" or "1 banana média (100g)"
  m = text.match(/^(\d+(?:[.,]\d+)?)\s+(.+?)(?:\s*\((\d+(?:[.,]\d+)?)\s*g?\s*\))?$/i);
  if (m) {
    const wg = m[3] ? parseFloat(m[3].replace(',', '.')) : 0;
    return { searchTerm: cleanFoodName(m[2]), weightG: wg, qty: parseFloat(m[1].replace(',', '.')) };
  }
  // Fallback: use whole text as name, extract any embedded (Ng)
  const wgMatch = text.match(/\((\d+(?:[.,]\d+)?)\s*g\)/i);
  return {
    searchTerm: cleanFoodName(text),
    weightG: wgMatch ? parseFloat(wgMatch[1].replace(',', '.')) : 0,
    qty: 1,
  };
}

async function searchFoodInDb(searchTerm: string): Promise<any | null> {
  if (!searchTerm) return null;
  // Try full term first, then progressively shorter (drop trailing words)
  const words = searchTerm.split(/\s+/).filter(Boolean);
  for (let end = words.length; end >= 1; end--) {
    const term = words.slice(0, end).join(' ');
    const { data } = await (supabase as any)
      .from('food_items')
      .select('*')
      .ilike('name', `%${term}%`)
      .limit(5);
    if (data?.length) {
      return data.sort((a: any, b: any) => a.name.length - b.name.length)[0];
    }
  }
  return null;
}

async function lookupCustomFoodFallback(searchTerm: string): Promise<any | null> {
  if (!searchTerm) return null;
  try {
    const { data, error } = await supabase.functions.invoke('lookup-custom-food', {
      body: { foodName: searchTerm },
    });
    if (error || !data?.food) return null;
    return data.food;
  } catch {
    return null;
  }
}


function mapLegacyGroup(group: string): string {
  const n = group.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('carboidrato') || n.includes('cereal')) return 'Carboidratos';
  if (n.includes('proteina')) return 'Proteinas';
  if (n.includes('gordura') || n.includes('lipid')) return 'Gorduras';
  if (n.includes('fruta')) return 'Frutas';
  if (n.includes('vegetal') || n.includes('legume') || n.includes('verdura') || n.includes('salada')) return 'Vegetais';
  return 'Outros';
}

let _convId = 0;
function nextConvId() { return `conv_${Date.now()}_${++_convId}`; }

async function lookupAndBuildFood(
  text: string,
  group: string,
): Promise<SelectedFood | null> {
  const parsed = extractFoodInfo(text);
  if (!parsed.searchTerm) return null;

  let food = await searchFoodInDb(parsed.searchTerm);
  if (!food) {
    // Fallback: ask AI to look up nutritional data and register the food
    food = await lookupCustomFoodFallback(parsed.searchTerm);
    if (!food) return null;
  }

  const { data: measures } = await (supabase as any)
    .from('food_measures')
    .select('*')
    .eq('food_item_id', food.id)
    .order('measure_weight_g', { ascending: false });
  const measureList = (measures || []) as any[];
  if (measureList.length === 0) return null;


  let bestMeasure = measureList[0];
  if (parsed.weightG > 0) {
    bestMeasure = measureList.reduce((best: any, m: any) =>
      Math.abs(m.measure_weight_g - parsed.weightG) < Math.abs(best.measure_weight_g - parsed.weightG) ? m : best,
      measureList[0],
    );
  }

  const qty = parsed.weightG > 0
    ? Math.round((parsed.weightG / bestMeasure.measure_weight_g) * 10) / 10
    : parsed.qty;
  const weightG = bestMeasure.measure_weight_g * qty;
  const factor = weightG / 100;

  return {
    temp_id: nextConvId(),
    food_item_id: food.id,
    name: food.name,
    group,
    measure_id: bestMeasure.id,
    measure_name: bestMeasure.measure_name,
    measure_weight_g: bestMeasure.measure_weight_g,
    quantity: Math.max(0.1, qty),
    weight_g: Math.round(weightG * 10) / 10,
    calories: Math.round(food.calories_per_100g * factor * 10) / 10,
    protein_g: Math.round(food.protein_per_100g * factor * 10) / 10,
    carbs_g: Math.round(food.carbs_per_100g * factor * 10) / 10,
    fat_g: Math.round(food.fat_per_100g * factor * 10) / 10,
    fiber_g: Math.round((food.fiber_per_100g || 0) * factor * 10) / 10,
    calories_per_100g: food.calories_per_100g,
  };
}

// Recompute a food's calories/macros from its (already updated) weight_g, deriving
// per-100g macro values from the previous state. Used by quantity and measure edits.
function recalcFoodFromWeight(food: any, oldCalories: number) {
  if (!(food.calories_per_100g > 0)) return;
  const factor = food.weight_g / 100;
  const ptnPer100 = oldCalories > 0 ? (food.protein_g / oldCalories) * food.calories_per_100g : 0;
  const choPer100 = oldCalories > 0 ? (food.carbs_g / oldCalories) * food.calories_per_100g : 0;
  const fatPer100 = oldCalories > 0 ? (food.fat_g / oldCalories) * food.calories_per_100g : 0;
  food.calories = Math.round(food.calories_per_100g * factor * 10) / 10;
  food.protein_g = Math.round(ptnPer100 * factor * 10) / 10;
  food.carbs_g = Math.round(choPer100 * factor * 10) / 10;
  food.fat_g = Math.round(fatPer100 * factor * 10) / 10;
}

// Inline measure picker — tap the measure to switch it (colher, xícara, gramas…).
// Loads measures lazily on first open; falls back to plain text if food has no id.
function InlineMeasurePicker({ food, onSelect }: { food: any; onSelect: (m: any) => void }) {
  const [touched, setTouched] = useState(false);
  const { data: measures = [] } = useFoodMeasures(touched && food.food_item_id ? food.food_item_id : null);

  if (!food.food_item_id) {
    return <span className="text-sm text-foreground">{food.measure_name}</span>;
  }

  return (
    <Select
      value={food.measure_id}
      onValueChange={(id) => {
        const m = measures.find((x: any) => x.id === id);
        if (m) onSelect(m);
      }}
      onOpenChange={(o) => { if (o) setTouched(true); }}
    >
      <SelectTrigger className="h-9 w-auto min-w-0 max-w-[160px] gap-1 text-sm">
        <span className="truncate">{food.measure_name}</span>
      </SelectTrigger>
      <SelectContent>
        {measures.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Carregando…</div>
        ) : (
          measures.map((m: any) => (
            <SelectItem key={m.id} value={m.id} className="text-sm">
              {m.measure_name} · {m.measure_weight_g}g
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

// Re-scale a food's substitutions so each stays caloric-equivalent to the primary food
// after the primary's calories changed from `oldCalories` to `food.calories`.
function adjustSubstitutions(food: any, oldCalories: number) {
  if (!(food.substitutions?.length > 0) || oldCalories <= 0 || food.calories <= 0) return;
  const ratio = food.calories / oldCalories;
  for (const sub of food.substitutions) {
    if (!(sub.calories_per_100g > 0)) continue;
    const targetCal = sub.calories * ratio;
    const targetWeight = (targetCal / sub.calories_per_100g) * 100;
    const newSubQty = Math.round((targetWeight / sub.measure_weight_g) * 10) / 10;
    const subPtnPer100 = sub.calories > 0 ? (sub.protein_g / sub.calories) * sub.calories_per_100g : 0;
    const subChoPer100 = sub.calories > 0 ? (sub.carbs_g / sub.calories) * sub.calories_per_100g : 0;
    const subFatPer100 = sub.calories > 0 ? (sub.fat_g / sub.calories) * sub.calories_per_100g : 0;
    sub.quantity = Math.max(0.1, newSubQty);
    sub.weight_g = Math.round(sub.measure_weight_g * sub.quantity * 10) / 10;
    const subFactor = sub.weight_g / 100;
    sub.calories = Math.round(sub.calories_per_100g * subFactor * 10) / 10;
    sub.protein_g = Math.round(subPtnPer100 * subFactor * 10) / 10;
    sub.carbs_g = Math.round(subChoPer100 * subFactor * 10) / 10;
    sub.fat_g = Math.round(subFatPer100 * subFactor * 10) / 10;
  }
}

// Convert a single meal/option's legacy food_groups into structured foods, in place.
// Returns counts so callers can report results.
async function convertTargetInPlace(target: any): Promise<{ converted: number; unconverted: number }> {
  const foodGroups = target?.food_groups || [];
  if (foodGroups.length === 0) return { converted: 0, unconverted: 0 };

  const newFoods: SelectedFood[] = [...(target.foods || [])];
  const unconvertedGroups: any[] = [];
  let converted = 0;

  for (const fg of foodGroups) {
    const groupName = mapLegacyGroup(fg.group || 'Outros');
    const text = (fg.options || '') as string;
    const items = text.split(/\s*\|\s*/);
    let groupHadFailure = false;

    for (const itemText of items) {
      if (!itemText.trim()) continue;
      const alternatives = itemText.split(/\s+ou\s+/i);
      let primaryFood: SelectedFood | null = null;
      const subs: SelectedFood[] = [];
      let failed = false;

      for (let ai = 0; ai < alternatives.length; ai++) {
        const alt = alternatives[ai].trim().replace(/\s*\(ex:.*\)/i, '');
        if (!alt) continue;
        const built = await lookupAndBuildFood(alt, groupName);
        if (!built) { if (ai === 0) { failed = true; break; } continue; }
        if (ai === 0) primaryFood = built; else subs.push(built);
      }

      if (failed) { groupHadFailure = true; break; }
      if (primaryFood) {
        if (subs.length > 0) primaryFood.substitutions = subs;
        newFoods.push(primaryFood);
        converted++;
      }
    }

    if (groupHadFailure) unconvertedGroups.push(fg);
  }

  target.foods = newFoods;
  target.food_groups = unconvertedGroups;
  return { converted, unconverted: unconvertedGroups.length };
}

// Whether a meal/option still holds unconverted legacy text (and no structured foods yet).
function targetIsPureLegacy(target: any): boolean {
  return (!target?.foods || target.foods.length === 0) && (target?.food_groups?.length > 0);
}

export function EditableMealPlan({ analysis, clientId, athleteWeightKg, mealSchedule, onUpdated }: EditableMealPlanProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState(() => deepClone(analysis));

  const meals = isEditing ? editedAnalysis.meal_plan?.meals ?? [] : analysis.meal_plan?.meals ?? [];
  const dailyTotals = isEditing
    ? editedAnalysis.meal_plan?.daily_totals
    : analysis.meal_plan?.daily_totals;

  const mealTimes = useMemo(() => extractMealTimes(mealSchedule), [mealSchedule]);

  // Totais por refeição (Opção 1 se houver opções); soma alimentos estruturados
  // OU, se ainda não convertida, extrai do meal_macros da IA.
  const computedMealTotals = useCallback((meal: any) => {
    const opt1 = meal.options?.[0];
    const foods: SelectedFood[] = opt1?.foods ?? meal.foods ?? [];
    if (foods.length > 0) return sumFoods(foods);
    const macrosStr = opt1?.meal_macros || meal.meal_macros;
    return parseMealMacrosString(macrosStr);
  }, []);

  // Total diário em tempo real, somando por refeição (funciona misto estruturado+legado).
  const computedTotals = useMemo(() => {
    let any = false;
    const acc = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    for (const meal of meals) {
      const t = computedMealTotals(meal);
      if (!t) continue;
      any = true;
      acc.calories += t.calories;
      acc.protein_g += t.protein_g;
      acc.carbs_g += t.carbs_g;
      acc.fat_g += t.fat_g;
    }
    if (!any) return null;
    return {
      calories: Math.round(acc.calories * 10) / 10,
      protein_g: Math.round(acc.protein_g * 10) / 10,
      carbs_g: Math.round(acc.carbs_g * 10) / 10,
      fat_g: Math.round(acc.fat_g * 10) / 10,
    };
  }, [meals, computedMealTotals]);

  const computedMealOptionTotals = useCallback((foods: SelectedFood[]) => {
    if (foods.length === 0) return null;
    return sumFoods(foods);
  }, []);

  // Chip com g e g/kg para a barra sticky de totais diários.
  const MacroChip = ({ color, label, g, gkg }: { color: 'blue' | 'purple' | 'orange'; label: string; g: number; gkg: number | null }) => {
    const dot = color === 'blue' ? 'bg-blue-500' : color === 'purple' ? 'bg-purple-500' : 'bg-orange-500';
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-white/70 dark:bg-black/30 px-1.5 py-0.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-foreground">{Math.round(g)}g</span>
        {gkg != null && <span className="text-muted-foreground">({gkg.toFixed(1)} g/kg)</span>}
      </span>
    );
  };

  // Compact, wrap-friendly totals row for a meal/option
  const mealTotalChips = (t: { calories: number; carbs_g: number; protein_g: number; fat_g: number }) => (
    <div className="flex items-center gap-1.5 text-[11px] flex-wrap justify-end">
      <span className="font-bold text-foreground">{Math.round(t.calories)} kcal</span>
      <span className="text-muted-foreground">C {Math.round(t.carbs_g)}g</span>
      <span className="text-muted-foreground">P {Math.round(t.protein_g)}g</span>
      <span className="text-muted-foreground">G {Math.round(t.fat_g)}g</span>
    </div>
  );

  // -- Meal-level operations --

  const updateMealField = (mealIdx: number, field: string, value: string) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals[mealIdx][field] = value;
      return next;
    });
  };

  const addMeal = (prefillName?: string) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      const mealName = prefillName || '';
      const time = parseTimeFromMealName(mealName);

      // Check if a meal with same time already exists → add as option
      if (time) {
        const existingIdx = next.meal_plan.meals.findIndex((m: any) => {
          const existingTime = parseTimeFromMealName(m.meal_name || '');
          return existingTime && existingTime === time;
        });
        if (existingIdx >= 0) {
          const existing = next.meal_plan.meals[existingIdx];
          // Convert to options format if not already
          if (!existing.options) {
            existing.options = [{
              label: 'Opcao 1',
              foods: existing.foods || [],
              food_groups: existing.food_groups || [],
            }];
            delete existing.foods;
            delete existing.food_groups;
          }
          existing.options.push({
            label: `Opcao ${existing.options.length + 1}`,
            foods: [],
            food_groups: [],
          });
          return next;
        }
      }

      next.meal_plan.meals.push({
        meal_name: mealName,
        foods: [],
        food_groups: [],
        meal_macros: '',
        timing_note: '',
      });
      return next;
    });
  };

  const addOptionToMeal = (mealIdx: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      const meal = next.meal_plan.meals[mealIdx];
      if (!meal.options) {
        meal.options = [{
          label: 'Opcao 1',
          foods: meal.foods || [],
          food_groups: meal.food_groups || [],
        }];
        delete meal.foods;
        delete meal.food_groups;
      }
      meal.options.push({
        label: `Opcao ${meal.options.length + 1}`,
        foods: [],
        food_groups: [],
      });
      return next;
    });
  };

  const removeOption = (mealIdx: number, optIdx: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      const meal = next.meal_plan.meals[mealIdx];
      if (!meal.options) return next;
      meal.options.splice(optIdx, 1);
      // If only one option left, flatten back
      if (meal.options.length === 1) {
        meal.foods = meal.options[0].foods;
        meal.food_groups = meal.options[0].food_groups;
        delete meal.options;
      } else {
        // Relabel
        meal.options.forEach((o: any, i: number) => { o.label = `Opcao ${i + 1}`; });
      }
      return next;
    });
  };

  const removeMeal = (mealIdx: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals.splice(mealIdx, 1);
      return next;
    });
  };

  const moveMeal = (mealIdx: number, direction: -1 | 1) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      const arr = next.meal_plan.meals;
      const newIdx = mealIdx + direction;
      if (newIdx < 0 || newIdx >= arr.length) return next;
      [arr[mealIdx], arr[newIdx]] = [arr[newIdx], arr[mealIdx]];
      return next;
    });
  };

  // -- Structured food operations --

  const getFoodsArray = (meal: any, optIdx?: number) => {
    if (optIdx !== undefined && meal.options) return meal.options[optIdx]?.foods ?? [];
    return meal.foods ?? [];
  };

  const addFoodToMeal = (mealIdx: number, food: SelectedFood, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        const opt = next.meal_plan.meals[mealIdx].options[optIdx];
        if (!opt.foods) opt.foods = [];
        opt.foods.push(food);
      } else {
        if (!next.meal_plan.meals[mealIdx].foods) {
          next.meal_plan.meals[mealIdx].foods = [];
        }
        next.meal_plan.meals[mealIdx].foods.push(food);
      }
      return next;
    });
  };

  const removeFoodFromMeal = (mealIdx: number, foodTempId: string, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        const opt = next.meal_plan.meals[mealIdx].options[optIdx];
        opt.foods = (opt.foods || []).filter((f: SelectedFood) => f.temp_id !== foodTempId);
      } else {
        next.meal_plan.meals[mealIdx].foods = (next.meal_plan.meals[mealIdx].foods || [])
          .filter((f: SelectedFood) => f.temp_id !== foodTempId);
      }
      return next;
    });
  };

  // Add substitution to a food
  const addSubstitution = (mealIdx: number, foodTempId: string, sub: SelectedFood, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      let foods: any[];
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        foods = next.meal_plan.meals[mealIdx].options[optIdx].foods || [];
      } else {
        foods = next.meal_plan.meals[mealIdx].foods || [];
      }
      const food = foods.find((f: any) => f.temp_id === foodTempId);
      if (food) {
        if (!food.substitutions) food.substitutions = [];
        food.substitutions.push(sub);
      }
      return next;
    });
  };

  const removeSubstitution = (mealIdx: number, foodTempId: string, subTempId: string, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      let foods: any[];
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        foods = next.meal_plan.meals[mealIdx].options[optIdx].foods || [];
      } else {
        foods = next.meal_plan.meals[mealIdx].foods || [];
      }
      const food = foods.find((f: any) => f.temp_id === foodTempId);
      if (food?.substitutions) {
        food.substitutions = food.substitutions.filter((s: any) => s.temp_id !== subTempId);
      }
      return next;
    });
  };

  const updateFoodQuantity = (mealIdx: number, foodTempId: string, newQty: number, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      let foods: any[];
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        foods = next.meal_plan.meals[mealIdx].options[optIdx].foods || [];
      } else {
        foods = next.meal_plan.meals[mealIdx].foods || [];
      }
      const food = foods.find((f: any) => f.temp_id === foodTempId);
      if (!food) return next;

      const oldCalories = food.calories;
      food.quantity = newQty;
      food.weight_g = Math.round(food.measure_weight_g * newQty * 10) / 10;
      recalcFoodFromWeight(food, oldCalories);
      adjustSubstitutions(food, oldCalories);
      return next;
    });
  };

  // Change a food's household measure (colher, xícara, gramas…), keeping the quantity
  const updateFoodMeasure = (mealIdx: number, foodTempId: string, measure: any, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      let foods: any[];
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        foods = next.meal_plan.meals[mealIdx].options[optIdx].foods || [];
      } else {
        foods = next.meal_plan.meals[mealIdx].foods || [];
      }
      const food = foods.find((f: any) => f.temp_id === foodTempId);
      if (!food) return next;

      const oldCalories = food.calories;
      food.measure_id = measure.id;
      food.measure_name = measure.measure_name;
      food.measure_weight_g = measure.measure_weight_g;
      food.weight_g = Math.round(measure.measure_weight_g * food.quantity * 10) / 10;
      recalcFoodFromWeight(food, oldCalories);
      adjustSubstitutions(food, oldCalories);
      return next;
    });
  };

  // Replace a food's identity (keep its group + substitutions, re-scale substitutions)
  const replaceFood = (mealIdx: number, foodTempId: string, newFood: SelectedFood, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      let foods: any[];
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        foods = next.meal_plan.meals[mealIdx].options[optIdx].foods || [];
      } else {
        foods = next.meal_plan.meals[mealIdx].foods || [];
      }
      const idx = foods.findIndex((f: any) => f.temp_id === foodTempId);
      if (idx < 0) return next;
      const old = foods[idx];
      const oldCalories = old.calories;
      const replaced: any = {
        ...newFood,
        temp_id: old.temp_id,
        group: old.group,
        substitutions: old.substitutions || [],
        _showReplace: false,
      };
      adjustSubstitutions(replaced, oldCalories);
      foods[idx] = replaced;
      return next;
    });
  };

  const toggleReplace = (mealIdx: number, foodTempId: string, show: boolean, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      const foods = optIdx !== undefined
        ? next.meal_plan.meals[mealIdx].options[optIdx].foods
        : next.meal_plan.meals[mealIdx].foods;
      const f = foods?.find((x: any) => x.temp_id === foodTempId);
      if (f) f._showReplace = show;
      return next;
    });
  };

  // -- Legacy food_groups operations --

  const removeLegacyFoodGroup = (mealIdx: number, fgIdx: number, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        next.meal_plan.meals[mealIdx].options[optIdx].food_groups.splice(fgIdx, 1);
      } else {
        next.meal_plan.meals[mealIdx].food_groups.splice(fgIdx, 1);
      }
      return next;
    });
  };

  const updateLegacyFoodGroup = (mealIdx: number, fgIdx: number, field: string, value: string, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        next.meal_plan.meals[mealIdx].options[optIdx].food_groups[fgIdx][field] = value;
      } else {
        next.meal_plan.meals[mealIdx].food_groups[fgIdx][field] = value;
      }
      return next;
    });
  };

  // -- Daily totals --

  const updateDailyTotal = (field: string, value: string) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      if (!next.meal_plan.daily_totals) {
        next.meal_plan.daily_totals = {};
      }
      next.meal_plan.daily_totals[field] = value;
      return next;
    });
  };

  // -- Save logic --

  const buildSaveData = (source?: any) => {
    const data = deepClone(source ?? editedAnalysis);
    for (const meal of data.meal_plan?.meals ?? []) {
      const processOption = (opt: any) => {
        // Strip transient UI state from foods
        for (const f of (opt.foods || [])) {
          delete f._showSubSearch;
          delete f._showReplace;
          for (const s of (f.substitutions || [])) {
            delete s._showSubSearch;
            delete s._showReplace;
          }
        }
        if (opt.foods?.length > 0) {
          const totals = sumFoods(opt.foods);
          opt.meal_macros = `~${Math.round(totals.calories)} kcal | ${Math.round(totals.carbs_g)}g CHO | ${Math.round(totals.protein_g)}g PTN | ${Math.round(totals.fat_g)}g LIP`;
          const groups: Record<string, string[]> = {};
          for (const f of opt.foods) {
            const g = f.group || 'Alimento';
            if (!groups[g]) groups[g] = [];
            let desc = `${f.name} - ${f.quantity} ${f.measure_name} (${Math.round(f.weight_g)}g)`;
            if (f.substitutions?.length > 0) {
              const subs = f.substitutions.map((s: any) =>
                `${s.name} - ${s.quantity} ${s.measure_name} (${Math.round(s.weight_g)}g)`
              ).join(' ou ');
              desc += ` ou ${subs}`;
            }
            groups[g].push(desc);
          }
          opt.food_groups = Object.entries(groups).map(([group, items]) => ({
            group,
            options: items.join(' | '),
          }));
        }
      };

      if (meal.options?.length > 0) {
        meal.options.forEach(processOption);
        meal.meal_macros = meal.options[0]?.meal_macros || '';
        // Keep per-option food_groups; also set top-level for backward compat
        meal.food_groups = meal.options[0]?.food_groups || [];
      } else {
        processOption(meal);
      }
    }
    // Only recompute daily totals from the live edit buffer, not from an
    // arbitrary source (silent-save on open must preserve existing totals).
    if (!source && computedTotals) {
      if (!data.meal_plan.daily_totals) data.meal_plan.daily_totals = {};
      data.meal_plan.daily_totals.kcal = Math.round(computedTotals.calories);
      data.meal_plan.daily_totals.cho_g = Math.round(computedTotals.carbs_g);
      data.meal_plan.daily_totals.protein_g = Math.round(computedTotals.protein_g);
      data.meal_plan.daily_totals.fat_g = Math.round(computedTotals.fat_g);
    }
    return data;
  };

  const saveDirectly = async (source?: any) => {
    const data = buildSaveData(source);
    const updatedRaw = JSON.stringify({ ...data, _isNewFormat: true });
    const { error } = await supabase
      .from('ai_analyses')
      .update({
        raw_response: updatedRaw,
        caloric_deficit: { meal_plan: data.meal_plan } as any,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', clientId);
    if (error) throw error;
  };

  const auditWithAI = async () => {
    const data = buildSaveData();
    const { data: result, error } = await supabase.functions.invoke('audit-meal-plan', {
      body: { clientId, editedAnalysis: data },
    });
    if (error) throw error;
    if (result?.error) throw new Error(result.error);
    return result;
  };

  const handleSaveDirectly = async () => {
    setIsSaving(true);
    try {
      await saveDirectly();
      toast.success('Plano alimentar salvo com sucesso.');
      setIsEditing(false);
      onUpdated();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuditAndSave = async () => {
    setIsAuditing(true);
    try {
      await auditWithAI();
      toast.success('Plano auditado e salvo com sucesso.');
      setIsEditing(false);
      onUpdated();
    } catch (err: any) {
      toast.error(`Erro na auditoria: ${err.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleCancel = () => {
    setEditedAnalysis(deepClone(analysis));
    setIsEditing(false);
  };

  const handleStartEditing = async () => {
    const base = deepClone(analysis);
    setEditedAnalysis(base);
    setIsEditing(true);

    // Auto-convert pure-legacy meals (AI-generated text) into structured foods so
    // inline editing, substitution auto-adjust and real-time totals work immediately.
    const mealsArr = base.meal_plan?.meals ?? [];
    const legacyTargets: any[] = [];
    for (const meal of mealsArr) {
      const targets = meal.options?.length > 0 ? meal.options : [meal];
      for (const t of targets) if (targetIsPureLegacy(t)) legacyTargets.push(t);
    }
    if (legacyTargets.length === 0) return;

    setIsConverting(true);
    try {
      const results = await Promise.all(legacyTargets.map(convertTargetInPlace));
      const totalConverted = results.reduce((a, r) => a + r.converted, 0);
      const totalUnconverted = results.reduce((a, r) => a + r.unconverted, 0);
      setEditedAnalysis(deepClone(base));

      // Persist the conversion silently so it's not re-done every time the
      // plan is reopened. Only saves if the DB round-trip succeeds; errors
      // are swallowed to keep the edit UX unchanged.
      if (totalConverted > 0) {
        try {
          await saveDirectly(base);
          onUpdated();
        } catch { /* silent */ }
      }

      if (totalConverted === 0) {
        toast.warning('Banco de alimentos indisponivel. Editando em modo texto.');
      } else if (totalUnconverted > 0) {
        toast.info(`${totalConverted} alimento(s) prontos para edicao inteligente. ${totalUnconverted} em modo texto.`);
      } else {
        toast.success('Plano pronto para edicao inteligente!');
      }
    } catch {
      // Fall back to text editing silently
    } finally {
      setIsConverting(false);
    }
  };

  const busy = isAuditing || isSaving || isConverting;

  // Toggle substitution search for a food
  const toggleSubSearch = (mealIdx: number, foodTempId: string, show: boolean, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      const foods = optIdx !== undefined
        ? next.meal_plan.meals[mealIdx].options[optIdx].foods
        : next.meal_plan.meals[mealIdx].foods;
      const f = foods?.find((x: any) => x.temp_id === foodTempId);
      if (f) f._showSubSearch = show;
      return next;
    });
  };

  // -- Convert legacy food_groups to structured foods --

  const convertMealToStructured = async (mealIdx: number, optIdx?: number) => {
    setIsConverting(true);
    try {
      const next = deepClone(editedAnalysis);
      const target = optIdx !== undefined
        ? next.meal_plan.meals[mealIdx].options?.[optIdx]
        : next.meal_plan.meals[mealIdx];
      if (!target) return;

      const { converted, unconverted } = await convertTargetInPlace(target);
      setEditedAnalysis(next);

      if (converted === 0) {
        toast.warning('Nenhum alimento encontrado no banco. Verifique se o banco de alimentos foi carregado.');
      } else if (unconverted > 0) {
        toast.info(`Convertido! ${unconverted} grupo(s) nao encontrado(s) no banco.`);
      } else {
        toast.success('Alimentos convertidos para formato estruturado!');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  const convertAllMeals = async () => {
    setIsConverting(true);
    try {
      const next = deepClone(editedAnalysis);
      const mealsArr = next.meal_plan?.meals ?? [];
      let totalConverted = 0;
      let totalUnconverted = 0;

      for (const meal of mealsArr) {
        const targets = meal.options?.length > 0 ? meal.options : [meal];
        for (const t of targets) {
          const res = await convertTargetInPlace(t);
          totalConverted += res.converted;
          totalUnconverted += res.unconverted;
        }
      }

      setEditedAnalysis(next);
      if (totalConverted === 0) {
        toast.warning('Nenhum alimento encontrado no banco. Verifique se o banco de alimentos foi carregado.');
      } else if (totalUnconverted > 0) {
        toast.info(`${totalConverted} alimento(s) convertido(s). ${totalUnconverted} grupo(s) nao encontrado(s) no banco.`);
      } else {
        toast.success('Alimentos convertidos para formato estruturado!');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  // -- Render food item row (clean, mobile-first) --
  const renderFoodRow = (food: any, mealIdx: number, optIdx?: number) => {
    const filterCats = GROUP_TO_CATEGORIES[food.group || 'Outros'] || [];

    const setQty = (q: number) => updateFoodQuantity(mealIdx, food.temp_id, Math.max(0.1, Math.round(q * 10) / 10), optIdx);

    return (
      <div key={food.temp_id} className="rounded-xl border bg-card overflow-hidden">
        {/* Name + delete */}
        <div className="flex items-start gap-2 px-3 pt-3">
          <p className="text-sm font-semibold leading-snug break-words flex-1">{food.name}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="secondary" className="text-xs font-bold">{Math.round(food.calories)} kcal</Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-1 text-muted-foreground hover:text-destructive"
              title="Remover alimento"
              onClick={() => removeFoodFromMeal(mealIdx, food.temp_id, optIdx)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quantity stepper + measure */}
        <div className="flex items-center gap-2 flex-wrap px-3 pt-2 pb-3">
          <div className="flex items-center rounded-lg border overflow-hidden h-10">
            <button
              type="button"
              className="h-full w-10 flex items-center justify-center text-muted-foreground active:bg-muted"
              onClick={() => setQty(food.quantity - 0.5)}
            >
              <Minus className="h-4 w-4" />
            </button>
            <QuantityInput
              value={food.quantity}
              onCommit={(v) => setQty(v)}
              className="w-14 h-full text-center px-0 border-0 border-x rounded-none font-semibold text-sm focus-visible:ring-0"
            />
            <button
              type="button"
              className="h-full w-10 flex items-center justify-center text-muted-foreground active:bg-muted"
              onClick={() => setQty(food.quantity + 0.5)}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <InlineMeasurePicker food={food} onSelect={(m) => updateFoodMeasure(mealIdx, food.temp_id, m, optIdx)} />
          <span className="text-xs text-muted-foreground">{Math.round(food.weight_g)}g</span>
        </div>

        {/* Substitutions */}
        {(food.substitutions || []).map((sub: any) => (
          <div key={sub.temp_id} className="flex items-center gap-2 px-3 py-2 border-t bg-muted/20">
            <Badge className="text-[10px] shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-0">ou</Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{sub.name}</p>
              <p className="text-[11px] text-muted-foreground">{sub.quantity} {sub.measure_name} · {Math.round(sub.weight_g)}g · {Math.round(sub.calories)} kcal</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => removeSubstitution(mealIdx, food.temp_id, sub.temp_id, optIdx)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {/* Inline replace search */}
        {food._showReplace && (
          <div className="px-3 pb-3 border-t pt-2.5 bg-muted/20">
            <p className="text-[11px] text-primary font-semibold mb-1.5">Trocar por outro alimento:</p>
            <FoodSearchAutocomplete
              placeholder="Buscar novo alimento..."
              compact
              onAddFood={(newFood) => replaceFood(mealIdx, food.temp_id, newFood, optIdx)}
            />
          </div>
        )}

        {/* Inline add-substitution search */}
        {food._showSubSearch && (
          <div className="px-3 pb-3 border-t pt-2.5 bg-blue-50/50 dark:bg-blue-950/20">
            <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mb-1.5">Substituição equivalente:</p>
            <FoodSearchAutocomplete
              placeholder="Buscar substituição..."
              compact
              targetCalories={food.calories}
              filterCategories={filterCats}
              onAddFood={(sub) => {
                addSubstitution(mealIdx, food.temp_id, sub, optIdx);
                toggleSubSearch(mealIdx, food.temp_id, false, optIdx);
              }}
            />
          </div>
        )}

        {/* Action footer — big tappable buttons */}
        <div className="flex border-t divide-x text-xs">
          <button
            type="button"
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 font-medium active:bg-muted ${food._showReplace ? 'text-primary bg-muted/40' : 'text-muted-foreground'}`}
            onClick={() => { toggleReplace(mealIdx, food.temp_id, !food._showReplace, optIdx); if (food._showSubSearch) toggleSubSearch(mealIdx, food.temp_id, false, optIdx); }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Trocar
          </button>
          <button
            type="button"
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 font-medium active:bg-blue-50 ${food._showSubSearch ? 'text-blue-700 bg-blue-50 dark:bg-blue-950/20' : 'text-blue-600 dark:text-blue-400'}`}
            onClick={() => { toggleSubSearch(mealIdx, food.temp_id, !food._showSubSearch, optIdx); if (food._showReplace) toggleReplace(mealIdx, food.temp_id, false, optIdx); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Substituição
          </button>
        </div>
      </div>
    );
  };

  // -- Render food list for a meal or option --
  const renderFoodList = (foods: any[], legacyGroups: any[], mealIdx: number, optIdx?: number) => (
    <div className="space-y-1">
      {/* Legacy food groups with convert button */}
      {legacyGroups.length > 0 && (
        <div className="space-y-2 pb-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs border-primary/50 text-primary hover:bg-primary/10"
            onClick={() => convertMealToStructured(mealIdx, optIdx)}
            disabled={isConverting}
          >
            {isConverting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Utensils className="h-3.5 w-3.5" />}
            Converter para edição inteligente
          </Button>
          {legacyGroups.map((fg: any, j: number) => (
            <div key={j} className="rounded-lg border bg-muted/20 overflow-hidden">
              <div className="flex items-center justify-end px-2 py-1 border-b bg-muted/30">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive shrink-0"
                  onClick={() => removeLegacyFoodGroup(mealIdx, j, optIdx)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                value={fg.options || ''}
                onChange={(e) => updateLegacyFoodGroup(mealIdx, j, 'options', e.target.value, optIdx)}
                className="text-sm border-0 rounded-none bg-transparent min-h-[44px] resize-y"
                rows={2}
              />
            </div>
          ))}
        </div>
      )}

      {/* Structured foods — clean flat list */}
      {foods.length > 0 && (
        <div className="space-y-2">
          {foods.map((f) => renderFoodRow(f, mealIdx, optIdx))}
        </div>
      )}

      {/* Food search */}
      <div className="pt-1">
        <FoodSearchAutocomplete
          placeholder="+ Adicionar alimento..."
          onAddFood={(food) => addFoodToMeal(mealIdx, food, optIdx)}
        />
      </div>
    </div>
  );

  // -- View mode: clean flat food list (no category labels) --
  const renderViewFoods = (foods: any[], legacyGroups: any[]) => {
    if (foods.length > 0) {
      return (
        <div className="space-y-2">
          {foods.map((f: any) => (
            <div key={f.temp_id} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{f.name}</span>
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {f.quantity} {f.measure_name} · {Math.round(f.weight_g)}g
                </span>
              </div>
              {(f.substitutions || []).length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  ou {f.substitutions.map((s: any) => `${s.name} (${s.quantity} ${s.measure_name})`).join(' ou ')}
                </p>
              )}
            </div>
          ))}
        </div>
      );
    }
    // Legacy fallback — plain lines without category emphasis
    return (
      <div className="space-y-1.5">
        {(legacyGroups || []).map((fg: any, j: number) => (
          <p key={j} className="text-sm text-muted-foreground">{fg.options}</p>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Utensils className="h-4 w-4 text-primary" />
            Plano Alimentar
          </CardTitle>
          {!isEditing && (
            <Button variant="default" size="sm" onClick={handleStartEditing} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>
        <CardDescription>Baseado nos alimentos que o atleta ja consome</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Sticky live totals — sempre visível no topo enquanto edita as refeições */}
        {isEditing && computedTotals && (
          <div className="sticky top-0 -mx-6 px-4 sm:px-6 py-2.5 mb-4 border-b bg-green-50/95 dark:bg-green-950/90 backdrop-blur-sm z-20 border-green-200 dark:border-green-800 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-700 dark:text-green-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Total do dia</span>
              {athleteWeightKg && <span className="text-[10px] text-muted-foreground ml-auto">Peso: {athleteWeightKg} kg</span>}
              {!athleteWeightKg && (
                <span className="text-[10px] text-amber-700 dark:text-amber-400 ml-auto">
                  Peso não registrado — g/kg indisponível
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-sm text-green-900 dark:text-green-200">
                {Math.round(computedTotals.calories)} kcal
                {athleteWeightKg && (
                  <span className="ml-1 text-[11px] font-normal text-green-700 dark:text-green-400">
                    ({(computedTotals.calories / athleteWeightKg).toFixed(1)} kcal/kg)
                  </span>
                )}
              </span>
              <MacroChip color="blue" label="CHO" g={computedTotals.carbs_g} gkg={athleteWeightKg ? computedTotals.carbs_g / athleteWeightKg : null} />
              <MacroChip color="purple" label="PTN" g={computedTotals.protein_g} gkg={athleteWeightKg ? computedTotals.protein_g / athleteWeightKg : null} />
              <MacroChip color="orange" label="LIP" g={computedTotals.fat_g} gkg={athleteWeightKg ? computedTotals.fat_g / athleteWeightKg : null} />
            </div>
          </div>
        )}

        <div className="space-y-4">
          {isEditing && meals.some((m: any) => {
            if (m.options?.length > 0) return m.options.some((o: any) => o.food_groups?.length > 0);
            return m.food_groups?.length > 0;
          }) && (
            <Button
              variant="default"
              size="sm"
              className="w-full gap-2"
              onClick={convertAllMeals}
              disabled={isConverting}
            >
              {isConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Utensils className="h-4 w-4" />}
              Converter todos os alimentos para formato estruturado
            </Button>
          )}
          {meals.map((meal: any, i: number) => {
            const hasOptions = meal.options?.length > 0;
            const mealTotals = computedMealTotals(meal);

            return (
              <div key={i} className="rounded-lg border bg-card overflow-hidden">
                {/* Meal header */}
                <div className="flex items-center gap-2 p-3 bg-muted/30 border-b">
                  {isEditing && (
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        onClick={() => moveMeal(i, -1)}
                        disabled={i === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMeal(i, 1)}
                        disabled={i === meals.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {isEditing ? (
                    <Input
                      value={meal.meal_name}
                      onChange={(e) => updateMealField(i, 'meal_name', e.target.value)}
                      placeholder="Ex: 07:00 - Café da manhã"
                      className="font-semibold text-sm flex-1 min-w-0 h-9"
                    />
                  ) : (
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                      {meal.meal_name}
                    </h4>
                  )}

                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    {isEditing && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1 px-2"
                          onClick={() => addOptionToMeal(i)}
                          title="Adicionar opção de refeição"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Opção</span>
                        </Button>
                        {meals.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive h-8 w-8"
                            onClick={() => removeMeal(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3">
                  {/* Meal-level totals — sempre visível */}
                  {mealTotals && (
                    <div className="flex items-center gap-1.5 text-[11px] flex-wrap mb-2 pb-2 border-b border-dashed">
                      <span className="font-bold text-foreground">{Math.round(mealTotals.calories)} kcal</span>
                      <span className="text-blue-600 dark:text-blue-400">C {Math.round(mealTotals.carbs_g)}g</span>
                      <span className="text-purple-600 dark:text-purple-400">P {Math.round(mealTotals.protein_g)}g</span>
                      <span className="text-orange-600 dark:text-orange-400">G {Math.round(mealTotals.fat_g)}g</span>
                      {athleteWeightKg && (
                        <span className="text-muted-foreground ml-auto">
                          {(mealTotals.carbs_g / athleteWeightKg).toFixed(1)} · {(mealTotals.protein_g / athleteWeightKg).toFixed(1)} · {(mealTotals.fat_g / athleteWeightKg).toFixed(1)} g/kg
                        </span>
                      )}
                    </div>
                  )}
                  {isEditing ? (
                    hasOptions ? (
                      // Multiple options view
                      <div className="space-y-3">
                        {meal.options.map((opt: any, oi: number) => {
                          const optFoods = opt.foods || [];
                          const optTotals = computedMealOptionTotals(optFoods);
                          return (
                            <div key={oi} className="border rounded-lg p-3 bg-background">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <Badge variant="outline" className="text-xs font-semibold">
                                  {opt.label}
                                </Badge>
                                <div className="flex items-center gap-2 min-w-0">
                                  {optTotals && mealTotalChips(optTotals)}
                                  {meal.options.length > 1 && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive shrink-0"
                                      onClick={() => removeOption(i, oi)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {renderFoodList(optFoods, opt.food_groups || [], i, oi)}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Single meal (no options)
                      <>
                        {(() => {
                          const foods = meal.foods || [];
                          const optTotals = computedMealOptionTotals(foods);
                          return (
                            <>
                              {optTotals && (
                                <div className="flex justify-end mb-2">
                                  {mealTotalChips(optTotals)}
                                </div>
                              )}
                              {renderFoodList(foods, meal.food_groups || [], i)}
                            </>
                          );
                        })()}
                      </>
                    )
                  ) : (
                    // View mode — clean flat list, no category labels
                    hasOptions ? (
                      <div className="space-y-3">
                        {meal.options.map((opt: any, oi: number) => (
                          <div key={oi} className={oi > 0 ? 'border-t pt-2.5' : ''}>
                            <Badge variant="outline" className="text-xs font-semibold mb-2">
                              {opt.label}
                            </Badge>
                            {renderViewFoods(opt.foods || [], opt.food_groups || [])}
                          </div>
                        ))}
                      </div>
                    ) : (
                      renderViewFoods(meal.foods || [], meal.food_groups || [])
                    )
                  )}

                  {/* Timing note */}
                  {isEditing ? (
                    <div className="mt-3">
                      <Input
                        value={meal.timing_note || ''}
                        onChange={(e) => updateMealField(i, 'timing_note', e.target.value)}
                        placeholder="Nota de horario/timing"
                        className="text-xs"
                      />
                    </div>
                  ) : (
                    <>
                      {meal.meal_macros && (
                        <p className="text-xs text-green-600 mt-2 font-medium">
                          {'\u{1F4CA}'} {meal.meal_macros}
                        </p>
                      )}
                      {meal.timing_note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {'⏰'} {meal.timing_note}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add meal buttons */}
          {isEditing && (
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={() => addMeal()}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Adicionar refeicao
              </Button>
              {/* Quick-add from anamnese schedule */}
              {mealTimes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-muted-foreground self-center">Horarios da anamnese:</span>
                  {mealTimes.map((time, idx) => (
                    <Button
                      key={idx}
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] px-2"
                      onClick={() => addMeal(time)}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      {time}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Realizado - computed from actual foods (edit mode only) */}
        {computedTotals && (
          <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-green-800 dark:text-green-300">
              <TrendingUp className="h-3.5 w-3.5" />
              Total Realizado (calculado dos alimentos)
              {athleteWeightKg && <span className="text-[10px] font-normal text-muted-foreground ml-auto">Peso: {athleteWeightKg} kg</span>}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-2 rounded bg-yellow-100 dark:bg-yellow-900/30 text-center">
                <div className="text-lg font-bold text-yellow-800 dark:text-yellow-300">{Math.round(computedTotals.calories)}</div>
                <div className="text-[10px] text-muted-foreground">kcal</div>
                {athleteWeightKg && (
                  <div className="text-[11px] font-medium text-yellow-700 dark:text-yellow-400">
                    {(computedTotals.calories / athleteWeightKg).toFixed(1)} kcal/kg
                  </div>
                )}
              </div>
              <div className="p-2 rounded bg-blue-100 dark:bg-blue-900/30 text-center">
                <div className="text-lg font-bold text-blue-800 dark:text-blue-300">{Math.round(computedTotals.carbs_g)}g</div>
                <div className="text-[10px] text-muted-foreground">CHO ({Math.round(computedTotals.carbs_g * 4)} kcal)</div>
                {athleteWeightKg && (
                  <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                    {(computedTotals.carbs_g / athleteWeightKg).toFixed(1)} g/kg
                  </div>
                )}
              </div>
              <div className="p-2 rounded bg-purple-100 dark:bg-purple-900/30 text-center">
                <div className="text-lg font-bold text-purple-800 dark:text-purple-300">{Math.round(computedTotals.protein_g)}g</div>
                <div className="text-[10px] text-muted-foreground">PTN ({Math.round(computedTotals.protein_g * 4)} kcal)</div>
                {athleteWeightKg && (
                  <div className="text-[11px] font-medium text-purple-700 dark:text-purple-400">
                    {(computedTotals.protein_g / athleteWeightKg).toFixed(1)} g/kg
                  </div>
                )}
              </div>
              <div className="p-2 rounded bg-orange-100 dark:bg-orange-900/30 text-center">
                <div className="text-lg font-bold text-orange-800 dark:text-orange-300">{Math.round(computedTotals.fat_g)}g</div>
                <div className="text-[10px] text-muted-foreground">LIP ({Math.round(computedTotals.fat_g * 9)} kcal)</div>
                {athleteWeightKg && (
                  <div className="text-[11px] font-medium text-orange-700 dark:text-orange-400">
                    {(computedTotals.fat_g / athleteWeightKg).toFixed(1)} g/kg
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Daily totals - Planejado */}
        {(dailyTotals || isEditing) && (
          <div className="mt-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              {isEditing ? 'Meta Planejada' : 'Totais Diarios'}
            </h4>
            {isEditing ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Calorias (kcal)</label>
                  <Input type="number" value={dailyTotals?.kcal ?? ''} onChange={(e) => updateDailyTotal('kcal', e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">kcal/kg</label>
                  <Input type="number" step="0.1" value={dailyTotals?.kcal_kg ?? ''} onChange={(e) => updateDailyTotal('kcal_kg', e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">CHO (g)</label>
                  <Input type="number" value={dailyTotals?.cho_g ?? ''} onChange={(e) => updateDailyTotal('cho_g', e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">CHO (g/kg)</label>
                  <Input type="number" step="0.1" value={dailyTotals?.cho_gkg ?? ''} onChange={(e) => updateDailyTotal('cho_gkg', e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">PTN (g)</label>
                  <Input type="number" value={dailyTotals?.protein_g ?? ''} onChange={(e) => updateDailyTotal('protein_g', e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">PTN (g/kg)</label>
                  <Input type="number" step="0.1" value={dailyTotals?.protein_gkg ?? ''} onChange={(e) => updateDailyTotal('protein_gkg', e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">LIP (g)</label>
                  <Input type="number" value={dailyTotals?.fat_g ?? ''} onChange={(e) => updateDailyTotal('fat_g', e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">LIP (g/kg)</label>
                  <Input type="number" step="0.1" value={dailyTotals?.fat_gkg ?? ''} onChange={(e) => updateDailyTotal('fat_gkg', e.target.value)} className="text-sm" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Calorias:</span>{' '}
                  <span className="font-semibold">~{dailyTotals.kcal} kcal</span>
                  {dailyTotals.kcal_kg && <span className="text-xs text-muted-foreground ml-1">({dailyTotals.kcal_kg} kcal/kg)</span>}
                </div>
                <div>
                  <span className="text-muted-foreground">CHO:</span>{' '}
                  <span className="font-semibold">~{dailyTotals.cho_g}g</span>
                  {dailyTotals.cho_gkg && <span className="text-xs text-muted-foreground ml-1">({dailyTotals.cho_gkg} g/kg)</span>}
                </div>
                <div>
                  <span className="text-muted-foreground">PTN:</span>{' '}
                  <span className="font-semibold">~{dailyTotals.protein_g}g</span>
                  {dailyTotals.protein_gkg && <span className="text-xs text-muted-foreground ml-1">({dailyTotals.protein_gkg} g/kg)</span>}
                </div>
                <div>
                  <span className="text-muted-foreground">LIP:</span>{' '}
                  <span className="font-semibold">~{dailyTotals.fat_g}g</span>
                  {dailyTotals.fat_gkg && <span className="text-xs text-muted-foreground ml-1">({dailyTotals.fat_gkg} g/kg)</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons — sticky bar for easy access on mobile while scrolling */}
        {isEditing && (
          <div className="sticky bottom-0 -mx-6 px-4 sm:px-6 py-3 border-t bg-background/95 backdrop-blur-sm z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button onClick={handleSaveDirectly} disabled={busy} className="gap-1.5 flex-1">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar Plano
            </Button>
            <Button variant="outline" onClick={handleAuditAndSave} disabled={busy} className="gap-1.5 flex-1">
              {isAuditing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              Salvar e Auditar com IA
            </Button>
            <Button variant="ghost" onClick={handleCancel} disabled={busy} className="gap-1.5">
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Numeric input that keeps a local string so the user can clear the field
 * and type freely (e.g. "0." or ""). Commits on blur / Enter, ignoring
 * empty or invalid values (reverts to the last valid prop value).
 */
function QuantityInput({
  value,
  onCommit,
  className,
}: {
  value: number;
  onCommit: (v: number) => void;
  className?: string;
}) {
  const [text, setText] = useState<string>(String(value));

  // Sync when the external value changes (e.g. stepper buttons).
  useEffect(() => {
    setText((prev) => (parseFloat(prev.replace(',', '.')) === value ? prev : String(value)));
  }, [value]);

  const commit = () => {
    const parsed = parseFloat(text.replace(',', '.'));
    if (!isFinite(parsed) || parsed <= 0) {
      setText(String(value));
      return;
    }
    const rounded = Math.round(parsed * 10) / 10;
    if (rounded !== value) onCommit(rounded);
    setText(String(rounded));
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={className}
    />
  );
}

