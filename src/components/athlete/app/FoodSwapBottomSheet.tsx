import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowLeftRight } from 'lucide-react';
import type { PlanFoodGroup, PlanFood } from '@/lib/athletePlan';

const GOLD = 'hsl(43,74%,49%)';

function FoodLine({ food, muted }: { food: PlanFood; muted?: boolean }) {
  const detail = [food.amount, food.measure && !food.amount?.includes(food.measure) ? food.measure : null, food.weight]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 ${muted ? 'bg-white/[0.03]' : 'bg-white/[0.06]'}`}>
      <span className="text-[15px] font-medium text-white">{food.name}</span>
      {detail && <span className="text-xs text-gray-400 whitespace-nowrap">{detail}</span>}
    </div>
  );
}

export function FoodSwapBottomSheet({
  food,
  onOpenChange,
}: {
  food: PlanFoodGroup | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!food} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-[#111214] border-gray-800 rounded-t-3xl px-5 pb-8 pt-3 max-h-[80vh] overflow-y-auto"
      >
        {/* grabber */}
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-700" />
        {food && (
          <>
            <SheetHeader className="text-left mb-4">
              <SheetTitle className="text-white flex items-center gap-2 text-lg">
                <ArrowLeftRight className="h-4 w-4" style={{ color: GOLD }} />
                Outras opções
              </SheetTitle>
              <p className="text-sm text-gray-400">
                Equivalentes a <span className="font-medium text-gray-200">{food.primary.name}</span> — escolha a que preferir.
              </p>
            </SheetHeader>

            <div className="space-y-2.5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Do plano</p>
                <FoodLine food={food.primary} />
              </div>
              {food.alternatives.length > 0 ? (
                <div className="pt-1">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1.5">Substituições</p>
                  <div className="space-y-2">
                    {food.alternatives.map((alt, i) => (
                      <FoodLine key={i} food={alt} muted />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-6">Sem substituições cadastradas para este item.</p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
