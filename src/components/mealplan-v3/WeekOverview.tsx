// Resumo semanal: 7 dias em cards clicáveis com kcal e macros do dia.
// Mostra "Base" quando o dia não tem variação (usa "Todos os dias").
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { parseText } from '@/lib/smartPlan/parse';
import { planTotals } from '@/lib/smartPlan/serialize';

export type DayKey = 'all' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

const WEEK: { key: DayKey; short: string; long: string }[] = [
  { key: 'seg', short: 'Seg', long: 'Segunda' },
  { key: 'ter', short: 'Ter', long: 'Terça' },
  { key: 'qua', short: 'Qua', long: 'Quarta' },
  { key: 'qui', short: 'Qui', long: 'Quinta' },
  { key: 'sex', short: 'Sex', long: 'Sexta' },
  { key: 'sab', short: 'Sáb', long: 'Sábado' },
  { key: 'dom', short: 'Dom', long: 'Domingo' },
];

function fmt(n: number) {
  return Number.isFinite(n) ? Math.round(n).toString() : '—';
}

export function WeekOverview({
  texts, active, onSelect, weightKg, enrichedTotalsByDay,
}: {
  texts: Record<DayKey, string>;
  active: DayKey;
  onSelect: (k: DayKey) => void;
  weightKg: number | null;
  /** Totais já enriquecidos por dia (kcal/macros reais do banco). Preferidos
   *  sobre os cálculos a partir do texto — este componente NÃO enriquece. */
  enrichedTotalsByDay?: Partial<Record<DayKey, { kcal: number; cho: number; ptn: number; lip: number }>>;
}) {
  const rows = useMemo(() => {
    const baseFromText = planTotals(parseText(texts.all || ''));
    const base = enrichedTotalsByDay?.all ?? baseFromText;
    return WEEK.map(d => {
      const hasOverride = texts[d.key].trim().length > 0;
      const enrichedDay = enrichedTotalsByDay?.[d.key];
      const totals = hasOverride
        ? (enrichedDay ?? planTotals(parseText(texts[d.key])))
        : base;
      return { ...d, hasOverride, totals };
    });
  }, [texts, enrichedTotalsByDay]);

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
