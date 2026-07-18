// Novo editor de plano — edição inline, desfazer/refazer, autosave e recálculo
// pelo serviço único (nutritionCalc). Escreve de volta a MESMA estrutura
// meal_plan.meals (options[] + foods espelhado), então "Visualizar" e o editor
// clássico permanecem compatíveis. IA por refeição/alimento vem no merge 2.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Undo2, Redo2, Plus, Trash2, Copy, ChevronUp, ChevronDown, Loader2, Check, Utensils, X } from 'lucide-react';
import { sumFoods, perKg, roundNutrients, summarizePlanBase, type Nutrients } from '@/lib/nutritionCalc';
import { AlertTriangle, Info } from 'lucide-react';
import { FoodAiDialog } from './FoodAiDialog';

type Food = { name: string; grams?: number | null; measure?: string | null; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; substitutions?: string[] };
type Option = { label?: string; foods: Food[] };
type Meal = { meal_name: string; horario?: string; timing_note?: string; options: Option[] };

const AUTOSAVE_MS = 1200;

// "Pão francês 50g" / "Arroz — 100 g" → { name, grams }
function parseFoodText(t: string): Food {
  const s = String(t || '').trim();
  const m = s.match(/^(.*?)[\s—-]*?(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (m) return { name: m[1].replace(/[—\-]+$/, '').trim(), grams: parseFloat(m[2].replace(',', '.')) };
  return { name: s };
}
// Fallback: monta opções/alimentos a partir de food_groups (texto legado).
function optionsFromGroups(groups: any[]): Option[] | null {
  if (!Array.isArray(groups) || !groups.length) return null;
  // v2: um único grupo com a refeição inteira em texto ("A + B ou C + D")
  if (groups.length === 1 && /\s\+\s/.test(String(groups[0]?.options || ''))) {
    const alts = String(groups[0].options).split(/\s+ou\s+/i);
    return alts.map((alt, i) => ({ label: `Opção ${i + 1}`, foods: alt.split(/\s*\+\s*/).map(parseFoodText).filter((f) => f.name) }));
  }
  // importado: cada grupo é um alimento (substituições após "ou")
  const foods = groups.map((g) => {
    const parts = String(g?.options || g?.group || '').split(/\s+ou\s+/i);
    const f = parseFoodText(parts[0] || '');
    if (parts.length > 1) f.substitutions = parts.slice(1).map((s) => s.trim()).filter(Boolean);
    return f;
  }).filter((f) => f.name);
  return foods.length ? [{ label: 'Opção 1', foods }] : null;
}

function normalizeMeals(mp: any): Meal[] {
  const meals: any[] = mp?.meals || [];
  return meals.map((m) => {
    const rawOptions = (Array.isArray(m.options) && m.options.length)
      ? m.options
      : (Array.isArray(m.foods) && m.foods.length)
        ? [{ label: 'Opção 1', foods: m.foods }]
        : (optionsFromGroups(m.food_groups) || [{ label: 'Opção 1', foods: [] }]);
    return {
      meal_name: m.meal_name || 'Refeição', horario: m.horario || '', timing_note: m.timing_note || '',
      options: rawOptions.map((o: any, i: number) => ({ label: o.label || `Opção ${i + 1}`, foods: (Array.isArray(o.foods) ? o.foods : []).map((f: any) => ({ ...f })) })),
    };
  });
}

function foodNutrients(f: Food): Nutrients {
  return { calories: +f.calories! || 0, protein_g: +f.protein_g! || 0, carbs_g: +f.carbs_g! || 0, fat_g: +f.fat_g! || 0 };
}

// Reescala macros proporcionalmente ao mudar os gramas (per-100g derivado do estado atual).
function rescale(f: Food, newGrams: number): Food {
  const g = Number(f.grams) || 0;
  if (g > 0 && newGrams >= 0) {
    const k = newGrams / g;
    return { ...f, grams: newGrams, calories: (+f.calories! || 0) * k, protein_g: (+f.protein_g! || 0) * k, carbs_g: (+f.carbs_g! || 0) * k, fat_g: (+f.fat_g! || 0) * k };
  }
  return { ...f, grams: newGrams };
}

function macroStr(t: Nutrients): string {
  return `~${Math.round(t.calories)} kcal, CHO ${Math.round(t.carbs_g)}g, PTN ${Math.round(t.protein_g)}g, LIP ${Math.round(t.fat_g)}g`;
}

// Reconstrói meal_plan.meals no formato compatível (options[] + foods espelhado + meal_macros).
function toMealPlan(meals: Meal[], base: any): any {
  const out = meals.map((m) => {
    const options = m.options.map((o) => ({ label: o.label, foods: o.foods, meal_macros: macroStr(sumFoods(o.foods.map(foodNutrients))) }));
    return {
      meal_name: m.meal_name, horario: m.horario, timing_note: m.timing_note,
      options, foods: options[0]?.foods ?? [], meal_macros: options[0]?.meal_macros ?? '',
    };
  });
  const primary = out.reduce((acc, m) => sumFoods([acc, sumFoods((m.foods as Food[]).map(foodNutrients))]), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } as Nutrients);
  const r = roundNutrients(primary, 0);
  return { ...(base || {}), meals: out, daily_totals: { ...(base?.daily_totals || {}), kcal: r.calories, cho_g: r.carbs_g, protein_g: r.protein_g, fat_g: r.fat_g } };
}

export function PlanInlineEditor({ analysis, athleteWeightKg, onSave, savedAt }: {
  analysis: any; athleteWeightKg?: number | null; onSave: (mealPlan: any) => Promise<void>; savedAt?: string | null;
}) {
  const targetKcal = Number(analysis?.meal_plan?.daily_totals?.kcal) || null;
  const initial = useMemo(() => normalizeMeals(analysis?.meal_plan), [analysis?.meal_plan]);
  const [hist, setHist] = useState<Meal[][]>([initial]);
  const [idx, setIdx] = useState(0);
  const meals = hist[idx];
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(savedAt || null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  // aplica uma mutação criando novo ponto no histórico (para desfazer/refazer)
  const apply = useCallback((next: Meal[]) => {
    setHist((h) => [...h.slice(0, idx + 1), next]);
    setIdx((i) => i + 1);
  }, [idx]);

  const undo = () => setIdx((i) => Math.max(0, i - 1));
  const redo = () => setIdx((i) => Math.min(hist.length - 1, i + 1));

  // autosave (debounced) quando o conteúdo muda
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      try { await onSave(toMealPlan(meals, analysis?.meal_plan)); setLastSaved(new Date().toISOString()); }
      finally { setSaving(false); }
    }, AUTOSAVE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // mutadores
  const mutMeal = (mi: number, patch: Partial<Meal>) => apply(meals.map((m, i) => i === mi ? { ...m, ...patch } : m));
  const mutFood = (mi: number, oi: number, fi: number, food: Food) =>
    apply(meals.map((m, i) => i !== mi ? m : { ...m, options: m.options.map((o, j) => j !== oi ? o : { ...o, foods: o.foods.map((f, k) => k === fi ? food : f) }) }));
  const addFood = (mi: number, oi: number) => apply(meals.map((m, i) => i !== mi ? m : { ...m, options: m.options.map((o, j) => j !== oi ? o : { ...o, foods: [...o.foods, { name: '', grams: 0 }] }) }));
  const delFood = (mi: number, oi: number, fi: number) => apply(meals.map((m, i) => i !== mi ? m : { ...m, options: m.options.map((o, j) => j !== oi ? o : { ...o, foods: o.foods.filter((_, k) => k !== fi) }) }));
  const addOption = (mi: number) => apply(meals.map((m, i) => i !== mi ? m : { ...m, options: [...m.options, { label: `Opção ${m.options.length + 1}`, foods: [] }] }));
  const dupOption = (mi: number, oi: number) => apply(meals.map((m, i) => i !== mi ? m : { ...m, options: [...m.options.slice(0, oi + 1), { ...m.options[oi], label: `Opção ${m.options.length + 1}`, foods: m.options[oi].foods.map((f) => ({ ...f })) }, ...m.options.slice(oi + 1)] }));
  const delOption = (mi: number, oi: number) => apply(meals.map((m, i) => i !== mi ? m : { ...m, options: m.options.length > 1 ? m.options.filter((_, j) => j !== oi) : m.options }));
  const addMeal = () => apply([...meals, { meal_name: 'Nova refeição', horario: '', options: [{ label: 'Opção 1', foods: [] }] }]);
  const dupMeal = (mi: number) => apply([...meals.slice(0, mi + 1), JSON.parse(JSON.stringify(meals[mi])), ...meals.slice(mi + 1)]);
  const delMeal = (mi: number) => { if (confirm('Remover esta refeição?')) apply(meals.filter((_, i) => i !== mi)); };
  const moveMeal = (mi: number, dir: -1 | 1) => {
    const j = mi + dir; if (j < 0 || j >= meals.length) return;
    const copy = [...meals]; [copy[mi], copy[j]] = [copy[j], copy[mi]]; apply(copy);
  };

  const dayTotals = useMemo(() => roundNutrients(meals.reduce((acc, m) => sumFoods([acc, sumFoods((m.options[0]?.foods || []).map(foodNutrients))]), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } as Nutrients), 0), [meals]);
  const pk = perKg(dayTotals, athleteWeightKg);

  // Auditoria ao vivo (equivalência entre opções + fechamento do dia vs. meta)
  const audit = useMemo(() => summarizePlanBase({
    meals: meals.map((m) => ({ name: m.meal_name, optionTotals: m.options.map((o) => sumFoods(o.foods.map(foodNutrients))) })),
    weightKg: athleteWeightKg, mode: 'weekly', targetKcal,
  }), [meals, athleteWeightKg, targetKcal]);

  return (
    <div className="space-y-3">
      {/* Barra: desfazer/refazer + status de salvamento */}
      <div className="flex items-center gap-2 text-xs">
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={undo} disabled={idx === 0}><Undo2 className="h-3.5 w-3.5" /> Desfazer</Button>
        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={redo} disabled={idx >= hist.length - 1}><Redo2 className="h-3.5 w-3.5" /> Refazer</Button>
        <span className="ml-auto text-muted-foreground inline-flex items-center gap-1">
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> salvando…</> : lastSaved ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> salvo {new Date(lastSaved).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</> : 'não salvo'}
        </span>
      </div>

      {meals.map((m, mi) => (
        <Card key={mi}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-primary shrink-0" />
              <Input value={m.meal_name} onChange={(e) => mutMeal(mi, { meal_name: e.target.value })} className="h-8 font-medium" />
              <Input type="time" value={m.horario} onChange={(e) => mutMeal(mi, { horario: e.target.value })} className="h-8 w-28" />
              <div className="flex gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveMeal(mi, -1)} disabled={mi === 0}><ChevronUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveMeal(mi, 1)} disabled={mi === meals.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dupMeal(mi)}><Copy className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => delMeal(mi)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {m.options.map((o, oi) => {
              const t = sumFoods(o.foods.map(foodNutrients));
              return (
                <div key={oi} className="rounded-lg border p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{o.label || `Opção ${oi + 1}`}</span>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => dupOption(mi, oi)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => delOption(mi, oi)} disabled={m.options.length <= 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  {o.foods.map((f, fi) => (
                    <div key={fi} className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Input value={f.name} placeholder="Alimento" onChange={(e) => mutFood(mi, oi, fi, { ...f, name: e.target.value })} className="h-8 flex-1" />
                        <Input type="number" value={f.grams ?? ''} placeholder="g" onChange={(e) => mutFood(mi, oi, fi, rescale(f, e.target.value === '' ? 0 : Number(e.target.value)))} className="h-8 w-20" />
                        <Input value={f.measure ?? ''} placeholder="medida" onChange={(e) => mutFood(mi, oi, fi, { ...f, measure: e.target.value })} className="h-8 w-28" />
                        <FoodAiDialog food={f} onApply={(nf) => mutFood(mi, oi, fi, nf)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => delFood(mi, oi, fi)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      {/* substituições (chips) */}
                      <div className="flex flex-wrap items-center gap-1 pl-1">
                        {(f.substitutions || []).map((s, si) => (
                          <Badge key={si} variant="secondary" className="gap-1 text-[10px]">
                            {s}
                            <button onClick={() => mutFood(mi, oi, fi, { ...f, substitutions: (f.substitutions || []).filter((_, k) => k !== si) })}><X className="h-2.5 w-2.5" /></button>
                          </Badge>
                        ))}
                        <input
                          placeholder="+ substituição (Enter)"
                          className="text-[11px] bg-transparent outline-none border-b border-dashed border-muted-foreground/30 w-40"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                              const v = (e.target as HTMLInputElement).value.trim();
                              mutFood(mi, oi, fi, { ...f, substitutions: [...(f.substitutions || []), v] });
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => addFood(mi, oi)}><Plus className="h-3 w-3" /> Alimento</Button>
                    <span className="text-[11px] text-muted-foreground">{Math.round(t.calories)} kcal · CHO {Math.round(t.carbs_g)}g · PTN {Math.round(t.protein_g)}g · LIP {Math.round(t.fat_g)}g</span>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => addOption(mi)}><Plus className="h-3 w-3" /> Opção</Button>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" className="w-full gap-2" onClick={addMeal}><Plus className="h-4 w-4" /> Adicionar refeição</Button>

      {/* Auditoria ao vivo (recalcula a cada edição) */}
      {audit.findings.length > 0 && (
        <Card className={audit.hasBlock ? 'border-red-500/40' : 'border-amber-500/40'}>
          <CardContent className="py-2.5 space-y-1">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              {audit.hasBlock ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> : <Info className="h-3.5 w-3.5 text-amber-600" />}
              Auditoria ({audit.findings.length})
            </p>
            {audit.findings.map((f, i) => (
              <p key={i} className={`text-xs ${f.level === 'block' ? 'text-red-600' : f.level === 'warn' ? 'text-amber-600' : 'text-sky-600'}`}>• {f.message}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Totais do plano (Opção 1 de cada refeição) */}
      <Card className="border-primary/30">
        <CardContent className="py-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
          <span><strong>{Math.round(dayTotals.calories)}</strong> kcal</span>
          <span>CHO <strong>{Math.round(dayTotals.carbs_g)}g</strong>{pk ? ` · ${pk.cho_gkg} g/kg` : ''}</span>
          <span>PTN <strong>{Math.round(dayTotals.protein_g)}g</strong>{pk ? ` · ${pk.protein_gkg} g/kg` : ''}</span>
          <span>LIP <strong>{Math.round(dayTotals.fat_g)}g</strong>{pk ? ` · ${pk.fat_gkg} g/kg` : ''}</span>
          {pk && <span>{pk.kcal_kg} kcal/kg</span>}
        </CardContent>
      </Card>
    </div>
  );
}
