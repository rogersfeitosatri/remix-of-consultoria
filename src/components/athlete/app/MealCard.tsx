import { useState } from 'react';
import { Check, ChevronRight, ChevronDown } from 'lucide-react';
import { FoodSwapBottomSheet } from './FoodSwapBottomSheet';
import { mealEmoji, foodQuantityLine, type PlanMeal, type PlanFoodGroup } from '@/lib/athletePlan';

const GOLD = 'hsl(43,74%,49%)';

export function MealCard({
  meal,
  done,
  expanded,
  onToggleExpand,
  onToggleDone,
  readOnly,
}: {
  meal: PlanMeal;
  done: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  readOnly?: boolean;
}) {
  const [swapFood, setSwapFood] = useState<PlanFoodGroup | null>(null);
  const [obsOpen, setObsOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-[#131417] border border-white/[0.06] overflow-hidden">
      {/* Header (tap to expand/collapse) */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3.5 px-4 py-4 active:bg-white/[0.02] transition-colors"
      >
        <span className="text-2xl leading-none shrink-0">{mealEmoji(meal.name)}</span>
        <div className="flex-1 min-w-0 text-left">
          <h3 className="text-[17px] font-semibold text-white leading-tight truncate">{meal.name}</h3>
          {meal.time && <p className="text-sm text-gray-500 mt-0.5">{meal.time}</p>}
        </div>
        {done ? (
          <span className="inline-flex items-center gap-1 text-emerald-400 text-sm font-medium shrink-0">
            <Check className="h-4 w-4" /> Concluída
          </span>
        ) : (
          <span className="text-sm text-gray-500 shrink-0">Pendente</span>
        )}
        <ChevronDown className={`h-5 w-5 text-gray-600 shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Body */}
      <div className={`grid transition-all duration-300 ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          {/* Observation — collapsed by default */}
          {meal.observation && (
            <div className="px-4">
              <button
                type="button"
                onClick={() => setObsOpen((o) => !o)}
                className="w-full flex items-center gap-2 py-2.5 text-left border-t border-white/[0.06]"
              >
                <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>💡 Observação</span>
                <ChevronDown className={`h-4 w-4 text-gray-600 ml-auto transition-transform ${obsOpen ? 'rotate-180' : ''}`} />
              </button>
              {obsOpen && <p className="text-[15px] text-gray-300 leading-relaxed pb-3">{meal.observation}</p>}
            </div>
          )}

          {/* Foods — each row fully tappable → swap sheet */}
          <div className="px-2 pt-1 pb-2 divide-y divide-white/[0.05] border-t border-white/[0.06]">
            {meal.foods.length > 0 ? (
              meal.foods.map((f, i) => {
                const qty = foodQuantityLine(f.primary);
                const hasAlts = f.alternatives.length > 0;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSwapFood(f)}
                    className="w-full flex items-center gap-3 px-2 py-4 text-left active:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[17px] text-white font-medium leading-tight">{f.primary.name}</p>
                      {qty && <p className="text-sm text-gray-500 mt-1">{qty}</p>}
                    </div>
                    <ChevronRight className={`h-5 w-5 shrink-0 ${hasAlts ? 'text-gray-500' : 'text-gray-700'}`} />
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 px-2 py-4">Itens em breve.</p>
            )}
          </div>

          {/* Complete button */}
          {!readOnly && (
            <div className="px-4 pb-4 pt-1">
              <button
                type="button"
                onClick={onToggleDone}
                className={`w-full h-12 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  done ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-[hsl(43,74%,49%)] text-black'
                }`}
              >
                <Check className="h-5 w-5" />
                {done ? 'Concluída' : 'Concluir refeição'}
              </button>
            </div>
          )}
        </div>
      </div>

      <FoodSwapBottomSheet food={swapFood} onOpenChange={(o) => !o && setSwapFood(null)} />
    </div>
  );
}
