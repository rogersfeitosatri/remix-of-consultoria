import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Pencil,
  Save,
  Brain,
  Plus,
  Trash2,
  X,
  UtensilsCrossed,
  TrendingUp,
  Utensils,
  Loader2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Copy,
  ArrowRightLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import FoodSearchAutocomplete from './FoodSearchAutocomplete';
import { type SelectedFood } from '@/hooks/useFoodSearch';

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

const GROUP_COLORS: Record<string, string> = {
  'Carboidratos': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'Proteinas': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'Gorduras': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'Vegetais': 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'Frutas': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'Outros': 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300',
};

const GROUP_OPTIONS = ['Carboidratos', 'Proteinas', 'Gorduras', 'Vegetais', 'Frutas', 'Outros'];

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

export function EditableMealPlan({ analysis, clientId, mealSchedule, onUpdated }: EditableMealPlanProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState(() => deepClone(analysis));

  const meals = isEditing ? editedAnalysis.meal_plan?.meals ?? [] : analysis.meal_plan?.meals ?? [];
  const dailyTotals = isEditing
    ? editedAnalysis.meal_plan?.daily_totals
    : analysis.meal_plan?.daily_totals;

  const mealTimes = useMemo(() => extractMealTimes(mealSchedule), [mealSchedule]);

  // Compute real-time totals from structured foods across all meals and options
  const computedTotals = useMemo(() => {
    if (!isEditing) return null;
    // Use only Opção 1 of each meal for daily total calculation
    const allFoods: SelectedFood[] = [];
    for (const meal of meals) {
      if (meal.options?.length > 0) {
        allFoods.push(...(meal.options[0]?.foods ?? []));
      } else {
        allFoods.push(...(meal.foods ?? []));
      }
    }
    if (allFoods.length === 0) return null;
    return sumFoods(allFoods);
  }, [isEditing, meals]);

  const computedMealOptionTotals = useCallback((foods: SelectedFood[]) => {
    if (foods.length === 0) return null;
    return sumFoods(foods);
  }, []);

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

  const updateFoodGroup = (mealIdx: number, foodTempId: string, newGroup: string, optIdx?: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      let foods: SelectedFood[];
      if (optIdx !== undefined && next.meal_plan.meals[mealIdx].options) {
        foods = next.meal_plan.meals[mealIdx].options[optIdx].foods || [];
      } else {
        foods = next.meal_plan.meals[mealIdx].foods || [];
      }
      const food = foods.find((f: SelectedFood) => f.temp_id === foodTempId);
      if (food) food.group = newGroup;
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

  const buildSaveData = () => {
    const data = deepClone(editedAnalysis);
    for (const meal of data.meal_plan?.meals ?? []) {
      const processOption = (opt: any) => {
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
        // Use first option macros as meal_macros
        meal.meal_macros = meal.options[0]?.meal_macros || '';
        meal.food_groups = meal.options[0]?.food_groups || [];
      } else {
        processOption(meal);
      }
    }
    if (computedTotals) {
      if (!data.meal_plan.daily_totals) data.meal_plan.daily_totals = {};
      data.meal_plan.daily_totals.kcal = Math.round(computedTotals.calories);
      data.meal_plan.daily_totals.cho_g = Math.round(computedTotals.carbs_g);
      data.meal_plan.daily_totals.protein_g = Math.round(computedTotals.protein_g);
      data.meal_plan.daily_totals.fat_g = Math.round(computedTotals.fat_g);
    }
    return data;
  };

  const saveDirectly = async () => {
    const data = buildSaveData();
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

  const handleStartEditing = () => {
    setEditedAnalysis(deepClone(analysis));
    setIsEditing(true);
  };

  const busy = isAuditing || isSaving;

  // -- Render food item row --
  const renderFoodRow = (food: any, mealIdx: number, optIdx?: number) => (
    <div key={food.temp_id}>
      <div className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/40 group">
        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        {/* Editable group badge */}
        <select
          value={food.group || 'Outros'}
          onChange={(e) => updateFoodGroup(mealIdx, food.temp_id, e.target.value, optIdx)}
          className={`text-[10px] px-1.5 py-0.5 rounded-full border-0 cursor-pointer font-medium shrink-0 ${GROUP_COLORS[food.group] || GROUP_COLORS['Outros']}`}
        >
          {GROUP_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="text-sm font-medium flex-1 min-w-0 truncate">{food.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {food.quantity} {food.measure_name}
        </span>
        <span className="text-[11px] text-muted-foreground shrink-0">({Math.round(food.weight_g)}g)</span>
        <div className="flex gap-1.5 text-[11px] text-muted-foreground shrink-0">
          <span className="font-medium text-foreground">{Math.round(food.calories)} kcal</span>
          <span>C:{Math.round(food.carbs_g)}g</span>
          <span>P:{Math.round(food.protein_g)}g</span>
          <span>G:{Math.round(food.fat_g)}g</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
          onClick={() => removeFoodFromMeal(mealIdx, food.temp_id, optIdx)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {/* Substitutions */}
      {(food.substitutions || []).map((sub: any) => (
        <div key={sub.temp_id} className="flex items-center gap-2 py-1 px-2 pl-8 group text-muted-foreground">
          <ArrowRightLeft className="h-3 w-3 shrink-0 text-blue-500" />
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium shrink-0">ou</span>
          <span className="text-sm flex-1 min-w-0 truncate">{sub.name}</span>
          <span className="text-xs shrink-0">{sub.quantity} {sub.measure_name} ({Math.round(sub.weight_g)}g)</span>
          <div className="flex gap-1.5 text-[11px] shrink-0">
            <span>{Math.round(sub.calories)} kcal</span>
            <span>C:{Math.round(sub.carbs_g)}g</span>
            <span>P:{Math.round(sub.protein_g)}g</span>
            <span>G:{Math.round(sub.fat_g)}g</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
            onClick={() => removeSubstitution(mealIdx, food.temp_id, sub.temp_id, optIdx)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      {/* Add substitution */}
      {food._showSubSearch ? (
        <div className="pl-8 py-1">
          <FoodSearchAutocomplete
            placeholder="Buscar substituicao..."
            onAddFood={(sub) => {
              addSubstitution(mealIdx, food.temp_id, sub, optIdx);
              // Hide search after adding
              setEditedAnalysis((prev: any) => {
                const next = deepClone(prev);
                const foods = optIdx !== undefined
                  ? next.meal_plan.meals[mealIdx].options[optIdx].foods
                  : next.meal_plan.meals[mealIdx].foods;
                const f = foods?.find((x: any) => x.temp_id === food.temp_id);
                if (f) f._showSubSearch = false;
                return next;
              });
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          className="ml-8 mt-0.5 text-[11px] text-blue-500 hover:text-blue-700 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => {
            setEditedAnalysis((prev: any) => {
              const next = deepClone(prev);
              const foods = optIdx !== undefined
                ? next.meal_plan.meals[mealIdx].options[optIdx].foods
                : next.meal_plan.meals[mealIdx].foods;
              const f = foods?.find((x: any) => x.temp_id === food.temp_id);
              if (f) f._showSubSearch = true;
              return next;
            });
          }}
        >
          <ArrowRightLeft className="h-3 w-3" />
          Substituicao
        </button>
      )}
    </div>
  );

  // -- Render food list for a meal or option --
  const renderFoodList = (foods: any[], legacyGroups: any[], mealIdx: number, optIdx?: number) => (
    <div className="space-y-1">
      {/* Structured foods grouped by category */}
      {foods.length > 0 && (() => {
        const grouped: Record<string, any[]> = {};
        for (const f of foods) {
          const g = f.group || 'Outros';
          if (!grouped[g]) grouped[g] = [];
          grouped[g].push(f);
        }
        return Object.entries(grouped).map(([group, groupFoods]) => (
          <div key={group}>
            <div className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-t ${GROUP_COLORS[group] || ''}`}>
              {group}
            </div>
            {groupFoods.map((f) => renderFoodRow(f, mealIdx, optIdx))}
          </div>
        ));
      })()}

      {/* Legacy food groups (if no structured foods) */}
      {foods.length === 0 && legacyGroups.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[10px] text-muted-foreground italic px-2">Plano original (texto):</p>
          {legacyGroups.map((fg: any, j: number) => (
            <div key={j} className="flex items-center gap-2 px-2 py-1 text-sm bg-muted/20 rounded">
              <span className="font-medium text-primary min-w-[80px] text-xs">{fg.group}:</span>
              <span className="text-muted-foreground text-xs flex-1">{fg.options}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-destructive shrink-0"
                onClick={() => removeLegacyFoodGroup(mealIdx, j, optIdx)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Food search */}
      <div className="pt-1.5">
        <FoodSearchAutocomplete
          onAddFood={(food) => addFoodToMeal(mealIdx, food, optIdx)}
        />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Utensils className="h-4 w-4 text-primary" />
            4. Plano Alimentar Estruturado
          </CardTitle>
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={handleStartEditing}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar Plano
            </Button>
          )}
        </div>
        <CardDescription>Baseado nos alimentos que o atleta ja consome</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {meals.map((meal: any, i: number) => {
            const hasOptions = meal.options?.length > 0;

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
                      placeholder="Ex: 07:00 - Cafe da manha"
                      className="font-semibold text-sm max-w-[250px] h-8"
                    />
                  ) : (
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                      {meal.meal_name}
                    </h4>
                  )}

                  <div className="flex items-center gap-1 ml-auto">
                    {isEditing && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => addOptionToMeal(i)}
                          title="Adicionar opcao de refeicao"
                        >
                          <Copy className="h-3 w-3" />
                          Opcao
                        </Button>
                        {meals.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive h-7 w-7 p-0"
                            onClick={() => removeMeal(i)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3">
                  {isEditing ? (
                    hasOptions ? (
                      // Multiple options view
                      <div className="space-y-3">
                        {meal.options.map((opt: any, oi: number) => {
                          const optFoods = opt.foods || [];
                          const optTotals = computedMealOptionTotals(optFoods);
                          return (
                            <div key={oi} className="border rounded-lg p-3 bg-background">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="text-xs font-semibold">
                                  {opt.label}
                                </Badge>
                                {optTotals && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {Math.round(optTotals.calories)} kcal | C:{Math.round(optTotals.carbs_g)}g P:{Math.round(optTotals.protein_g)}g G:{Math.round(optTotals.fat_g)}g
                                  </span>
                                )}
                                {meal.options.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-destructive"
                                    onClick={() => removeOption(i, oi)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
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
                                  <Badge variant="secondary" className="text-[10px] font-normal">
                                    {Math.round(optTotals.calories)} kcal | C:{Math.round(optTotals.carbs_g)}g P:{Math.round(optTotals.protein_g)}g G:{Math.round(optTotals.fat_g)}g
                                  </Badge>
                                </div>
                              )}
                              {renderFoodList(foods, meal.food_groups || [], i)}
                            </>
                          );
                        })()}
                      </>
                    )
                  ) : (
                    // View mode
                    <div className="space-y-1.5">
                      {(meal.food_groups || []).map((fg: any, j: number) => (
                        <div key={j} className="flex gap-2 text-sm">
                          <span className="font-medium text-primary min-w-[90px]">{fg.group}:</span>
                          <span className="text-muted-foreground">{fg.options}</span>
                        </div>
                      ))}
                    </div>
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

        {/* Daily totals */}
        {(dailyTotals || isEditing) && (
          <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              Totais Diarios
              {isEditing && computedTotals && (
                <Badge variant="default" className="text-[10px] ml-auto font-normal">
                  Calculado: {Math.round(computedTotals.calories)} kcal | C:{Math.round(computedTotals.carbs_g)}g | P:{Math.round(computedTotals.protein_g)}g | G:{Math.round(computedTotals.fat_g)}g
                </Badge>
              )}
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

        {/* Action buttons */}
        {isEditing && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
            <Button onClick={handleAuditAndSave} disabled={busy} className="gap-1.5">
              {isAuditing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              Salvar e Auditar com IA
            </Button>
            <Button variant="outline" onClick={handleSaveDirectly} disabled={busy} className="gap-1.5">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar sem Auditoria
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
