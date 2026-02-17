import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Loader2, Save, ChevronDown, Sun, Sunset, Moon, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const CHO_COLORS: Record<string, string> = {
  'High': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Medium': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Low': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Recovery': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

interface DayDynamic {
  id?: string;
  journey_week_id: string;
  day_of_week: number;
  cho_classification: string;
  cho_gkg: number | null;
  morning_cho_pct: number | null;
  afternoon_cho_pct: number | null;
  night_cho_pct: number | null;
  distribution_rationale: string;
  pre_training: string;
  intra_training: string;
  post_training: string;
  night_guidance: string;
  notes: string;
  ai_generated: boolean;
}

interface Props {
  weekId: string;
  weekNumber: number;
  phaseName: string;
  existingDynamics: any[];
  sessions: any[];
  onGenerateDynamics: (weekId: string) => void;
  onSaveDynamics: (weekId: string, dynamics: Omit<DayDynamic, 'id'>[]) => void;
  isGenerating: boolean;
  isSaving: boolean;
  athleteWeight?: number | null;
}

export function JourneyDayDynamics({
  weekId, weekNumber, phaseName, existingDynamics, sessions,
  onGenerateDynamics, onSaveDynamics, isGenerating, isSaving, athleteWeight
}: Props) {
  const [dynamics, setDynamics] = useState<DayDynamic[]>(existingDynamics.length > 0
    ? existingDynamics
    : []
  );
  const [dirty, setDirty] = useState(false);

  if (existingDynamics.length > 0 && dynamics.length === 0) {
    setDynamics(existingDynamics);
  }

  const updateDynamic = (dayIdx: number, field: string, value: string) => {
    setDirty(true);
    setDynamics(prev => prev.map(d =>
      d.day_of_week === dayIdx ? { ...d, [field]: value } : d
    ));
  };

  const handleSave = () => {
    onSaveDynamics(weekId, dynamics.map(({ id, ...rest }) => rest));
    setDirty(false);
  };

  const hasSessions = sessions.some(s => s.modality && s.modality.trim() !== '');

  const getChoGrams = (gkg: number | null) => {
    if (!gkg || !athleteWeight) return null;
    return Math.round(gkg * athleteWeight);
  };

  const getDistributionBar = (morning: number | null, afternoon: number | null, night: number | null) => {
    const m = morning || 33;
    const a = afternoon || 34;
    const n = night || 33;
    return (
      <div className="flex h-3 w-full rounded-full overflow-hidden border border-border/50">
        <div className="bg-amber-400/70" style={{ width: `${m}%` }} title={`Manhã: ${m}%`} />
        <div className="bg-orange-400/70" style={{ width: `${a}%` }} title={`Tarde: ${a}%`} />
        <div className="bg-indigo-400/70" style={{ width: `${n}%` }} title={`Noite: ${n}%`} />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Dinâmica Nutricional — Semana {weekNumber}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGenerateDynamics(weekId)}
              disabled={isGenerating || !hasSessions}
              className="gap-1 text-xs h-7"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {dynamics.length > 0 ? 'Regenerar IA' : 'Gerar Dinâmica'}
            </Button>
            {dynamics.length > 0 && (
              <Button size="sm" onClick={handleSave} disabled={isSaving || !dirty} className="gap-1 text-xs h-7">
                <Save className="h-3 w-3" /> Salvar
              </Button>
            )}
          </div>
        </div>
        {!hasSessions && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Cadastre as sessões de treino primeiro para gerar a dinâmica.
          </p>
        )}
      </CardHeader>
      {dynamics.length > 0 && (
        <CardContent className="p-2 pt-0 space-y-1">
          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground px-2 pb-1 border-b border-border/30">
            <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-amber-400" /> Manhã</span>
            <span className="flex items-center gap-1"><Sunset className="h-3 w-3 text-orange-400" /> Tarde</span>
            <span className="flex items-center gap-1"><Moon className="h-3 w-3 text-indigo-400" /> Noite</span>
          </div>

          {dynamics.sort((a, b) => a.day_of_week - b.day_of_week).map((day) => {
            const totalGrams = getChoGrams(day.cho_gkg);
            return (
              <Collapsible key={day.day_of_week}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors group text-left">
                    <span className="text-xs font-medium w-8 shrink-0">{DAYS[day.day_of_week]}</span>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${CHO_COLORS[day.cho_classification] || 'text-muted-foreground'}`}>
                      {day.cho_classification || '—'}
                    </Badge>
                    {day.cho_gkg && (
                      <span className="text-[10px] font-semibold text-foreground shrink-0">
                        {day.cho_gkg}g/kg
                        {totalGrams && <span className="text-muted-foreground font-normal ml-1">({totalGrams}g)</span>}
                      </span>
                    )}
                    <div className="flex-1 max-w-[120px]">
                      {getDistributionBar(day.morning_cho_pct, day.afternoon_cho_pct, day.night_cho_pct)}
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground shrink-0">
                      <Sun className="h-2.5 w-2.5 text-amber-400" />{day.morning_cho_pct || 33}%
                      <Sunset className="h-2.5 w-2.5 text-orange-400 ml-1" />{day.afternoon_cho_pct || 34}%
                      <Moon className="h-2.5 w-2.5 text-indigo-400 ml-1" />{day.night_cho_pct || 33}%
                    </div>
                    <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-10 pr-2 pb-2 space-y-2">
                    {/* Distribution rationale */}
                    {day.distribution_rationale && (
                      <div className="flex items-start gap-1.5 bg-muted/30 rounded p-2">
                        <Info className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                        <p className="text-[10px] text-muted-foreground italic">{day.distribution_rationale}</p>
                      </div>
                    )}
                    {/* Nutrient timing grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-muted-foreground font-medium">Pré-treino</label>
                        <Textarea
                          value={day.pre_training || ''}
                          onChange={e => updateDynamic(day.day_of_week, 'pre_training', e.target.value)}
                          rows={2}
                          className="text-[10px] min-h-[40px] resize-none mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground font-medium">Intra-treino</label>
                        <Textarea
                          value={day.intra_training || ''}
                          onChange={e => updateDynamic(day.day_of_week, 'intra_training', e.target.value)}
                          rows={2}
                          className="text-[10px] min-h-[40px] resize-none mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground font-medium">Pós-treino</label>
                        <Textarea
                          value={day.post_training || ''}
                          onChange={e => updateDynamic(day.day_of_week, 'post_training', e.target.value)}
                          rows={2}
                          className="text-[10px] min-h-[40px] resize-none mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted-foreground font-medium">Noite</label>
                        <Textarea
                          value={day.night_guidance || ''}
                          onChange={e => updateDynamic(day.day_of_week, 'night_guidance', e.target.value)}
                          rows={2}
                          className="text-[10px] min-h-[40px] resize-none mt-0.5"
                        />
                      </div>
                    </div>
                    {/* Notes */}
                    {day.notes && (
                      <p className="text-[9px] text-muted-foreground border-l-2 border-primary/30 pl-2">{day.notes}</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
