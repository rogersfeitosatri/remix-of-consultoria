import { Utensils } from 'lucide-react';
import { MealCard } from './MealCard';
import type { PlanMeal } from '@/lib/athletePlan';

export function MealPlanScreen({
  meals,
  completedMeals,
  onToggleMeal,
  readOnly,
}: {
  meals: PlanMeal[];
  completedMeals: string[];
  onToggleMeal: (key: string) => void;
  readOnly?: boolean;
}) {
  const done = meals.filter((m) => completedMeals.includes(m.key)).length;

  if (meals.length === 0) {
    return (
      <div className="rounded-3xl bg-[#131417] border border-gray-800 py-14 text-center">
        <Utensils className="h-12 w-12 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-300 font-medium">Seu plano alimentar ainda não está disponível.</p>
        <p className="text-gray-500 text-sm mt-1">Assim que seu nutricionista finalizar, ele aparece aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1a1b1f] to-black border border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white">Plano de hoje</h1>
            <p className="text-sm text-gray-400">{done} de {meals.length} refeições concluídas</p>
          </div>
          <div className="text-2xl font-extrabold" style={{ color: 'hsl(43,74%,49%)' }}>
            {meals.length ? Math.round((done / meals.length) * 100) : 0}%
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden mt-3">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${meals.length ? (done / meals.length) * 100 : 0}%`, background: 'hsl(43,74%,49%)' }} />
        </div>
      </div>

      {meals.map((m) => (
        <MealCard
          key={m.key}
          meal={m}
          done={completedMeals.includes(m.key)}
          onToggleDone={() => onToggleMeal(m.key)}
          readOnly={readOnly}
        />
      ))}

      <p className="text-center text-[11px] text-gray-600 pt-1 pb-2">
        As "Outras opções" são equivalentes — escolha a que preferir. 💛
      </p>
    </div>
  );
}
