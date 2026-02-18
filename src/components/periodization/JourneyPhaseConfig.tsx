import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Settings2, Plus, Target, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { differenceInWeeks, addWeeks, parseISO, format } from 'date-fns';

interface Props {
  raceDate: string;
  startDate: string;
  onStartDateChange: (date: string) => void;
  suggestPhases: (totalWeeks: number, startDate: string, raceDate?: string) => any[];
  recalcPhaseDates: (phases: any[], startDate: string, raceDate?: string) => any[];
  onSavePhases: (phases: any[]) => void;
  existingPhases: any[];
  isSaving: boolean;
  athletePeriodizationId?: string;
  raceName?: string;
}

// Recalc dates sequentially from startDate without touching durations
function recalcDatesOnly(phases: any[], startDate: string): any[] {
  let cursor = parseISO(startDate);
  return phases.map((phase) => {
    const start = cursor;
    const end = addWeeks(start, phase.duration_weeks || 0);
    cursor = end;
    return {
      ...phase,
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
    };
  });
}

const PHASE_COLORS: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  'Base': { bg: 'bg-blue-500/5', border: 'border-blue-300/40', dot: 'bg-blue-500', label: 'text-blue-600 dark:text-blue-400' },
  'Específica': { bg: 'bg-orange-500/5', border: 'border-orange-300/40', dot: 'bg-orange-500', label: 'text-orange-600 dark:text-orange-400' },
  'Polimento': { bg: 'bg-emerald-500/5', border: 'border-emerald-300/40', dot: 'bg-emerald-500', label: 'text-emerald-600 dark:text-emerald-400' },
  'Transição': { bg: 'bg-purple-500/5', border: 'border-purple-300/40', dot: 'bg-purple-500', label: 'text-purple-600 dark:text-purple-400' },
};

function getPhaseColor(phaseName: string) {
  for (const key of Object.keys(PHASE_COLORS)) {
    if (phaseName?.includes(key)) return PHASE_COLORS[key];
  }
  return { bg: 'bg-muted/20', border: 'border-border', dot: 'bg-muted-foreground', label: 'text-foreground' };
}

export function JourneyPhaseConfig({
  raceDate, startDate, onStartDateChange, suggestPhases, recalcPhaseDates, onSavePhases, existingPhases, isSaving, raceName
}: Props) {
  const [phases, setPhases] = useState<any[]>([]);
  const [hasEdited, setHasEdited] = useState(false);
  // Track raw string values for each input
  const [durationInputs, setDurationInputs] = useState<Record<number, string>>({});

  // Auto-suggest when dates change (only if no existing phases and user hasn't manually edited)
  useEffect(() => {
    if (startDate && raceDate && !hasEdited && existingPhases.length === 0) {
      const totalWeeks = Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1);
      const suggested = suggestPhases(totalWeeks, startDate, raceDate);
      setPhases(suggested);
      setDurationInputs({});
    }
  }, [startDate, raceDate, existingPhases.length]);

  // Load existing phases (only once)
  useEffect(() => {
    if (existingPhases.length > 0 && phases.length === 0 && !hasEdited) {
      setPhases(existingPhases);
      setDurationInputs({});
    }
  }, [existingPhases.length]);

  const applyNewDuration = (index: number, newValue: number) => {
    const clamped = Math.max(0, newValue);
    const updated = [...phases];
    updated[index] = { ...updated[index], duration_weeks: clamped };
    const withDates = startDate ? recalcDatesOnly(updated, startDate) : updated;
    setPhases(withDates);
    setDurationInputs(prev => ({ ...prev, [index]: String(clamped) }));
    setHasEdited(true);
  };

  const handleInputChange = (index: number, value: string) => {
    // Allow free typing — only update display
    setDurationInputs(prev => ({ ...prev, [index]: value }));
    setHasEdited(true);
  };

  const handleInputBlur = (index: number, value: string) => {
    const parsed = parseInt(value);
    if (value === '' || isNaN(parsed)) {
      // Reset to current phase value
      setDurationInputs(prev => ({ ...prev, [index]: String(phases[index]?.duration_weeks ?? 0) }));
      return;
    }
    applyNewDuration(index, parsed);
  };

  const handleInputKeyDown = (index: number, value: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const parsed = parseInt(value);
      if (!isNaN(parsed)) applyNewDuration(index, parsed);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = parseInt(durationInputs[index] ?? String(phases[index]?.duration_weeks ?? 0)) || 0;
      applyNewDuration(index, current + 1);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseInt(durationInputs[index] ?? String(phases[index]?.duration_weeks ?? 0)) || 0;
      applyNewDuration(index, Math.max(0, current - 1));
    }
  };

  const handleRegenerate = () => {
    if (startDate && raceDate) {
      const totalWeeks = Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1);
      const suggested = suggestPhases(totalWeeks, startDate, raceDate);
      setPhases(suggested);
      setDurationInputs({});
      setHasEdited(false);
    }
  };

  // Calculate totals for alignment feedback
  const expectedTotalWeeks = (startDate && raceDate)
    ? Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1)
    : 0;

  const polimentoIndex = phases.findIndex(p => p.phase_name?.includes('Polimento'));
  const weeksUntilPolimento = phases
    .slice(0, polimentoIndex + 1)
    .reduce((sum, p) => sum + (p.duration_weeks || 0), 0);

  const totalWeeksAll = phases.reduce((sum, p) => sum + (p.duration_weeks || 0), 0);
  const isAligned = expectedTotalWeeks > 0 && weeksUntilPolimento === expectedTotalWeeks;
  const weeksDiff = weeksUntilPolimento - expectedTotalWeeks;

  const getDisplayValue = (index: number, phase: any) => {
    return durationInputs[index] !== undefined ? durationInputs[index] : String(phase.duration_weeks ?? 0);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Configuração da Periodização
          {expectedTotalWeeks > 0 && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              {totalWeeksAll} sem total
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date config */}
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Início do Ciclo</label>
            <Input type="date" value={startDate} onChange={e => onStartDateChange(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Data da Prova</label>
            <Input type="date" value={raceDate} disabled className="h-8 text-xs opacity-60" />
          </div>
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1 text-xs h-8">
            <RefreshCw className="h-3 w-3" /> Sugerir
          </Button>
        </div>

        {/* Alignment info */}
        <div className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
          isAligned
            ? 'bg-emerald-500/5 border-emerald-500/20 text-muted-foreground'
            : weeksDiff !== 0
              ? 'bg-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-400'
              : 'bg-primary/5 border-primary/20 text-muted-foreground'
        }`}>
          {isAligned ? (
            <Target className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
          {isAligned ? (
            <span>A <strong className="text-foreground">Prova Alvo</strong> coincide com o final de <strong className="text-foreground">Polimento</strong>. ✓</span>
          ) : weeksDiff > 0 ? (
            <span>Polimento termina <strong>{weeksDiff} sem</strong> depois da prova. Reduza para alinhar.</span>
          ) : weeksDiff < 0 ? (
            <span>Faltam <strong>{Math.abs(weeksDiff)} sem</strong> até a prova. Adicione para alinhar.</span>
          ) : (
            <span>A <strong className="text-foreground">Prova Alvo</strong> deve coincidir com o final do <strong className="text-foreground">Polimento</strong>.</span>
          )}
          {raceDate && isAligned && (
            <Badge className="text-[8px] bg-emerald-500/20 text-emerald-500 border-emerald-500/30 ml-auto shrink-0">✓ Alinhado</Badge>
          )}
        </div>

        {/* Phase duration editor */}
        {phases.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Distribuição das Fases</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {phases.map((phase, i) => {
                const isTransicao = phase.phase_name?.includes('Transição');
                const isPolimento = phase.phase_name?.includes('Polimento');
                const colors = getPhaseColor(phase.phase_name);
                const displayVal = getDisplayValue(i, phase);
                const numVal = parseInt(displayVal) || 0;

                return (
                  <div key={i} className={`rounded-xl border p-3 space-y-2 ${colors.bg} ${isPolimento && !isAligned ? 'border-amber-400/50' : colors.border}`}>
                    {/* Phase name */}
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${colors.dot}`} />
                      <p className={`text-xs font-semibold flex-1 leading-tight ${colors.label}`}>{phase.phase_name}</p>
                      {isPolimento && raceDate && (
                        <span className="text-[8px]">🏁</span>
                      )}
                      {isTransicao && (
                        <span className="text-[8px] text-muted-foreground">pós</span>
                      )}
                    </div>

                    {/* Counter control */}
                    <div className="flex items-center gap-0">
                      <button
                        type="button"
                        onClick={() => applyNewDuration(i, numVal - 1)}
                        className="h-8 w-7 flex items-center justify-center rounded-l-md border border-r-0 border-border bg-background hover:bg-muted transition-colors"
                      >
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={displayVal}
                        onChange={e => handleInputChange(i, e.target.value)}
                        onBlur={e => handleInputBlur(i, e.target.value)}
                        onKeyDown={e => handleInputKeyDown(i, displayVal, e)}
                        className="h-8 w-10 border border-border bg-background text-center text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => applyNewDuration(i, numVal + 1)}
                        className="h-8 w-7 flex items-center justify-center rounded-r-md border border-l-0 border-border bg-background hover:bg-muted transition-colors"
                      >
                        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <span className="text-[10px] text-muted-foreground ml-1.5">sem</span>
                    </div>

                    {/* Date range */}
                    {phase.start_date && numVal > 0 ? (
                      <p className="text-[9px] text-muted-foreground font-medium">
                        {format(parseISO(phase.start_date), 'dd/MM')} → {format(parseISO(phase.end_date), 'dd/MM')}
                        {isPolimento && ' 🏁'}
                      </p>
                    ) : numVal === 0 ? (
                      <p className="text-[9px] text-muted-foreground italic">Fase ignorada</p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                size="sm"
                onClick={() => onSavePhases(phases.filter(p => (p.duration_weeks || 0) > 0))}
                disabled={isSaving}
                className="gap-1 text-xs"
              >
                {existingPhases.length > 0 ? <RefreshCw className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {existingPhases.length > 0 ? 'Atualizar Jornada' : 'Criar Jornada'}
              </Button>
              {!isAligned && expectedTotalWeeks > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ Ajuste o Polimento para {expectedTotalWeeks} sem no total
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
