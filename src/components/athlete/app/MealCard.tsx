import { useState } from 'react';
import { Check, ChevronRight, Clock, Lightbulb, Flame } from 'lucide-react';
import { FoodSwapBottomSheet } from './FoodSwapBottomSheet';
import { mealEmoji, type PlanMeal, type PlanFoodGroup } from '@/lib/athletePlan';

const GOLD = 'hsl(43,74%,49%)';

function FoodItem({ food, onSwap }: { food: PlanFoodGroup; onSwap: () => void }) {
  const detail = [food.primary.amount, food.primary.weight].filter(Boolean).join(' · ');
  const hasAlts = food.alternatives.length > 0;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-[15px] text-white font-medium leading-tight">{food.primary.name}</p>
        {detail && <p className="text-xs text-gray-400 mt-0.5">{detail}</p>}
      </div>
      {hasAlts && (
        <button
          type="button"
          onClick={onSwap}
          className="shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[hsl(43,74%,49%)] bg-[hsl(43,74%,49%)]/10 active:scale-95 transition-transform"
        >
          Outras opções
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function MealCard({
  meal,
  done,
  onToggleDone,
  readOnly,
}: {
  meal: PlanMeal;
  done: boolean;
  onToggleDone: () => void;
  readOnly?: boolean;
}) {
  const [swapFood, setSwapFood] = useState<PlanFoodGroup | null>(null);
  const [justDone, setJustDone] = useState(false);

  const handleToggle = () => {
    if (readOnly) return;
    if (!done) {
      setJustDone(true);
      setTimeout(() => setJustDone(false), 700);
    }
    onToggleDone();
  };

  return (
    <div
      className={`rounded-3xl border overflow-hidden transition-all duration-300 ${
        done ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-gray-800 bg-[#131417]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <div className="h-11 w-11 rounded-2xl flex items-center justify-center text-xl bg-black/40 border border-gray-800 shrink-0">
          {mealEmoji(meal.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white leading-tight uppercase text-sm tracking-wide truncate">{meal.name}</h3>
          {meal.time && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <Clock className="h-3 w-3" /> {meal.time}
            </span>
          )}
        </div>
        {done && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold px-2.5 py-1">
            <Check className="h-3 w-3" /> Concluída
          </span>
        )}
      </div>

      {/* Observation */}
      {meal.observation && (
        <div className="mx-4 mt-3 rounded-2xl bg-[hsl(43,74%,49%)]/[0.07] border border-[hsl(43,74%,49%)]/20 px-3.5 py-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Lightbulb className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>Observação</span>
          </div>
          <p className="text-sm text-gray-200 leading-snug">{meal.observation}</p>
        </div>
      )}

      {/* Foods */}
      <div className="px-4 mt-2 divide-y divide-gray-800/60">
        {meal.foods.length > 0 ? (
          meal.foods.map((f, i) => <FoodItem key={i} food={f} onSwap={() => setSwapFood(f)} />)
        ) : (
          <p className="text-sm text-gray-500 py-3">Itens em breve.</p>
        )}
      </div>

      {/* Macros */}
      {meal.macros && (
        <div className="px-4 pt-1 flex items-center gap-1.5 text-[11px] text-emerald-400/90">
          <Flame className="h-3.5 w-3.5" />
          <span>{meal.macros}</span>
        </div>
      )}

      {/* Complete button */}
      {!readOnly && (
        <div className="p-4 pt-3">
          <button
            type="button"
            onClick={handleToggle}
            className={`w-full h-12 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              done
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-[hsl(43,74%,49%)] text-black'
            } ${justDone ? 'scale-[1.02]' : ''}`}
          >
            <Check className={`h-5 w-5 transition-transform duration-500 ${justDone ? 'scale-125' : ''}`} />
            {done ? 'Concluída' : 'Concluir refeição'}
          </button>
        </div>
      )}

      <FoodSwapBottomSheet food={swapFood} onOpenChange={(o) => !o && setSwapFood(null)} />
    </div>
  );
}
