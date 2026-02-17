import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Settings2, Plus, Target } from 'lucide-react';
import { differenceInWeeks, parseISO, format } from 'date-fns';

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

export function JourneyPhaseConfig({
  raceDate, startDate, onStartDateChange, suggestPhases, recalcPhaseDates, onSavePhases, existingPhases, isSaving, raceName
}: Props) {
  const [phases, setPhases] = useState<any[]>([]);
  const [hasEdited, setHasEdited] = useState(false);

  // Auto-suggest when dates change
  useEffect(() => {
    if (startDate && raceDate && !hasEdited && existingPhases.length === 0) {
      const totalWeeks = Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1);
      const suggested = suggestPhases(totalWeeks, startDate, raceDate);
      setPhases(suggested);
    }
  }, [startDate, raceDate, existingPhases.length]);

  // Load existing phases
  useEffect(() => {
    if (existingPhases.length > 0 && phases.length === 0) {
      setPhases(existingPhases);
    }
  }, [existingPhases]);

  const handleDurationChange = (index: number, weeks: number) => {
    setHasEdited(true);
    const updated = [...phases];
    updated[index] = { ...updated[index], duration_weeks: Math.max(weeks, 0) };
    // Recalculate anchoring Polimento end to raceDate
    const recalculated = recalcPhaseDates(updated, startDate, raceDate);
    setPhases(recalculated);
  };

  const handleRegenerate = () => {
    if (startDate && raceDate) {
      const totalWeeks = Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1);
      const suggested = suggestPhases(totalWeeks, startDate, raceDate);
      setPhases(suggested);
      setHasEdited(false);
    }
  };

  // Check alignment: Polimento end === raceDate
  const polimentoPhase = phases.find(p => p.phase_name?.includes('Polimento'));
  const isAligned = raceDate && polimentoPhase?.end_date
    ? polimentoPhase.end_date === raceDate
    : false;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Configuração da Periodização
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
            <RefreshCw className="h-3 w-3" /> Recalcular
          </Button>
        </div>

        {/* Alignment info */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
          <Target className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>O final do <strong className="text-foreground">Polimento</strong> coincide com a <strong className="text-foreground">Data da Prova</strong>. A Transição é pós-prova.</span>
          {raceDate && (
            isAligned
              ? <Badge className="text-[8px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-auto shrink-0">✓ Alinhado</Badge>
              : <Badge className="text-[8px] bg-amber-500/20 text-amber-400 border-amber-500/30 ml-auto shrink-0">Calculando...</Badge>
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
                  <div key={i} className="p-2 rounded-lg border border-border bg-muted/20 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-semibold flex-1">{phase.phase_name}</p>
                      {isPolimento && raceDate && (
                        <Badge className="text-[7px] bg-primary/20 text-primary border-primary/30">🏁 prova</Badge>
                      )}
                      {isTransicao && (
                        <Badge variant="outline" className="text-[7px]">pós-prova</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={isPolimento ? 1 : 0}
                        value={phase.duration_weeks}
                        onChange={e => handleDurationChange(i, parseInt(e.target.value) || 0)}
                        className="h-7 text-xs w-16"
                      />
                      <span className="text-[10px] text-muted-foreground">sem</span>
                    </div>
                    {phase.start_date && phase.duration_weeks > 0 && (
                      <p className="text-[9px] text-muted-foreground">
                        {format(parseISO(phase.start_date), 'dd/MM')} → {format(parseISO(phase.end_date), 'dd/MM')}
                        {isPolimento && ' 🏁'}
                      </p>
                    )}
                    {phase.duration_weeks === 0 && (
                      <p className="text-[9px] text-muted-foreground italic">Fase ignorada</p>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              size="sm"
              onClick={() => onSavePhases(phases.filter(p => p.duration_weeks > 0))}
              disabled={isSaving || !isAligned}
              className="gap-1 text-xs"
            >
              {existingPhases.length > 0 ? <RefreshCw className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {existingPhases.length > 0 ? 'Atualizar Jornada' : 'Criar Jornada'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
