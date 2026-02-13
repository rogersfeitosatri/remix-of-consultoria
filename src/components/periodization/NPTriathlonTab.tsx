import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, Info } from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { triathlonMets, dayLabels, calculateGEE } from '@/lib/nutritionalCalcs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  consultation: any;
  consultationId: string;
}

const modalities = [
  { key: 'natacao', label: 'Natação' },
  { key: 'corrida', label: 'Corrida' },
  { key: 'bike', label: 'Bike' },
  { key: 'musculacao', label: 'Musculação' },
];

const intensities = ['leve', 'moderado', 'forte'];

export function NPTriathlonTab({ consultation, consultationId }: Props) {
  const { fetchTriathlonSchedule, saveTriathlonSchedule } = useNutritionalPeriodization();
  const { data: savedSchedule = [] } = fetchTriathlonSchedule(consultationId);

  const weight = Number(consultation?.weight) || 74;

  // Schedule: { modality: { day: { duration, intensity } } }
  const [schedule, setSchedule] = useState<Record<string, Record<number, { duration: number; intensity: string }>>>({});

  useEffect(() => {
    if (savedSchedule.length > 0) {
      const sched: any = {};
      savedSchedule.forEach((s: any) => {
        if (!sched[s.modality]) sched[s.modality] = {};
        sched[s.modality][s.day_of_week] = { duration: Number(s.duration_minutes) || 0, intensity: s.intensity || 'moderado' };
      });
      setSchedule(sched);
    }
  }, [savedSchedule]);

  const updateDuration = (mod: string, day: number, duration: number) => {
    setSchedule(prev => ({
      ...prev,
      [mod]: {
        ...(prev[mod] || {}),
        [day]: { ...(prev[mod]?.[day] || { intensity: 'moderado' }), duration },
      },
    }));
  };

  const updateIntensity = (mod: string, day: number, intensity: string) => {
    setSchedule(prev => ({
      ...prev,
      [mod]: {
        ...(prev[mod] || {}),
        [day]: { ...(prev[mod]?.[day] || { duration: 0 }), intensity },
      },
    }));
  };

  // Calculate GE per modality per day
  const gePerDay = useMemo(() => {
    const result: Record<string, number[]> = {};
    const geeTotal: number[] = [0, 0, 0, 0, 0, 0, 0];

    modalities.forEach(mod => {
      result[mod.key] = [0, 0, 0, 0, 0, 0, 0];
      for (let d = 0; d < 7; d++) {
        const entry = schedule[mod.key]?.[d];
        if (entry && entry.duration > 0) {
          const met = triathlonMets[mod.key]?.[entry.intensity] || 7;
          const ge = calculateGEE(met, weight, entry.duration);
          result[mod.key][d] = ge;
          geeTotal[d] += ge;
        }
      }
    });

    return { perModality: result, total: geeTotal };
  }, [schedule, weight]);

  const weekdayAvg = useMemo(() => {
    const weekdays = gePerDay.total.slice(0, 5).filter(v => v > 0);
    return weekdays.length > 0 ? weekdays.reduce((a, b) => a + b, 0) / weekdays.length : 0;
  }, [gePerDay]);

  const weekendAvg = useMemo(() => {
    const weekend = [gePerDay.total[5], gePerDay.total[6]].filter(v => v > 0);
    return weekend.length > 0 ? weekend.reduce((a, b) => a + b, 0) / weekend.length : 0;
  }, [gePerDay]);

  const handleSave = () => {
    const entries: any[] = [];
    Object.entries(schedule).forEach(([mod, days]) => {
      Object.entries(days).forEach(([dayStr, entry]) => {
        if (entry.duration > 0) {
          const met = triathlonMets[mod]?.[entry.intensity] || 7;
          entries.push({
            modality: mod,
            day_of_week: Number(dayStr),
            duration_minutes: entry.duration,
            intensity: entry.intensity,
            met_value: met,
          });
        }
      });
    });
    saveTriathlonSchedule.mutate({ consultationId, schedule: entries });
  };

  return (
    <div className="space-y-4">
      {/* Duration Schedule */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Duração dos Treinos de Triatlo (minutos)
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-sm">GE = (MET × Peso) / 60 × Duração. Selecione a intensidade para definir o MET de cada modalidade.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Modalidade</TableHead>
                  {dayLabels.map((d, i) => (
                    <TableHead key={i} className="text-xs text-center">{d.slice(0, 3)}</TableHead>
                  ))}
                  <TableHead className="text-xs text-center">Intensidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalities.map(mod => (
                  <TableRow key={mod.key}>
                    <TableCell className="text-xs py-1 font-medium">{mod.label}</TableCell>
                    {dayLabels.map((_, di) => (
                      <TableCell key={di} className="py-1">
                        <Input
                          type="number"
                          value={schedule[mod.key]?.[di]?.duration || ''}
                          onChange={e => updateDuration(mod.key, di, Number(e.target.value))}
                          className="h-7 text-xs w-14 text-center"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="py-1">
                      <Select
                        value={schedule[mod.key]?.[0]?.intensity || 'moderado'}
                        onValueChange={v => {
                          // Apply same intensity to all days of this modality
                          for (let d = 0; d < 7; d++) {
                            updateIntensity(mod.key, d, v);
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {intensities.map(int => (
                            <SelectItem key={int} value={int}>{int.charAt(0).toUpperCase() + int.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* GE Results */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Gasto Energético dos Treinos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Modalidade</TableHead>
                  {dayLabels.map((d, i) => (
                    <TableHead key={i} className="text-xs text-center">{d.slice(0, 3)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalities.map(mod => (
                  <TableRow key={mod.key}>
                    <TableCell className="text-xs py-1">{mod.label}</TableCell>
                    {dayLabels.map((_, di) => (
                      <TableCell key={di} className="text-xs text-center py-1">
                        {gePerDay.perModality[mod.key][di] > 0 ? gePerDay.perModality[mod.key][di].toFixed(0) : '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell className="text-xs py-1">GEE Total</TableCell>
                  {gePerDay.total.map((v, i) => (
                    <TableCell key={i} className="text-xs text-center py-1">
                      <Badge className="bg-destructive/20 text-destructive">{v.toFixed(0)}</Badge>
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-4 mt-3">
            <Badge variant="outline">Média semanal: {weekdayAvg.toFixed(0)} kcal</Badge>
            <Badge variant="outline">Média fim de semana: {weekendAvg.toFixed(0)} kcal</Badge>
          </div>

          <Button onClick={handleSave} className="gap-1 mt-4">
            <Save className="h-4 w-4" /> Salvar Treinos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
