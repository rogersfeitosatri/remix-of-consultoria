import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, Info } from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { defaultRunningZones, dayLabels, calculateGEE } from '@/lib/nutritionalCalcs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  consultation: any;
  consultationId: string;
}

export function NPRunningTab({ consultation, consultationId }: Props) {
  const { fetchRunningZones, saveRunningZones, fetchRunningSchedule, saveRunningSchedule } = useNutritionalPeriodization();
  const { data: savedZones = [] } = fetchRunningZones(consultationId);
  const { data: savedSchedule = [] } = fetchRunningSchedule(consultationId);

  const [zones, setZones] = useState<any[]>([]);
  // schedule: { [zoneIndex]: { [dayOfWeek]: minutes } }
  const [schedule, setSchedule] = useState<Record<number, Record<number, number>>>({});

  const weight = Number(consultation?.weight) || 74;

  useEffect(() => {
    if (savedZones.length > 0) {
      setZones(savedZones);
    } else {
      setZones(defaultRunningZones.map((z, i) => ({ ...z, order_index: i })));
    }
  }, [savedZones]);

  useEffect(() => {
    if (savedSchedule.length > 0 && savedZones.length > 0) {
      const sched: Record<number, Record<number, number>> = {};
      savedSchedule.forEach((s: any) => {
        const zoneIdx = savedZones.findIndex((z: any) => z.id === s.zone_id);
        if (zoneIdx >= 0) {
          if (!sched[zoneIdx]) sched[zoneIdx] = {};
          sched[zoneIdx][s.day_of_week] = Number(s.duration_minutes) || 0;
        }
      });
      setSchedule(sched);
    }
  }, [savedSchedule, savedZones]);

  const updateZone = (index: number, key: string, value: any) => {
    setZones(prev => prev.map((z, i) => i === index ? { ...z, [key]: value } : z));
  };

  const updateSchedule = (zoneIdx: number, day: number, minutes: number) => {
    setSchedule(prev => ({
      ...prev,
      [zoneIdx]: { ...(prev[zoneIdx] || {}), [day]: minutes },
    }));
  };

  // Calculate kcal/min and kcal/h for each zone
  const zonesWithCalc = zones.map(z => {
    const met = Number(z.met_value) || 0;
    const kcalMin = (met * weight) / 60;
    const kcalH = kcalMin * 60;
    return { ...z, kcalMin, kcalH };
  });

  // Calculate GEE per day
  const geePerDay = useMemo(() => {
    const result: number[] = [0, 0, 0, 0, 0, 0, 0];
    zonesWithCalc.forEach((z, zi) => {
      for (let d = 0; d < 7; d++) {
        const mins = schedule[zi]?.[d] || 0;
        result[d] += z.kcalMin * mins;
      }
    });
    return result;
  }, [zonesWithCalc, schedule]);

  const handleSave = async () => {
    const savedZoneData = await saveRunningZones.mutateAsync({ consultationId, zones: zones.map(({ id, ...rest }) => rest) });
    // Build schedule entries
    if (savedZoneData && savedZoneData.length > 0) {
      const scheduleEntries: any[] = [];
      Object.entries(schedule).forEach(([zoneIdxStr, days]) => {
        const zoneIdx = Number(zoneIdxStr);
        const zone = savedZoneData[zoneIdx];
        if (!zone) return;
        Object.entries(days).forEach(([dayStr, mins]) => {
          if (Number(mins) > 0) {
            scheduleEntries.push({
              zone_id: zone.id,
              day_of_week: Number(dayStr),
              duration_minutes: Number(mins),
            });
          }
        });
      });
      saveRunningSchedule.mutate({ consultationId, schedule: scheduleEntries });
    }
  };

  return (
    <div className="space-y-4">
      {/* Zones Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Ritmos e Zonas de Corrida
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-sm">Kcal/min = (MET × Peso) / 60. Edite os METs conforme a experiência do atleta.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Zona</TableHead>
                  <TableHead className="text-xs">Zona FC</TableHead>
                  <TableHead className="text-xs">PACE</TableHead>
                  <TableHead className="text-xs">KM/H</TableHead>
                  <TableHead className="text-xs text-center">MET</TableHead>
                  <TableHead className="text-xs text-center">Kcal/min</TableHead>
                  <TableHead className="text-xs text-center">Kcal/h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zonesWithCalc.map((z, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs py-1 font-medium">{z.zone_name}</TableCell>
                    <TableCell className="py-1"><Input value={z.hr_zone || ''} onChange={e => updateZone(i, 'hr_zone', e.target.value)} className="h-7 text-xs w-24" /></TableCell>
                    <TableCell className="py-1"><Input value={z.pace || ''} onChange={e => updateZone(i, 'pace', e.target.value)} className="h-7 text-xs w-28" /></TableCell>
                    <TableCell className="py-1"><Input value={z.speed_kmh || ''} onChange={e => updateZone(i, 'speed_kmh', e.target.value)} className="h-7 text-xs w-28" /></TableCell>
                    <TableCell className="py-1"><Input type="number" step="0.5" value={z.met_value} onChange={e => updateZone(i, 'met_value', Number(e.target.value))} className="h-7 text-xs w-16 text-center" /></TableCell>
                    <TableCell className="text-xs text-center py-1">{z.kcalMin.toFixed(1)}</TableCell>
                    <TableCell className="text-xs text-center py-1">{z.kcalH.toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Training Schedule */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Duração dos Treinos (minutos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tipo</TableHead>
                  {dayLabels.map((d, i) => (
                    <TableHead key={i} className="text-xs text-center">{d.slice(0, 3)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((z, zi) => (
                  <TableRow key={zi}>
                    <TableCell className="text-xs py-1 font-medium whitespace-nowrap">{z.zone_name}</TableCell>
                    {dayLabels.map((_, di) => (
                      <TableCell key={di} className="py-1">
                        <Input
                          type="number"
                          value={schedule[zi]?.[di] || ''}
                          onChange={e => updateSchedule(zi, di, Number(e.target.value))}
                          className="h-7 text-xs w-16 text-center"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* GEE Results */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Gasto Energético dos Exercícios (GEE)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {dayLabels.map((d, i) => (
              <div key={i} className="text-center">
                <p className="text-xs text-muted-foreground">{d.slice(0, 3)}</p>
                <Badge className="bg-destructive/20 text-destructive">{geePerDay[i].toFixed(0)} kcal</Badge>
              </div>
            ))}
          </div>
          <Button onClick={handleSave} className="gap-1 mt-4">
            <Save className="h-4 w-4" /> Salvar Treinos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
