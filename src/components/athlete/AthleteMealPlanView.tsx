import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Utensils, Clock, Flame } from 'lucide-react';
import type { AthleteAnalysis, MealPlanMeal, MealOption } from '@/hooks/useAthleteAnalysis';

const GOLD = 'hsl(43,74%,49%)';

function mealEmoji(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('café') || n.includes('cafe') || n.includes('manhã') || n.includes('manha')) return '☕';
  if (n.includes('almo')) return '🍽️';
  if (n.includes('jantar') || n.includes('noite')) return '🌙';
  if (n.includes('ceia')) return '🥛';
  if (n.includes('pré') || n.includes('pre') || n.includes('pós') || n.includes('pos') || n.includes('treino')) return '💪';
  if (n.includes('lanche') || n.includes('tarde')) return '🍎';
  return '🍴';
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`rounded-2xl p-3 text-center border ${color}`}>
      <div className="text-xl font-extrabold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-70 mt-1">{label}</div>
      {sub && <div className="text-[11px] font-medium mt-0.5 opacity-90">{sub}</div>}
    </div>
  );
}

function FoodList({ target }: { target: MealPlanMeal | MealOption }) {
  const foods = (target as any).foods as any[] | undefined;
  const groups = (target as any).food_groups as { group: string; options: string }[] | undefined;

  if (foods && foods.length > 0) {
    return (
      <div className="space-y-2.5">
        {foods.map((f: any, i: number) => (
          <div key={f.temp_id || i} className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-white font-medium">{f.name}</span>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {f.quantity} {f.measure_name}
                </span>
              </div>
              {Array.isArray(f.substitutions) && f.substitutions.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  ou {f.substitutions.map((s: any) => `${s.name} (${s.quantity} ${s.measure_name})`).join(' ou ')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups && groups.length > 0) {
    return (
      <div className="space-y-2">
        {groups.map((g, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
            <p className="text-sm text-gray-200 flex-1">{g.options}</p>
          </div>
        ))}
      </div>
    );
  }

  return <p className="text-sm text-gray-500 italic">Sem itens cadastrados.</p>;
}

function MealCard({ meal, index }: { meal: MealPlanMeal; index: number }) {
  const hasOptions = Array.isArray(meal.options) && meal.options.length > 0;
  return (
    <Card className="bg-gray-900 border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800/40">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-lg bg-black/40 border border-gray-700 shrink-0">
          {mealEmoji(meal.meal_name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white leading-tight truncate">{meal.meal_name || `Refeição ${index + 1}`}</h3>
          {meal.timing_note && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
              <Clock className="h-3 w-3" /> {meal.timing_note}
            </span>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {hasOptions ? (
          <div className="space-y-3">
            {meal.options!.map((opt, oi) => (
              <div key={oi} className="rounded-xl border border-gray-800 bg-black/30 p-3">
                <Badge
                  variant="outline"
                  className="mb-2 text-[10px] font-bold border-[hsl(43,74%,49%)]/40 text-[hsl(43,74%,49%)]"
                >
                  {opt.label || `Opção ${oi + 1}`}
                </Badge>
                <FoodList target={opt} />
              </div>
            ))}
          </div>
        ) : (
          <FoodList target={meal} />
        )}

        {meal.meal_macros && (
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-400">
            <Flame className="h-3.5 w-3.5" />
            <span className="font-medium">{meal.meal_macros}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AthleteMealPlanView({ analysis, weightKg }: { analysis: AthleteAnalysis | null | undefined; weightKg?: number | null }) {
  const meals = analysis?.meal_plan?.meals || [];
  const totals = analysis?.meal_plan?.daily_totals;

  if (!analysis || meals.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="py-12 text-center">
          <Utensils className="h-12 w-12 mx-auto mb-4 text-gray-600" />
          <p className="text-gray-300 font-medium">Seu plano alimentar ainda não está disponível.</p>
          <p className="text-gray-500 text-sm mt-1">Assim que seu nutricionista finalizar, ele aparecerá aqui.</p>
        </CardContent>
      </Card>
    );
  }

  // Prefer the per-kg values already computed with the plan; fall back to weight.
  const perKg = (gkg?: number, g?: number) => {
    if (gkg) return `${gkg} g/kg`;
    if (g && weightKg) return `${(g / weightKg).toFixed(1)} g/kg`;
    return undefined;
  };

  return (
    <div className="space-y-4">
      {/* Daily totals hero */}
      {totals && (
        <Card className="bg-gradient-to-br from-gray-900 to-black border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4" style={{ color: GOLD }} />
              <h2 className="font-bold text-white">Meta do dia</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <StatCard
                label="Calorias"
                value={`${Math.round(totals.kcal || 0)}`}
                sub={totals.kcal_kg ? `${totals.kcal_kg} kcal/kg` : (weightKg && totals.kcal ? `${(totals.kcal / weightKg).toFixed(0)} kcal/kg` : 'kcal')}
                color="bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
              />
              <StatCard
                label="Carboidrato"
                value={`${Math.round(totals.cho_g || 0)}g`}
                sub={perKg(totals.cho_gkg, totals.cho_g)}
                color="bg-blue-500/10 text-blue-300 border-blue-500/30"
              />
              <StatCard
                label="Proteína"
                value={`${Math.round(totals.protein_g || 0)}g`}
                sub={perKg(totals.protein_gkg, totals.protein_g)}
                color="bg-purple-500/10 text-purple-300 border-purple-500/30"
              />
              <StatCard
                label="Gordura"
                value={`${Math.round(totals.fat_g || 0)}g`}
                sub={perKg(totals.fat_gkg, totals.fat_g)}
                color="bg-orange-500/10 text-orange-300 border-orange-500/30"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meals */}
      <div className="space-y-3">
        {meals.map((meal, i) => (
          <MealCard key={i} meal={meal} index={i} />
        ))}
      </div>

      <p className="text-center text-[11px] text-gray-600 pt-2">
        As substituições ("ou…") são equivalentes — escolha a que preferir. 💛
      </p>
    </div>
  );
}
