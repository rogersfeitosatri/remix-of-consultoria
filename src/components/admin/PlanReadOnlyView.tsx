// Modo "Visualizar plano" (read-only): mostra o plano completo na ordem, com
// kcal/CHO/PTN/GORD por refeição e totais + g/kg por plano-base. Usa o serviço
// ÚNICO de cálculo (nutritionCalc). Não soma Opção 1 + Opção 2 como se fossem
// consumidas juntas — calcula cada caminho e audita a equivalência.
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, Utensils } from 'lucide-react';
import {
  sumFoods, summarizePlanBase, type Nutrients, type AuditFinding,
} from '@/lib/nutritionCalc';

// Parser order-agnostic do meal_macros textual (fallback quando não há foods[]).
function parseMacros(s: string | undefined | null): Nutrients | null {
  if (!s) return null;
  const num = (label: string): number => {
    const before = s.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*g?\\s*(?:${label})`, 'i'));
    const after = s.match(new RegExp(`(?:${label})\\s*[:=-]?\\s*(\\d+(?:[.,]\\d+)?)`, 'i'));
    const m = before || after;
    return m ? parseFloat(m[1].replace(',', '.')) : 0;
  };
  const kcal = s.match(/(\d+(?:[.,]\d+)?)\s*kcal/i);
  const calories = kcal ? parseFloat(kcal[1].replace(',', '.')) : 0;
  const carbs_g = num('CHO'), protein_g = num('PTN|PROT'), fat_g = num('LIP|GORD|FAT');
  if (!calories && !carbs_g && !protein_g && !fat_g) return null;
  return { calories, protein_g, carbs_g, fat_g };
}

function foodToNutrients(f: any): Nutrients {
  return {
    calories: Number(f.calories) || 0, protein_g: Number(f.protein_g) || 0,
    carbs_g: Number(f.carbs_g) || 0, fat_g: Number(f.fat_g) || 0, fiber_g: Number(f.fiber_g) || 0,
  };
}

// Opções de uma refeição → lista de totais (um por opção). Prefere foods[]
// estruturados; cai no meal_macros textual quando não houver.
function mealOptionTotals(meal: any): { totals: Nutrients; label: string; foodsText: string[] }[] {
  const opts: any[] = Array.isArray(meal.options) && meal.options.length ? meal.options : [meal];
  return opts.map((o, i) => {
    const foods: any[] = Array.isArray(o.foods) ? o.foods : [];
    const totals = foods.length ? sumFoods(foods.map(foodToNutrients)) : (parseMacros(o.meal_macros || meal.meal_macros) || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    const foodsText = foods.length
      ? foods.map((f) => `${f.name}${f.grams ? ` — ${Math.round(Number(f.grams))} g` : f.measure ? ` — ${f.measure}` : ''}`)
      : (Array.isArray(o.food_groups) ? o.food_groups.map((g: any) => g.options).filter(Boolean) : []);
    return { totals, label: o.label || (opts.length > 1 ? `Opção ${i + 1}` : 'Opção 1'), foodsText };
  });
}

function MacroLine({ t }: { t: Nutrients }) {
  return (
    <span className="text-xs text-muted-foreground">
      {Math.round(t.calories)} kcal · CHO {Math.round(t.carbs_g)} g · PTN {Math.round(t.protein_g)} g · GORD {Math.round(t.fat_g)} g
    </span>
  );
}

const FINDING_ICON: Record<string, JSX.Element> = {
  block: <AlertTriangle className="h-3.5 w-3.5 text-red-600" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
  info: <Info className="h-3.5 w-3.5 text-sky-600" />,
};

export function PlanReadOnlyView({ analysis, athleteWeightKg, weightSource }: {
  analysis: any; athleteWeightKg?: number | null; weightSource?: string | null;
}) {
  const meals: any[] = analysis?.meal_plan?.meals || [];
  const dailyTargets = analysis?.meal_plan?.daily_totals || {};

  const perMeal = useMemo(() => meals.map((m) => ({ meal: m, options: mealOptionTotals(m) })), [meals]);

  const summary = useMemo(() => summarizePlanBase({
    meals: perMeal.map((pm) => ({ name: pm.meal.meal_name || 'Refeição', optionTotals: pm.options.map((o) => o.totals) })),
    weightKg: athleteWeightKg,
    mode: 'weekly',
    targetKcal: Number(dailyTargets.kcal) || null,
  }), [perMeal, athleteWeightKg, dailyTargets.kcal]);

  if (!meals.length) return <p className="text-sm text-muted-foreground">Nenhuma refeição para visualizar.</p>;

  return (
    <div className="space-y-3">
      {/* Refeições na ordem */}
      {perMeal.map((pm, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Utensils className="h-4 w-4 text-primary" /> {pm.meal.meal_name || `Refeição ${idx + 1}`}
              {pm.meal.horario && <span className="text-xs font-normal text-muted-foreground">· {pm.meal.horario}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {pm.options.map((opt, oi) => (
              <div key={oi} className={pm.options.length > 1 ? 'rounded-lg border p-2.5' : ''}>
                {pm.options.length > 1 && <p className="text-xs font-semibold mb-1">{opt.label}</p>}
                <ul className="space-y-0.5">
                  {opt.foodsText.map((t, i) => <li key={i} className="text-sm">• {t}</li>)}
                  {opt.foodsText.length === 0 && <li className="text-sm text-muted-foreground italic">—</li>}
                </ul>
                <div className="mt-1"><MacroLine t={opt.totals} /></div>
              </div>
            ))}
            {pm.meal.timing_note && <p className="text-xs text-amber-600">{pm.meal.timing_note}</p>}
          </CardContent>
        </Card>
      ))}

      {/* Resumo do plano-base: totais + g/kg */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo do plano-base</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-2 text-sm">
          <div className="grid gap-1 sm:grid-cols-2">
            <span><strong>{Math.round(summary.totals.calories)}</strong> kcal</span>
            <span>Peso usado: <strong>{athleteWeightKg ? `${athleteWeightKg} kg` : '—'}</strong>{weightSource ? ` (${weightSource})` : ''}</span>
            <span>CHO <strong>{Math.round(summary.totals.carbs_g)} g</strong>{summary.perKg ? ` · ${summary.perKg.cho_gkg} g/kg` : ''}</span>
            <span>PTN <strong>{Math.round(summary.totals.protein_g)} g</strong>{summary.perKg ? ` · ${summary.perKg.protein_gkg} g/kg` : ''}</span>
            <span>GORD <strong>{Math.round(summary.totals.fat_g)} g</strong>{summary.perKg ? ` · ${summary.perKg.fat_gkg} g/kg` : ''}</span>
            {summary.perKg && <span>Energia: <strong>{summary.perKg.kcal_kg} kcal/kg</strong></span>}
          </div>
          {(summary.bounds.min.calories !== summary.bounds.max.calories) && (
            <p className="text-xs text-muted-foreground">Caminhos executáveis do dia: {Math.round(summary.bounds.min.calories)}–{Math.round(summary.bounds.max.calories)} kcal (uma opção por refeição — nunca somando opções).</p>
          )}
          {summary.findings.length > 0 && (
            <div className="space-y-1 pt-1">
              {summary.findings.map((f: AuditFinding, i: number) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  {FINDING_ICON[f.level]}<span className={f.level === 'block' ? 'text-red-600' : f.level === 'warn' ? 'text-amber-600' : 'text-sky-600'}>{f.message}</span>
                </div>
              ))}
            </div>
          )}
          {!athleteWeightKg && <p className="text-xs text-amber-600">Sem peso registrado — g/kg e kcal/kg indisponíveis.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
