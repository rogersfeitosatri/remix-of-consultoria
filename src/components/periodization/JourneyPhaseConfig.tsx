import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Settings2, Plus, Target, AlertTriangle } from 'lucide-react';
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

export function JourneyPhaseConfig({
  raceDate, startDate, onStartDateChange, suggestPhases, recalcPhaseDates, onSavePhases, existingPhases, isSaving, raceName
}: Props) {
  const [phases, setPhases] = useState<any[]>([]);
  const [hasEdited, setHasEdited] = useState(false);

  // Auto-suggest when dates change (only if no existing phases and user hasn't manually edited)
  useEffect(() => {
    if (startDate && raceDate && !hasEdited && existingPhases.length === 0) {
      const totalWeeks = Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1);
      const suggested = suggestPhases(totalWeeks, startDate, raceDate);
      setPhases(suggested);
    }
  }, [startDate, raceDate, existingPhases.length]);

  // Load existing phases (only once)
  useEffect(() => {
    if (existingPhases.length > 0 && phases.length === 0) {
      setPhases(existingPhases);
    }
  }, [existingPhases]);

  // When user types a new duration: keep the value exactly, just recalc sequential dates
  const handleDurationChange = (index: number, value: string) => {
    setHasEdited(true);
    const weeks = value === '' ? 0 : Math.max(parseInt(value) || 0, 0);
    const updated = [...phases];
    updated[index] = { ...updated[index], duration_weeks: weeks };
    // Only recalculate start/end dates sequentially — never touch durations
    const withDates = startDate ? recalcDatesOnly(updated, startDate) : updated;
    setPhases(withDates);
  };

  const handleRegenerate = () => {
    if (startDate && raceDate) {
      const totalWeeks = Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1);
      const suggested = suggestPhases(totalWeeks, startDate, raceDate);
      setPhases(suggested);
      setHasEdited(false);
    }
  };

  // Calculate totals for alignment feedback
  const expectedTotalWeeks = (startDate && raceDate)
    ? Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1)
    : 0;

  // Weeks up to and including Polimento (exclude Transição from race alignment check)
  const polimentoIndex = phases.findIndex(p => p.phase_name?.includes('Polimento'));
  const weeksUntilPolimento = phases
    .slice(0, polimentoIndex + 1)
    .reduce((sum, p) => sum + (p.duration_weeks || 0), 0);

  const totalWeeksAll = phases.reduce((sum, p) => sum + (p.duration_weeks || 0), 0);
  const isAligned = expectedTotalWeeks > 0 && weeksUntilPolimento === expectedTotalWeeks;
  const weeksDiff = weeksUntilPolimento - expectedTotalWeeks;

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
            <span>
              A <strong className="text-foreground">Prova Alvo</strong> coincide com o final da fase <strong className="text-foreground">Polimento</strong>. ✓
            </span>
          ) : weeksDiff > 0 ? (
            <span>
              As fases até o Polimento somam <strong>{weeksUntilPolimento} sem</strong>, mas o ciclo tem <strong>{expectedTotalWeeks} sem</strong> até a prova.
              Reduza <strong>{weeksDiff} sem</strong> para alinhar.
            </span>
          ) : weeksDiff < 0 ? (
            <span>
              As fases até o Polimento somam <strong>{weeksUntilPolimento} sem</strong>, mas o ciclo tem <strong>{expectedTotalWeeks} sem</strong> até a prova.
              Adicione <strong>{Math.abs(weeksDiff)} sem</strong> para alinhar.
            </span>
          ) : (
            <span>A <strong className="text-foreground">Prova Alvo</strong> deve coincidir com o final da fase <strong className="text-foreground">Polimento</strong>.</span>
          )}
          {raceDate && isAligned && (
            <Badge className="text-[8px] bg-emerald-500/20 text-emerald-500 border-emerald-500/30 ml-auto shrink-0">✓ Alinhado</Badge>
          )}
        </div>

        {/* Phase duration editor */}
        {phases.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Distribuição das Fases</p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              {phases.map((phase, i) => {
                const isTransicao = phase.phase_name?.includes('Transição');
                const isPolimento = phase.phase_name?.includes('Polimento');
                return (
                  <div key={i} className={`p-2 rounded-lg border bg-muted/20 space-y-1.5 ${
                    isPolimento && !isAligned && phases.length > 0
                      ? 'border-amber-500/30'
                      : 'border-border'
                  }`}>
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-semibold flex-1">{phase.phase_name}</p>
                      {isPolimento && raceDate && (
                        <Badge className={`text-[7px] ${isAligned ? 'bg-primary/20 text-primary border-primary/30' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}`}>
                          🏁 prova
                        </Badge>
                      )}
                      {isTransicao && (
                        <Badge variant="outline" className="text-[7px]">pós-prova</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        value={phase.duration_weeks === 0 ? '0' : phase.duration_weeks || ''}
                        onChange={e => handleDurationChange(i, e.target.value)}
                        className="h-7 text-xs w-16"
                      />
                      <span className="text-[10px] text-muted-foreground">sem</span>
                    </div>
                    {phase.start_date && (phase.duration_weeks || 0) > 0 && (
                      <p className="text-[9px] text-muted-foreground">
                        {format(parseISO(phase.start_date), 'dd/MM')} → {format(parseISO(phase.end_date), 'dd/MM')}
                        {isPolimento && ' 🏁'}
                      </p>
                    )}
                    {(phase.duration_weeks === 0 || phase.duration_weeks === '0') && (
                      <p className="text-[9px] text-muted-foreground italic">Fase ignorada</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => onSavePhases(phases.filter(p => p.duration_weeks > 0))}
                disabled={isSaving}
                className="gap-1 text-xs"
              >
                {existingPhases.length > 0 ? <RefreshCw className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {existingPhases.length > 0 ? 'Atualizar Jornada' : 'Criar Jornada'}
              </Button>
              {!isAligned && expectedTotalWeeks > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ Ajuste as semanas até o Polimento = {expectedTotalWeeks} sem para alinhar com a prova
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

