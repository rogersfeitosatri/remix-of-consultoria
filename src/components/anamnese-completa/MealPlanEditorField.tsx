// Editor da "alimentação em um dia habitual" (pergunta 24).
// answer = Meal[] — cada refeição com metadados e uma lista de alimentos.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Copy, ChevronUp, ChevronDown, Utensils } from 'lucide-react';
import type { FieldProps } from './types';

type Food = {
  food_name: string;
  quantity: string | number;
  unit: string;
  preparation?: string;
  brand?: string;
};

type Meal = {
  meal_name: string;
  time: string;
  days_per_week: number | '';
  training_relation: string;
  enabled: boolean;
  foods: Food[];
};

const emptyFood = (): Food => ({ food_name: '', quantity: '', unit: '', preparation: '', brand: '' });

const mealFromName = (name: string): Meal => ({
  meal_name: name,
  time: '',
  days_per_week: '',
  training_relation: '',
  enabled: true,
  foods: [],
});

export function MealPlanEditorField({ value, onChange, config, disabled }: FieldProps) {
  const defaultMeals: string[] = Array.isArray(config?.defaultMeals) ? config!.defaultMeals : [];
  const units: string[] = Array.isArray(config?.units) ? config!.units : [];
  const trainingRelations: string[] = Array.isArray(config?.trainingRelations)
    ? config!.trainingRelations
    : [];
  // Modo wizard: quando focusMealIndex é definido, exibe apenas 1 refeição por vez
  // e oculta os controles de reordenar / adicionar / remover refeição.
  const focusMealIndex: number | undefined =
    typeof config?.focusMealIndex === 'number' ? config!.focusMealIndex : undefined;
  const focusMode = focusMealIndex !== undefined;

  // Deriva as refeições: usa o value quando existir, senão os padrões do config.
  const meals: Meal[] =
    Array.isArray(value) && value.length ? (value as Meal[]) : defaultMeals.map(mealFromName);

  // Toda mutação persiste o array completo via onChange (inicialização lazy).
  const commit = (next: Meal[]) => onChange(next);

  const updateMeal = (i: number, patch: Partial<Meal>) =>
    commit(meals.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const addMeal = () => commit([...meals, mealFromName('')]);
  const dupMeal = (i: number) =>
    commit([
      ...meals.slice(0, i + 1),
      { ...meals[i], foods: meals[i].foods.map((f) => ({ ...f })) },
      ...meals.slice(i + 1),
    ]);
  const delMeal = (i: number) => commit(meals.filter((_, j) => j !== i));
  const moveMeal = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= meals.length) return;
    const next = meals.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const updateFood = (mi: number, fi: number, patch: Partial<Food>) => {
    const foods = meals[mi].foods.map((f, j) => (j === fi ? { ...f, ...patch } : f));
    updateMeal(mi, { foods });
  };
  const addFood = (mi: number) => updateMeal(mi, { foods: [...meals[mi].foods, emptyFood()] });
  const dupFood = (mi: number, fi: number) => {
    const src = meals[mi].foods;
    updateMeal(mi, { foods: [...src.slice(0, fi + 1), { ...src[fi] }, ...src.slice(fi + 1)] });
  };
  const delFood = (mi: number, fi: number) =>
    updateMeal(mi, { foods: meals[mi].foods.filter((_, j) => j !== fi) });

  const renderedMeals = focusMode
    ? meals
        .map((m, i) => ({ m, i }))
        .filter(({ i }) => i === focusMealIndex)
    : meals.map((m, i) => ({ m, i }));

  return (
    <div className="space-y-3">
      {!focusMode && (
        <p className="text-xs text-muted-foreground">
          Ex.: 7h30, depois do treino: 2 pães franceses, 3 ovos mexidos, 1 banana e 1 xícara de café
          com açúcar.
        </p>
      )}

      {renderedMeals.map(({ m: meal, i: mi }) => {
        const off = !meal.enabled;
        return (
          <div key={mi} className="rounded-lg border p-3 space-y-3">
            {/* Cabeçalho da refeição */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Utensils className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Badge variant="secondary" className="shrink-0">
                  {mi + 1}
                </Badge>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={meal.enabled}
                    onCheckedChange={(v) => updateMeal(mi, { enabled: v })}
                    disabled={disabled}
                    aria-label="Ativar refeição"
                  />
                  <span className="text-xs text-muted-foreground">
                    {meal.enabled ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              </div>
              {!disabled && !focusMode && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveMeal(mi, -1)}
                    disabled={mi === 0}
                    aria-label="Mover para cima"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveMeal(mi, 1)}
                    disabled={mi === meals.length - 1}
                    aria-label="Mover para baixo"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => dupMeal(mi)}
                    aria-label="Duplicar refeição"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => delMeal(mi)}
                    aria-label="Remover refeição"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Corpo (esmaecido quando inativa) */}
            <div className={off ? 'opacity-50 pointer-events-none space-y-3' : 'space-y-3'}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Refeição</Label>
                  <Input
                    value={meal.meal_name}
                    onChange={(e) => updateMeal(mi, { meal_name: e.target.value })}
                    placeholder="Ex.: Café da manhã"
                    disabled={disabled}
                    readOnly={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Horário<span className="text-destructive"> *</span></Label>
                  <Input
                    type="time"
                    value={meal.time}
                    onChange={(e) => updateMeal(mi, { time: e.target.value })}
                    disabled={disabled}
                    readOnly={disabled}
                    aria-required
                  />
                </div>
              </div>

              {/* Lista de alimentos — oculta quando inativa */}
              {meal.enabled && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Alimentos</Label>
                  {meal.foods.map((food, fi) => (
                    <div key={fi} className="rounded-md border p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Alimento {fi + 1}</span>
                        {!disabled && (
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => dupFood(mi, fi)}
                              aria-label="Duplicar alimento"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => delFood(mi, fi)}
                              aria-label="Remover alimento"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Alimento<span className="text-destructive"> *</span></Label>
                          <Input
                            value={food.food_name}
                            onChange={(e) => updateFood(mi, fi, { food_name: e.target.value })}
                            placeholder="Ex.: Pão francês"
                            aria-required
                            disabled={disabled}
                            readOnly={disabled}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Porção<span className="text-destructive"> *</span></Label>
                            <Input
                              value={String(food.quantity ?? '')}
                              onChange={(e) => updateFood(mi, fi, { quantity: e.target.value })}
                              placeholder="Ex.: 2 ou 100"
                              aria-required
                              disabled={disabled}
                              readOnly={disabled}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Medida<span className="text-destructive"> *</span></Label>
                            <Select
                              value={food.unit || undefined}
                              onValueChange={(v) => updateFood(mi, fi, { unit: v })}
                              disabled={disabled}
                            >
                              <SelectTrigger aria-required>
                                <SelectValue placeholder="Medida caseira ou gramas" />
                              </SelectTrigger>
                              <SelectContent>
                                {units.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Preparo (opcional)</Label>
                          <Input
                            value={food.preparation ?? ''}
                            onChange={(e) => updateFood(mi, fi, { preparation: e.target.value })}
                            placeholder="Ex.: mexido"
                            disabled={disabled}
                            readOnly={disabled}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Marca (opcional)</Label>
                          <Input
                            value={food.brand ?? ''}
                            onChange={(e) => updateFood(mi, fi, { brand: e.target.value })}
                            placeholder="Ex.: marca"
                            disabled={disabled}
                            readOnly={disabled}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!disabled && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => addFood(mi)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar alimento
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!disabled && !focusMode && (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addMeal}>
          <Plus className="h-3.5 w-3.5" /> Adicionar refeição
        </Button>
      )}
    </div>
  );
}
