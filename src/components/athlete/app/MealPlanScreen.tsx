import { useState } from 'react';
import { Utensils } from 'lucide-react';
import { MealCard } from './MealCard';
import { DAY_LABELS, todayDayKey } from '@/lib/athletePlan';
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
  // Apenas uma refeição expandida por vez (primeira aberta por padrão).
  const [openKey, setOpenKey] = useState<string | null>(meals[0]?.key ?? null);
  const done = meals.filter((m) => completedMeals.includes(m.key)).length;

  if (meals.length === 0) {
    return (
      <div className="rounded-2xl bg-[#131417] border border-white/[0.06] py-16 text-center">
        <Utensils className="h-12 w-12 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-300 font-medium">Seu plano alimentar ainda não está disponível.</p>
        <p className="text-gray-500 text-sm mt-1">Assim que seu nutricionista finalizar, ele aparece aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Slim progress header */}
      <div className="flex items-baseline justify-between px-1 pb-1">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Plano de hoje</h1>
          <p className="text-xs text-gray-500 mt-0.5">{DAY_LABELS[todayDayKey()]}</p>
        </div>
        <span className="text-sm text-gray-500">{done}/{meals.length} concluídas</span>
      </div>


      {meals.map((m) => (
        <MealCard
          key={m.key}
          meal={m}
          done={completedMeals.includes(m.key)}
          expanded={openKey === m.key}
          onToggleExpand={() => setOpenKey((k) => (k === m.key ? null : m.key))}
          onToggleDone={() => onToggleMeal(m.key)}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
