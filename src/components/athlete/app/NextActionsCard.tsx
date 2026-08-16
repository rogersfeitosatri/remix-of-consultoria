/**
 * ETAPA 5C — "Próxima ação" do atleta (consumidor puro).
 */
import { ArrowRight, AlertTriangle } from 'lucide-react';
import type { AthleteAction } from '@/hooks/useAthleteArea';

const GOLD = 'hsl(43,74%,49%)';

export function NextActionsCard({
  actions,
  onAction,
}: {
  actions: AthleteAction[];
  onAction: (a: AthleteAction) => void;
}) {
  if (actions.length === 0) return null;
  const list = actions.slice(0, 3);

  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold text-gray-400 px-1">Sua próxima ação</h2>
      {list.map((a, i) => (
        <button
          key={`${a.kind}-${i}`}
          type="button"
          onClick={() => onAction(a)}
          className="w-full text-left rounded-2xl p-4 border active:scale-[0.99] transition-transform"
          style={{
            borderColor: a.urgent ? 'rgba(248,113,113,0.35)' : 'rgba(191,150,54,0.28)',
            background: a.urgent
              ? 'linear-gradient(135deg, rgba(248,113,113,0.12), rgba(0,0,0,0.15))'
              : 'linear-gradient(135deg, rgba(191,150,54,0.14), rgba(0,0,0,0.15))',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white flex items-center gap-1.5">
                {a.urgent && <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
                {a.title}
              </p>
              <p className="text-sm text-gray-300 mt-0.5">{a.description}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: GOLD }}>
                {a.ctaLabel} <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </button>
      ))}
    </section>
  );
}
