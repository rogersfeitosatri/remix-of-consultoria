// Editor SIMPLES de rotina alimentar (anamnese completa).
// answer = SimpleMeal[] — cada refeição com horário e uma ou duas opções.
// Cada opção tem uma lista de alimentos (nome + quantidade + unidade + substituições).
//
// Modo "foco": quando config.focusMealIndex está definido, exibe apenas 1 refeição
// (usado pelo wizard). Sem focusMealIndex, renderiza todas as refeições em pilha.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Utensils } from 'lucide-react';
import { ChipsInput } from './PrimitiveInputs';
import type { FieldProps } from './types';

export type SimpleFood = {
  food_name: string;
  quantity: string;
  unit: string;
  substitutions?: string[];
};

export type SimpleOption = {
  foods: SimpleFood[];
};

export type SimpleMeal = {
  meal_name: string;
  time: string;
  options: SimpleOption[];
  skipped?: boolean;
  enabled?: boolean;
};

const DEFAULT_UNITS = [
  'Gramas', 'Colher', 'Colher de sopa', 'Colher de chá',
  'Concha', 'Unidade', 'Fatia', 'Copo', 'Xícara', 'ml',
];

const emptyFood = (): SimpleFood => ({ food_name: '', quantity: '', unit: '', substitutions: [] });
const emptyOption = (): SimpleOption => ({ foods: [emptyFood()] });
const mealFromName = (name: string): SimpleMeal => ({
  meal_name: name,
  time: '',
  options: [emptyOption()],
});

// Migra formato antigo (Meal { foods: [...] }) para o novo (options[0].foods).
function coerceMeal(raw: any, fallbackName: string): SimpleMeal {
  if (!raw || typeof raw !== 'object') return mealFromName(fallbackName);
  const options: SimpleOption[] = Array.isArray(raw.options) && raw.options.length
    ? raw.options.map((op: any) => ({
        foods: Array.isArray(op?.foods) && op.foods.length
          ? op.foods.map((f: any) => ({
              food_name: String(f?.food_name ?? ''),
              quantity: String(f?.quantity ?? ''),
              unit: String(f?.unit ?? ''),
              substitutions: Array.isArray(f?.substitutions) ? f.substitutions.filter(Boolean) : [],
            }))
          : [emptyFood()],
      }))
    : [{
        foods: Array.isArray(raw.foods) && raw.foods.length
          ? raw.foods.map((f: any) => ({
              food_name: String(f?.food_name ?? ''),
              quantity: String(f?.quantity ?? ''),
              unit: String(f?.unit ?? ''),
              substitutions: Array.isArray(f?.substitutions) ? f.substitutions.filter(Boolean) : [],
            }))
          : [emptyFood()],
      }];
  return {
    meal_name: raw.meal_name || fallbackName,
    time: raw.time || '',
    options,
    skipped: raw.skipped === true,
    enabled: raw.enabled === false ? false : true,
  };
}

export function SimpleMealField({ value, onChange, config, disabled }: FieldProps) {
  const defaultMeals: string[] = Array.isArray(config?.defaultMeals) && config!.defaultMeals.length
    ? config!.defaultMeals
    : ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];
  const units: string[] = Array.isArray(config?.units) && config!.units.length
    ? config!.units
    : DEFAULT_UNITS;
  const focusMealIndex: number | undefined =
    typeof config?.focusMealIndex === 'number' ? config!.focusMealIndex : undefined;

  // Garante o array com uma refeição por defaultMeal, mesclando com o value.
  const source: any[] = Array.isArray(value) ? value : [];
  const meals: SimpleMeal[] = defaultMeals.map((name, i) => coerceMeal(source[i], name));

  const commit = (next: SimpleMeal[]) => onChange(next);

  const updateMeal = (i: number, patch: Partial<SimpleMeal>) =>
    commit(meals.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const updateOption = (mi: number, oi: number, patch: Partial<SimpleOption>) => {
    const opts = meals[mi].options.map((o, j) => (j === oi ? { ...o, ...patch } : o));
    updateMeal(mi, { options: opts });
  };

  const updateFood = (mi: number, oi: number, fi: number, patch: Partial<SimpleFood>) => {
    const foods = meals[mi].options[oi].foods.map((f, j) => (j === fi ? { ...f, ...patch } : f));
    updateOption(mi, oi, { foods });
  };

  const addFood = (mi: number, oi: number) => {
    const foods = [...meals[mi].options[oi].foods, emptyFood()];
    updateOption(mi, oi, { foods });
  };
  const delFood = (mi: number, oi: number, fi: number) => {
    const foods = meals[mi].options[oi].foods.filter((_, j) => j !== fi);
    updateOption(mi, oi, { foods: foods.length ? foods : [emptyFood()] });
  };

  const addOption = (mi: number) => {
    if (meals[mi].options.length >= 2) return;
    updateMeal(mi, { options: [...meals[mi].options, emptyOption()] });
  };
  const delOption = (mi: number, oi: number) => {
    if (meals[mi].options.length <= 1) return;
    updateMeal(mi, { options: meals[mi].options.filter((_, j) => j !== oi) });
  };

  const shown = focusMealIndex !== undefined
    ? meals.map((m, i) => ({ m, i })).filter(({ i }) => i === focusMealIndex)
    : meals.map((m, i) => ({ m, i }));

  const toggleSkip = (mi: number) => {
    const current = meals[mi];
    if (current.skipped) {
      updateMeal(mi, { skipped: false, enabled: true });
    } else {
      updateMeal(mi, {
        skipped: true,
        enabled: false,
        time: '',
        options: [emptyOption()],
      });
    }
  };

  return (
    <div className="space-y-4">
      {shown.map(({ m: meal, i: mi }) => (
        <div key={mi} className="rounded-lg border p-3 space-y-4">
          {/* Cabeçalho da refeição */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-primary" />
              <h4 className="text-base font-semibold">{meal.meal_name}</h4>
            </div>
            {!disabled && (
              <Button
                type="button"
                variant={meal.skipped ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleSkip(mi)}
              >
                {meal.skipped ? 'Faço essa refeição' : 'Não faço essa refeição'}
              </Button>
            )}
          </div>

          {meal.skipped ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Você marcou que <strong>não faz</strong> essa refeição. Clique em "Faço essa refeição" para preencher.
            </div>
          ) : (
            <>
              {/* Horário */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">
                    Horário<span className="text-destructive"> *</span>
                  </Label>
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

              {/* Opções */}
              {meal.options.map((option, oi) => (
                <div key={oi} className="rounded-md border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={oi === 0 ? 'default' : 'secondary'}>
                        {oi === 0 ? 'Opção principal' : 'Opção alternativa'}
                      </Badge>
                      {oi > 0 && (
                        <span className="text-xs text-muted-foreground">
                          (para dias em que você come diferente)
                        </span>
                      )}
                    </div>
                    {!disabled && oi > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => delOption(mi, oi)}
                        aria-label="Remover opção alternativa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <Label className="text-xs text-muted-foreground">O que costuma comer</Label>

                  {option.foods.map((food, fi) => (
                    <div key={fi} className="rounded-md border bg-background p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Alimento {fi + 1}</span>
                        {!disabled && option.foods.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => delFood(mi, oi, fi)}
                            aria-label="Remover alimento"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-6">
                        <div className="space-y-1 sm:col-span-3">
                          <Label className="text-xs">
                            Alimento<span className="text-destructive"> *</span>
                          </Label>
                          <Input
                            value={food.food_name}
                            onChange={(e) => updateFood(mi, oi, fi, { food_name: e.target.value })}
                            placeholder="Ex.: Arroz"
                            disabled={disabled}
                            readOnly={disabled}
                            aria-required
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-1">
                          <Label className="text-xs">
                            Quantidade<span className="text-destructive"> *</span>
                          </Label>
                          <Input
                            value={food.quantity}
                            onChange={(e) => updateFood(mi, oi, fi, { quantity: e.target.value })}
                            placeholder="4"
                            disabled={disabled}
                            readOnly={disabled}
                            aria-required
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">
                            Unidade<span className="text-destructive"> *</span>
                          </Label>
                          <Select
                            value={food.unit || undefined}
                            onValueChange={(v) => updateFood(mi, oi, fi, { unit: v })}
                            disabled={disabled}
                          >
                            <SelectTrigger aria-required>
                              <SelectValue placeholder="Medida" />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Substituições habituais (opcional)
                        </Label>
                        <ChipsInput
                          value={food.substitutions || []}
                          onChange={(v) => updateFood(mi, oi, fi, { substitutions: v })}
                          disabled={disabled}
                          placeholder="Ex.: Macarrão, Batata, Cuscuz"
                        />
                      </div>
                    </div>
                  ))}

                  {!disabled && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => addFood(mi, oi)}
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar alimento
                    </Button>
                  )}
                </div>
              ))}

              {!disabled && meal.options.length < 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => addOption(mi)}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar outra opção
                </Button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Valida uma refeição do formato simple. Retorna null se OK ou string com o erro.
export function validateSimpleMeal(meal: any, mealName: string): string | null {
  if (!meal || typeof meal !== 'object') return `Preencha a refeição "${mealName}"`;
  if (!meal.time || !String(meal.time).trim()) return `Informe o horário de "${mealName}"`;
  const options = Array.isArray(meal.options) ? meal.options : [];
  if (!options.length) return `Adicione pelo menos um alimento em "${mealName}"`;
  for (let oi = 0; oi < options.length; oi++) {
    const foods = Array.isArray(options[oi]?.foods) ? options[oi].foods : [];
    if (!foods.length) return `Adicione pelo menos um alimento em "${mealName}"`;
    for (let fi = 0; fi < foods.length; fi++) {
      const f = foods[fi] || {};
      if (!f.food_name || !String(f.food_name).trim())
        return `Informe o alimento em "${mealName}" (opção ${oi + 1})`;
      if (!String(f.quantity ?? '').trim())
        return `Informe a quantidade de "${f.food_name || 'alimento'}" em "${mealName}"`;
      if (!f.unit || !String(f.unit).trim())
        return `Informe a unidade de medida de "${f.food_name || 'alimento'}" em "${mealName}"`;
    }
  }
  return null;
}
