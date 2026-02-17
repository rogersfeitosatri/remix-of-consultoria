import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { differenceInWeeks, parseISO, format, addWeeks } from 'date-fns';

interface Props {
  raceDate: string;
  startDate: string;
  onStartDateChange: (date: string) => void;
  suggestPhases: (totalWeeks: number, startDate: string) => any[];
  onSavePhases: (phases: any[]) => void;
  existingPhases: any[];
  isSaving: boolean;
  athletePeriodizationId?: string;
  raceName?: string;
}

export function JourneyPhaseConfig({
  raceDate, startDate, onStartDateChange, suggestPhases, onSavePhases, existingPhases, isSaving, athletePeriodizationId, raceName
}: Props) {
  const [phases, setPhases] = useState<any[]>([]);
  const [hasEdited, setHasEdited] = useState(false);

  const totalWeeks = raceDate && startDate
    ? Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1)
    : 0;

  // Auto-suggest when dates change
  useEffect(() => {
    if (totalWeeks > 0 && startDate && !hasEdited && existingPhases.length === 0) {
      const suggested = suggestPhases(totalWeeks, startDate);
      setPhases(suggested);
    }
  }, [totalWeeks, startDate, existingPhases.length]);

  // Load existing phases
  useEffect(() => {
    if (existingPhases.length > 0 && phases.length === 0) {
      setPhases(existingPhases);
    }
  }, [existingPhases]);

  const handleDurationChange = (index: number, weeks: number) => {
    setHasEdited(true);
    const updated = [...phases];
    updated[index] = { ...updated[index], duration_weeks: Math.max(weeks, 1) };

    // Recalculate dates
    let currentDate = parseISO(startDate);
    for (let i = 0; i < updated.length; i++) {
      updated[i].start_date = format(currentDate, 'yyyy-MM-dd');
      currentDate = addWeeks(currentDate, updated[i].duration_weeks);
      updated[i].end_date = format(currentDate, 'yyyy-MM-dd');
    }

    setPhases(updated);
  };

  const handleRegenerate = () => {
    if (totalWeeks > 0 && startDate) {
      const suggested = suggestPhases(totalWeeks, startDate);
      setPhases(suggested);
      setHasEdited(false);
    }
  };

  const currentTotal = phases.reduce((a, p) => a + (p.duration_weeks || 0), 0);
  const diff = totalWeeks - currentTotal;

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
          <div className="min-w-[100px]">
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">Total de Semanas</label>
            <div className="h-8 flex items-center px-3 rounded-md border border-border bg-muted text-xs font-bold">
              {totalWeeks}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1 text-xs h-8">
            <RefreshCw className="h-3 w-3" /> Recalcular
          </Button>
        </div>

        {/* Phase duration editor */}
        {phases.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Distribuição das Fases</p>
              {diff !== 0 && (
                <Badge variant="outline" className={`text-[9px] ${diff > 0 ? 'text-amber-400 border-amber-500/30' : 'text-destructive border-destructive/30'}`}>
                  {diff > 0 ? `+${diff} semanas sobrando` : `${Math.abs(diff)} semanas excedidas`}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {phases.map((phase, i) => (
                <div key={i} className="p-2 rounded-lg border border-border bg-muted/20 space-y-1.5">
                  <p className="text-xs font-semibold">{phase.phase_name}</p>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      value={phase.duration_weeks}
                      onChange={e => handleDurationChange(i, parseInt(e.target.value) || 1)}
                      className="h-7 text-xs w-16"
                    />
                    <span className="text-[10px] text-muted-foreground">sem</span>
                  </div>
                  {phase.start_date && (
                    <p className="text-[9px] text-muted-foreground">
                      {format(parseISO(phase.start_date), 'dd/MM')} → {format(parseISO(phase.end_date), 'dd/MM')}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Button
              size="sm"
              onClick={() => onSavePhases(phases)}
              disabled={isSaving || diff !== 0}
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
