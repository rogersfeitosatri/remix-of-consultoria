import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditableMealPlanProps {
  analysis: any;
  clientId: string;
  onUpdated: () => void;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export default function EditableMealPlan({ analysis, clientId, onUpdated }: EditableMealPlanProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState(() => deepClone(analysis));

  const meals = isEditing ? editedAnalysis.meal_plan?.meals ?? [] : analysis.meal_plan?.meals ?? [];
  const dailyTotals = isEditing
    ? editedAnalysis.meal_plan?.daily_totals
    : analysis.meal_plan?.daily_totals;

  // -- Helpers to update nested state immutably --

  const updateMealField = (mealIdx: number, field: string, value: string) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals[mealIdx][field] = value;
      return next;
    });
  };

  const updateFoodGroup = (mealIdx: number, fgIdx: number, field: string, value: string) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals[mealIdx].food_groups[fgIdx][field] = value;
      return next;
    });
  };

  const addFoodGroup = (mealIdx: number) => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals[mealIdx].food_groups.push({ group: '', options: '' });
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

  const addMeal = () => {
    setEditedAnalysis((prev: any) => {
      const next = deepClone(prev);
      next.meal_plan.meals.push({
        meal_name: '',
        food_groups: [{ group: '', options: '' }],
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

  const saveDirectly = async () => {
    const updatedRaw = JSON.stringify({ ...editedAnalysis, _isNewFormat: true });
    const { error } = await supabase
      .from('ai_analyses')
      .update({
        raw_response: updatedRaw,
        caloric_deficit: { meal_plan: editedAnalysis.meal_plan } as any,
        updated_at: new Date().toISOString(),
      })
      .eq('client_id', clientId);
    if (error) throw error;
  };

  const auditWithAI = async () => {
    const { data, error } = await supabase.functions.invoke('audit-meal-plan', {
      body: { clientId, editedAnalysis },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
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
          {meals.map((meal: any, i: number) => (
            <div key={i} className="p-4 rounded-lg border bg-card">
              {/* Meal header */}
              <div className="flex items-center justify-between mb-2">
                {isEditing ? (
                  <Input
                    value={meal.meal_name}
                    onChange={(e) => updateMealField(i, 'meal_name', e.target.value)}
                    placeholder="Nome da refeicao"
                    className="font-semibold text-sm max-w-xs"
                  />
                ) : (
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                    {meal.meal_name}
                  </h4>
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

              {/* Food groups */}
              <div className="space-y-1.5">
                {(meal.food_groups || []).map((fg: any, j: number) =>
                  isEditing ? (
                    <div key={j} className="flex items-start gap-2">
                      <Input
                        value={fg.group}
                        onChange={(e) => updateFoodGroup(i, j, 'group', e.target.value)}
                        placeholder="Grupo"
                        className="w-[120px] text-sm"
                      />
                      <Textarea
                        value={fg.options}
                        onChange={(e) => updateFoodGroup(i, j, 'options', e.target.value)}
                        placeholder="Opcoes"
                        className="text-sm min-h-[36px]"
                        rows={1}
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
                  ) : (
                    <div key={j} className="flex gap-2 text-sm">
                      <span className="font-medium text-primary min-w-[90px]">{fg.group}:</span>
                      <span className="text-muted-foreground">{fg.options}</span>
                    </div>
                  ),
                )}
              </div>

              {isEditing && (
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => addFoodGroup(i)}>
                  <Plus className="h-3 w-3 mr-1" />
                  Grupo alimentar
                </Button>
              )}

              {/* Macros & timing */}
              {isEditing ? (
                <div className="mt-3 space-y-2">
                  <Input
                    value={meal.meal_macros || ''}
                    onChange={(e) => updateMealField(i, 'meal_macros', e.target.value)}
                    placeholder="Macros da refeicao (ex: ~450kcal | 50g CHO | 30g PTN | 15g LIP)"
                    className="text-xs"
                  />
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
          ))}

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
              Totais Diarios Aproximados
            </h4>
            {isEditing ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Calorias (kcal)</label>
                  <Input
                    type="number"
                    value={dailyTotals?.kcal ?? ''}
                    onChange={(e) => updateDailyTotal('kcal', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">CHO (g)</label>
                  <Input
                    type="number"
                    value={dailyTotals?.cho_g ?? ''}
                    onChange={(e) => updateDailyTotal('cho_g', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">CHO (g/kg)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={dailyTotals?.cho_gkg ?? ''}
                    onChange={(e) => updateDailyTotal('cho_gkg', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">PTN (g)</label>
                  <Input
                    type="number"
                    value={dailyTotals?.protein_g ?? ''}
                    onChange={(e) => updateDailyTotal('protein_g', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">PTN (g/kg)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={dailyTotals?.protein_gkg ?? ''}
                    onChange={(e) => updateDailyTotal('protein_gkg', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">LIP (g)</label>
                  <Input
                    type="number"
                    value={dailyTotals?.fat_g ?? ''}
                    onChange={(e) => updateDailyTotal('fat_g', e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Calorias:</span>{' '}
                  <span className="font-semibold">~{dailyTotals.kcal} kcal</span>
                </div>
                <div>
                  <span className="text-muted-foreground">CHO:</span>{' '}
                  <span className="font-semibold">
                    ~{dailyTotals.cho_g}g ({dailyTotals.cho_gkg} g/kg)
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">PTN:</span>{' '}
                  <span className="font-semibold">~{dailyTotals.protein_g}g</span>
                </div>
                <div>
                  <span className="text-muted-foreground">LIP:</span>{' '}
                  <span className="font-semibold">~{dailyTotals.fat_g}g</span>
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
