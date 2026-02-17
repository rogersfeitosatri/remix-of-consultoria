import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Save } from 'lucide-react';

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
}

export function JourneyDayDynamics({
  weekId, weekNumber, phaseName, existingDynamics, sessions,
  onGenerateDynamics, onSaveDynamics, isGenerating, isSaving
}: Props) {
  const [dynamics, setDynamics] = useState<DayDynamic[]>(existingDynamics.length > 0
    ? existingDynamics
    : []
  );
  const [dirty, setDirty] = useState(false);

  // Sync when existingDynamics change
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
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] w-[50px]">Dia</TableHead>
                  <TableHead className="text-[10px] w-[80px]">CHO</TableHead>
                  <TableHead className="text-[10px]">Pré-treino</TableHead>
                  <TableHead className="text-[10px]">Intra</TableHead>
                  <TableHead className="text-[10px]">Pós-treino</TableHead>
                  <TableHead className="text-[10px]">Noite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dynamics.sort((a, b) => a.day_of_week - b.day_of_week).map((day) => (
                  <TableRow key={day.day_of_week}>
                    <TableCell className="py-1.5 text-xs font-medium">{DAYS[day.day_of_week]}</TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className={`text-[9px] ${CHO_COLORS[day.cho_classification] || 'text-muted-foreground'}`}>
                        {day.cho_classification || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Textarea
                        value={day.pre_training || ''}
                        onChange={e => updateDynamic(day.day_of_week, 'pre_training', e.target.value)}
                        rows={1}
                        className="text-[10px] min-h-[28px] resize-none"
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Textarea
                        value={day.intra_training || ''}
                        onChange={e => updateDynamic(day.day_of_week, 'intra_training', e.target.value)}
                        rows={1}
                        className="text-[10px] min-h-[28px] resize-none"
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Textarea
                        value={day.post_training || ''}
                        onChange={e => updateDynamic(day.day_of_week, 'post_training', e.target.value)}
                        rows={1}
                        className="text-[10px] min-h-[28px] resize-none"
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Textarea
                        value={day.night_guidance || ''}
                        onChange={e => updateDynamic(day.day_of_week, 'night_guidance', e.target.value)}
                        rows={1}
                        className="text-[10px] min-h-[28px] resize-none"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
