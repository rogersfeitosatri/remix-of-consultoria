import { useState } from 'react';
import { ChevronDown, Target } from 'lucide-react';
import type { AthleteAnalysis } from '@/hooks/useAthleteAnalysis';

const GOLD = 'hsl(43,74%,49%)';
const CARD = 'rounded-2xl bg-[#131417] border border-white/[0.06]';

interface Category {
  emoji: string;
  title: string;
  bullets?: string[];
  cards?: { supplement: string; recommendation: string }[];
  text?: string;
}

function InstructionAccordion({ cat, defaultOpen }: { cat: Category; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={`${CARD} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3.5 px-4 py-4 active:bg-white/[0.02] transition-colors"
      >
        <span className="text-2xl leading-none">{cat.emoji}</span>
        <span className="flex-1 text-left text-[17px] font-semibold text-white">{cat.title}</span>
        <ChevronDown className={`h-5 w-5 text-gray-600 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-5 pt-1 space-y-3.5 border-t border-white/[0.06]">
            {cat.bullets?.map((b, i) => (
              <div key={i} className="flex items-start gap-3 pt-1">
                <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                <span className="text-[15px] text-gray-200 leading-relaxed flex-1">{b}</span>
              </div>
            ))}
            {cat.cards?.map((c, i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] p-3.5">
                <p className="font-semibold text-white">{c.supplement}</p>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">{c.recommendation}</p>
              </div>
            ))}
            {cat.text && <p className="text-[15px] text-gray-200 leading-relaxed whitespace-pre-wrap pt-1">{cat.text}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstructionsScreen({ analysis }: { analysis: AthleteAnalysis | null | undefined }) {
  const so = analysis?.strategic_orientations;
  const cats: Category[] = [];

  if (analysis?.athlete_summary) cats.push({ emoji: '💡', title: 'Resumo', text: analysis.athlete_summary });
  if (so?.meal_routine?.length) cats.push({ emoji: '🍽️', title: 'Alimentação', bullets: so.meal_routine });
  if (so?.supplementation?.length) cats.push({ emoji: '💊', title: 'Suplementação', cards: so.supplementation });
  if (so?.training_strategy?.length) cats.push({ emoji: '🏃', title: 'Treinos', bullets: so.training_strategy });
  if (so?.race_context) cats.push({ emoji: '🏁', title: 'Contexto de prova', text: so.race_context });

  if (cats.length === 0) {
    return (
      <div className={`${CARD} py-16 text-center`}>
        <Target className="h-12 w-12 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-300 font-medium">Suas orientações aparecerão aqui.</p>
        <p className="text-gray-500 text-sm mt-1">Geradas junto com o seu plano.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold text-white px-1 mb-1">Orientações</h1>
      {cats.map((c, i) => (
        <InstructionAccordion key={c.title} cat={c} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
