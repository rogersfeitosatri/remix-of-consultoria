// Resumo semanal: 7 dias em cards clicáveis com kcal e macros do dia.
// Mostra "Base" quando o dia não tem variação (usa "Todos os dias").
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { parseText } from '@/lib/smartPlan/parse';
import { planTotals } from '@/lib/smartPlan/serialize';

export type DayKey = 'all' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const WEEK: { key: DayKey; short: string; long: string }[] = [
  { key: 'mon', short: 'Seg', long: 'Segunda' },
  { key: 'tue', short: 'Ter', long: 'Terça' },
  { key: 'wed', short: 'Qua', long: 'Quarta' },
  { key: 'thu', short: 'Qui', long: 'Quinta' },
  { key: 'fri', short: 'Sex', long: 'Sexta' },
  { key: 'sat', short: 'Sáb', long: 'Sábado' },
  { key: 'sun', short: 'Dom', long: 'Domingo' },
];

function fmt(n: number) {
  return Number.isFinite(n) ? Math.round(n).toString() : '—';
}

export function WeekOverview({
  texts, active, onSelect, weightKg,
}: {
  texts: Record<DayKey, string>;
  active: DayKey;
  onSelect: (k: DayKey) => void;
  weightKg: number | null;
}) {
  const rows = useMemo(() => {
    const base = planTotals(parseText(texts.all || ''));
    return WEEK.map(d => {
      const hasOverride = texts[d.key].trim().length > 0;
      const totals = hasOverride ? planTotals(parseText(texts[d.key])) : base;
      return { ...d, hasOverride, totals };
    });
  }, [texts]);

  const kg = weightKg && weightKg > 0 ? weightKg : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-3">
      {rows.map(r => {
        const isActive = active === r.key;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onSelect(r.key)}
            className={`text-left rounded-md border p-2 transition hover:bg-muted/50 ${
              isActive ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{r.short}</span>
              <Badge
                variant={r.hasOverride ? 'default' : 'secondary'}
                className="text-[9px] h-4 px-1"
              >
                {r.hasOverride ? 'Custom' : 'Base'}
              </Badge>
            </div>
            <div className="text-sm font-bold">{fmt(r.totals.kcal)} kcal</div>
            <div className="text-[10px] text-muted-foreground">
              C {fmt(r.totals.cho)}g · P {fmt(r.totals.ptn)}g · G {fmt(r.totals.lip)}g
            </div>
            {kg && r.totals.cho > 0 && (
              <div className="text-[10px] text-muted-foreground">
                CHO {(r.totals.cho / kg).toFixed(1).replace('.', ',')} g/kg
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
