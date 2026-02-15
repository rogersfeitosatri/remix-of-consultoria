import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Info, TrendingUp, Zap, Scale, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { calculateTMBFA, calculateTMBCunningham, calculateTMBHarrisBenedictMale, calculateTMBHarrisBenedictFemale, calculateAge, dayLabels } from '@/lib/nutritionalCalcs';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

interface Props {
  clientId: string;
  consultationId: string;
  consultation: any;
  onSaveConsultation: (data: any) => void;
}

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(0)} kcal
        </p>
      ))}
    </div>
  );
};

export function NPDashboardTab({ clientId, consultationId, consultation, onSaveConsultation }: Props) {
  const { consultations, fetchAssessments, fetchLabResults, fetchRunningZones, fetchRunningSchedule, fetchTriathlonSchedule } = useNutritionalPeriodization(clientId);
  const { data: assessments = [] } = fetchAssessments(consultationId);
  const { data: labResults = [] } = fetchLabResults(clientId);
  const { data: runningZones = [] } = fetchRunningZones(consultationId);
  const { data: runningSchedule = [] } = fetchRunningSchedule(consultationId);
  const { data: triathlonSchedule = [] } = fetchTriathlonSchedule(consultationId);

  const { data: athleteProfile } = useQuery({
    queryKey: ['athlete-profile-dashboard', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_profiles')
        .select('birth_date, gender')
        .eq('client_id', clientId)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  const weight = Number(consultation?.weight) || 0;
  const height = Number(consultation?.height) || 0;
  const leanMassKg = Number(consultation?.lean_mass_kg) || 0;
  const fa = Number(consultation?.activity_factor) || 1.25;
  const age = athleteProfile?.birth_date && consultation?.consultation_date
    ? calculateAge(athleteProfile.birth_date, consultation.consultation_date)
    : 30;

  // Calculate TMB
  let tmb = 0;
  switch (consultation?.tmb_formula) {
    case 'calorimetry': tmb = Number(consultation?.calorimetry_value) || 0; break;
    case 'cunningham': tmb = leanMassKg > 0 ? calculateTMBCunningham(leanMassKg) : 0; break;
    case 'harris_benedict_female': tmb = calculateTMBHarrisBenedictFemale(weight, height, age); break;
    default: tmb = calculateTMBHarrisBenedictMale(weight, height, age);
  }
  const tmbFa = calculateTMBFA(tmb, fa);

  const vctKeys = ['vct_monday', 'vct_tuesday', 'vct_wednesday', 'vct_thursday', 'vct_friday', 'vct_saturday', 'vct_sunday'];

  // VCT form state
  const [vctValues, setVctValues] = useState<Record<string, number | string>>({});

  useEffect(() => {
    if (consultation) {
      const vals: Record<string, number | string> = {};
      vctKeys.forEach(k => { vals[k] = consultation[k] || ''; });
      setVctValues(vals);
    }
  }, [consultation]);

  const updateVct = (key: string, value: string) => {
    setVctValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveVct = () => {
    const data: any = { id: consultationId };
    vctKeys.forEach(k => { data[k] = vctValues[k] ? Number(vctValues[k]) : null; });
    onSaveConsultation(data);
  };

  // Calculate GEE per day from running schedule
  const geePerDay = useMemo(() => {
    const result = [0, 0, 0, 0, 0, 0, 0];
    if (runningZones.length > 0 && runningSchedule.length > 0) {
      runningSchedule.forEach((s: any) => {
        const zone = runningZones.find((z: any) => z.id === s.zone_id);
        if (zone && s.duration_minutes > 0) {
          const kcalMin = (Number(zone.met_value) * weight) / 60;
          result[s.day_of_week] += kcalMin * Number(s.duration_minutes);
        }
      });
    }
    if (triathlonSchedule.length > 0) {
      triathlonSchedule.forEach((s: any) => {
        if (s.duration_minutes > 0 && s.met_value) {
          const kcalMin = (Number(s.met_value) * weight) / 60;
          result[s.day_of_week] += kcalMin * Number(s.duration_minutes);
        }
      });
    }
    return result;
  }, [runningZones, runningSchedule, triathlonSchedule, weight]);

  // Weekly energy table data
  const weeklyEnergyData = useMemo(() => {
    return dayLabels.map((day, i) => {
      const vct = Number(vctValues[vctKeys[i]]) || 0;
      const gee = geePerDay[i];
      const get = tmbFa + gee;
      const de = leanMassKg > 0 ? (vct - gee) / leanMassKg : 0;
      return { day: day.slice(0, 3), tmbFa, gee, get, vct, de };
    });
  }, [vctValues, geePerDay, tmbFa, leanMassKg]);

  const energyChartData = weeklyEnergyData.map(d => ({
    name: d.day,
    'TMB×FA+5%': d.tmbFa,
    GEE: d.gee,
    GET: d.get,
    VCT: d.vct,
  }));

  const bodyEvolution = useMemo(() => {
    return consultations
      .filter((c: any) => c.weight)
      .sort((a: any, b: any) => new Date(a.consultation_date).getTime() - new Date(b.consultation_date).getTime())
      .map((c: any) => ({
        date: new Date(c.consultation_date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        Peso: Number(c.weight) || 0,
        '% Gordura': Number(c.fat_percentage) || 0,
        'MLG (kg)': Number(c.lean_mass_kg) || 0,
      }));
  }, [consultations]);

  const keyExams = ['Hemoglobina', 'Ferritina', 'CK', 'Testosterona total', 'Cortisol (6-10h)', '25(OH) Vitamina D'];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Scale className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Peso</span>
            </div>
            <p className="text-xl font-bold">{weight || '—'} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">MLG</span>
            </div>
            <p className="text-xl font-bold">{leanMassKg || '—'} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">TMB×FA+5%</span>
            </div>
            <p className="text-xl font-bold">{tmbFa.toFixed(0)} kcal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">% Gordura</span>
            </div>
            <p className="text-xl font-bold">{consultation?.fat_percentage || '—'}%</p>
          </CardContent>
        </Card>
      </div>

      {/* VCT Planned */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            VCT Planejado (kcal/dia)
            <UITooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent>Valor Calórico Total planejado para a dieta de cada dia.</TooltipContent>
            </UITooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-7 gap-2">
            {dayLabels.map((day, i) => (
              <div key={day}>
                <label className="text-xs text-muted-foreground text-center block">{day.slice(0, 3)}</label>
                <Input
                  type="number"
                  className="text-center text-xs"
                  value={vctValues[vctKeys[i]] || ''}
                  onChange={e => updateVct(vctKeys[i], e.target.value)}
                />
              </div>
            ))}
          </div>
          <Button size="sm" onClick={handleSaveVct} className="gap-1">
            <Save className="h-3.5 w-3.5" /> Salvar VCT
          </Button>
        </CardContent>
      </Card>

      {/* Weekly Energy Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Tabela Energética Semanal
            <UITooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-sm">
                GET = TMB×FA+5% + GEE. Disponibilidade Energética = (VCT – GEE) ÷ MLG (kg). Faixa saudável: &gt;30 kcal/kg MLG.
              </TooltipContent>
            </UITooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-bold"></TableHead>
                  {dayLabels.map((d, i) => (
                    <TableHead key={i} className="text-xs text-center font-bold">{d}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs font-semibold py-1.5 whitespace-nowrap">TMB ×FA+5%</TableCell>
                  {weeklyEnergyData.map((d, i) => (
                    <TableCell key={i} className="text-xs text-center py-1.5">{d.tmbFa.toFixed(0)}</TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-semibold py-1.5">GEE</TableCell>
                  {weeklyEnergyData.map((d, i) => (
                    <TableCell key={i} className="text-xs text-center py-1.5">{d.gee > 0 ? d.gee.toFixed(0) : '—'}</TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="text-xs font-bold py-1.5">GET</TableCell>
                  {weeklyEnergyData.map((d, i) => (
                    <TableCell key={i} className="text-xs text-center py-1.5 font-semibold">{d.get.toFixed(0)}</TableCell>
                  ))}
                </TableRow>
                <TableRow><TableCell className="text-xs py-2" colSpan={8}></TableCell></TableRow>
                <TableRow className="bg-primary/5">
                  <TableCell className="text-xs font-bold py-1.5">VCT planejado</TableCell>
                  {weeklyEnergyData.map((d, i) => (
                    <TableCell key={i} className="text-xs text-center py-1.5 font-semibold">{d.vct > 0 ? d.vct.toFixed(0) : '—'}</TableCell>
                  ))}
                </TableRow>
                <TableRow><TableCell className="text-xs py-2" colSpan={8}></TableCell></TableRow>
                <TableRow className="font-semibold">
                  <TableCell className="text-xs font-bold py-1.5 whitespace-nowrap">DISPONIBILIDADE ENERG.</TableCell>
                  {weeklyEnergyData.map((d, i) => {
                    const isLow = d.de > 0 && d.de < 30;
                    return (
                      <TableCell key={i} className={`text-xs text-center py-1.5 font-bold ${isLow ? 'text-destructive' : ''}`}>
                        {d.vct > 0 ? d.de.toFixed(2) : '—'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Energy Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Energia Semanal (Gráfico)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={energyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <Tooltip content={<DarkTooltip />} />
              <Legend />
              <Bar dataKey="TMB×FA+5%" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="GEE" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="GET" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="VCT" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Body Composition Evolution */}
      {bodyEvolution.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evolução da Composição Corporal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={bodyEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip content={<DarkTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="Peso" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="% Gordura" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="MLG (kg)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Key Lab Results */}
      {labResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exames Chave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {keyExams.map(exam => {
                const result = labResults.find((r: any) => r.exam_name === exam);
                if (!result) return null;
                const outRange = result.result_value != null && (
                  (result.ref_min != null && result.result_value < result.ref_min) ||
                  (result.ref_max != null && result.result_value > result.ref_max)
                );
                return (
                  <div key={exam} className={`rounded-lg border p-3 ${outRange ? 'border-destructive bg-destructive/10' : 'border-border'}`}>
                    <p className="text-xs text-muted-foreground">{exam}</p>
                    <p className="text-lg font-bold">{result.result_value} <span className="text-xs font-normal text-muted-foreground">{result.unit}</span></p>
                    <p className="text-xs text-muted-foreground">Ref: {result.ref_min ?? '—'} – {result.ref_max ?? '—'}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
