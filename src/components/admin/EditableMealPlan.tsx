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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import FoodSearchAutocomplete from './FoodSearchAutocomplete';
import { type SelectedFood } from '@/hooks/useFoodSearch';

interface EditableMealPlanProps {
  analysis: any;
  clientId: string;
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

export function EditableMealPlan({ analysis, clientId, onUpdated }: EditableMealPlanProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState(() => deepClone(analysis));

  const meals = isEditing ? editedAnalysis.meal_plan?.meals ?? [] : analysis.meal_plan?.meals ?? [];
  const dailyTotals = isEditing
    ? editedAnalysis.meal_plan?.daily_totals
    : analysis.meal_plan?.daily_totals;

  // Compute real-time totals from structured foods
  const computedTotals = useMemo(() => {
    if (!isEditing) return null;
    const allFoods: SelectedFood[] = meals.flatMap((m: any) => m.foods ?? []);
    if (allFoods.length === 0) return null;
    return sumFoods(allFoods);
  }, [isEditing, meals]);

  const computedMealTotals = useCallback((meal: any) => {
    const foods: SelectedFood[] = meal.foods ?? [];
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

  const addMeal = () => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals.push({
        meal_name: '',
        foods: [],
        food_groups: [],
        meal_macros: '',
        timing_note: '',
      });
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

  // -- Structured food operations --

  const addFoodToMeal = (mealIdx: number, food: SelectedFood) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      if (!next.meal_plan.meals[mealIdx].foods) {
        next.meal_plan.meals[mealIdx].foods = [];
      }
      next.meal_plan.meals[mealIdx].foods.push(food);
      return next;
    });
  };

  const removeFoodFromMeal = (mealIdx: number, foodTempId: string) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals[mealIdx].foods = (next.meal_plan.meals[mealIdx].foods || [])
        .filter((f: SelectedFood) => f.temp_id !== foodTempId);
      return next;
    });
  };

  // -- Legacy food_groups operations (backward compat) --

  const updateFoodGroup = (mealIdx: number, fgIdx: number, field: string, value: string) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals[mealIdx].food_groups[fgIdx][field] = value;
      return next;
    });
  };

  const removeFoodGroup = (mealIdx: number, fgIdx: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals[mealIdx].food_groups.splice(fgIdx, 1);
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
    // Auto-generate meal_macros from structured foods
    for (const meal of data.meal_plan?.meals ?? []) {
      if (meal.foods?.length > 0) {
        const totals = sumFoods(meal.foods);
        meal.meal_macros = `~${Math.round(totals.calories)} kcal | ${Math.round(totals.carbs_g)}g CHO | ${Math.round(totals.protein_g)}g PTN | ${Math.round(totals.fat_g)}g LIP`;
        // Also generate food_groups from structured foods for backward compat
        const groups: Record<string, string[]> = {};
        for (const f of meal.foods) {
          const g = f.group || 'Alimento';
          if (!groups[g]) groups[g] = [];
          groups[g].push(`${f.name} - ${f.quantity} ${f.measure_name} (${Math.round(f.weight_g)}g)`);
        }
        meal.food_groups = Object.entries(groups).map(([group, items]) => ({
          group,
          options: items.join(' | '),
        }));
      }
    }
    // Update daily totals from computed if structured foods exist
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
            const mealTotals = isEditing ? computedMealTotals(meal) : null;
            const hasFoods = (meal.foods?.length ?? 0) > 0;

            return (
              <div key={i} className="p-4 rounded-lg border bg-card">
                {/* Meal header */}
                <div className="flex items-center justify-between mb-3">
                  {isEditing ? (
                    <Input
                      value={meal.meal_name}
                      onChange={(e) => updateMealField(i, 'meal_name', e.target.value)}
                      placeholder="Ex: 07:00 - Cafe da manha"
                      className="font-semibold text-sm max-w-xs"
                    />
                  ) : (
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                      {meal.meal_name}
                    </h4>
                  )}
                  <div className="flex items-center gap-1">
                    {/* Real-time meal macro badge */}
                    {isEditing && mealTotals && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {Math.round(mealTotals.calories)} kcal | C:{Math.round(mealTotals.carbs_g)}g P:{Math.round(mealTotals.protein_g)}g G:{Math.round(mealTotals.fat_g)}g
                      </Badge>
                    )}
                    {isEditing && meals.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-7 w-7 p-0"
                        onClick={() => removeMeal(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Structured foods list (edit mode) */}
                {isEditing && (
                  <div className="space-y-1">
                    {(meal.foods || []).map((food: SelectedFood) => (
                      <div
                        key={food.temp_id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/40 group"
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        <span className="text-sm font-medium flex-1 min-w-0 truncate">{food.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {food.quantity} {food.measure_name}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          ({Math.round(food.weight_g)}g)
                        </span>
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
                          onClick={() => removeFoodFromMeal(i, food.temp_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Food search autocomplete */}
                    <div className="pt-2">
                      <FoodSearchAutocomplete
                        onAddFood={(food) => addFoodToMeal(i, food)}
                      />
                    </div>
                  </div>
                )}

                {/* Legacy food groups (view mode OR edit mode for old data) */}
                {!isEditing && (
                  <div className="space-y-1.5">
                    {(meal.food_groups || []).map((fg: any, j: number) => (
                      <div key={j} className="flex gap-2 text-sm">
                        <span className="font-medium text-primary min-w-[90px]">{fg.group}:</span>
                        <span className="text-muted-foreground">{fg.options}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Legacy food groups in edit mode (if no structured foods yet) */}
                {isEditing && !hasFoods && (meal.food_groups?.length ?? 0) > 0 && (
                  <div className="space-y-1.5 mb-2 pt-2 border-t mt-2">
                    <p className="text-[11px] text-muted-foreground italic">
                      Alimentos do plano original (texto livre):
                    </p>
                    {(meal.food_groups || []).map((fg: any, j: number) => (
                      <div key={j} className="flex items-start gap-2">
                        <Input
                          value={fg.group}
                          onChange={(e) => updateFoodGroup(i, j, 'group', e.target.value)}
                          placeholder="Grupo"
                          className="w-[120px] text-sm"
                        />
                        <Input
                          value={fg.options}
                          onChange={(e) => updateFoodGroup(i, j, 'options', e.target.value)}
                          placeholder="Opcoes"
                          className="text-sm flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-7 w-7 p-0 shrink-0"
                          onClick={() => removeFoodGroup(i, j)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
            );
          })}

          {isEditing && (
            <Button variant="outline" size="sm" className="w-full" onClick={addMeal}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Adicionar refeicao
            </Button>
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
