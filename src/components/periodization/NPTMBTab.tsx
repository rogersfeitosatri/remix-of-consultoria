import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, Trash2, Info, AlertTriangle } from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { calculateTMBCunningham, calculateTMBHarrisBenedictMale, calculateTMBHarrisBenedictFemale, calculateTMBFA, calculateAge } from '@/lib/nutritionalCalcs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Props {
  consultation: any;
  consultationId: string;
}

export function NPTMBTab({ consultation, consultationId }: Props) {
  const { fetchActivities, saveActivities, saveConsultation } = useNutritionalPeriodization();
  const { data: savedActivities = [] } = fetchActivities(consultationId);
  const [activities, setActivities] = useState<any[]>([]);
  const [tmbFormula, setTmbFormula] = useState(consultation?.tmb_formula || '');
  const [calorimetryValue, setCalorimetryValue] = useState(consultation?.calorimetry_value || '');
  const [faType, setFaType] = useState(consultation?.activity_factor_type || 'manual');
  const [manualFa, setManualFa] = useState(consultation?.activity_factor || 1.25);

  // Fetch athlete profile for age/sex
  const { data: athleteProfile } = useQuery({
    queryKey: ['athlete-profile-tmb', consultation?.client_id],
    queryFn: async () => {
      if (!consultation?.client_id) return null;
      const { data } = await supabase
        .from('athlete_profiles')
        .select('birth_date, gender')
        .eq('client_id', consultation.client_id)
        .maybeSingle();
      return data;
    },
    enabled: !!consultation?.client_id,
  });

  useEffect(() => {
    if (savedActivities.length > 0) {
      setActivities(savedActivities);
    } else {
      setActivities([]);
    }
  }, [savedActivities]);

  const weight = Number(consultation?.weight) || 0;
  const height = Number(consultation?.height) || 0;
  const leanMassKg = Number(consultation?.lean_mass_kg) || 0;
  const hasMLG = leanMassKg > 0;
  const gender = athleteProfile?.gender || '';
  const age = athleteProfile?.birth_date && consultation?.consultation_date
    ? calculateAge(athleteProfile.birth_date, consultation.consultation_date)
    : 30;

  // Smart default formula selection
  useEffect(() => {
    if (!tmbFormula && weight > 0) {
      if (hasMLG) {
        setTmbFormula('cunningham');
      } else if (gender === 'feminino') {
        setTmbFormula('harris_benedict_female');
      } else {
        setTmbFormula('harris_benedict_male');
      }
    }
  }, [weight, hasMLG, gender, tmbFormula]);

  // Calculate TMBs
  const tmbCalorimetry = Number(calorimetryValue) || 0;
  const tmbCunningham = hasMLG ? calculateTMBCunningham(leanMassKg) : 0;
  const tmbHarrisMale = weight > 0 ? calculateTMBHarrisBenedictMale(weight, height, age) : 0;
  const tmbHarrisFemale = weight > 0 ? calculateTMBHarrisBenedictFemale(weight, height, age) : 0;

  const tmbValues: Record<string, number> = {
    calorimetry: tmbCalorimetry,
    cunningham: tmbCunningham,
    harris_benedict_male: tmbHarrisMale,
    harris_benedict_female: tmbHarrisFemale,
  };

  const selectedTmb = tmbValues[tmbFormula] || 0;

  // Calculate FA from activities
  const totalHours = activities.reduce((s, a) => s + (Number(a.duration_hours) || 0), 0);
  const totalGE = activities.reduce((s, a) => s + (Number(a.met_value) || 0) * (Number(a.duration_hours) || 0), 0);
  const totalGEWeight = activities.reduce((s, a) => s + (Number(a.met_value) || 0) * (Number(a.duration_hours) || 0) * weight, 0);

  const calculatedFA: Record<string, number> = {
    calorimetry: tmbCalorimetry ? totalGEWeight / tmbCalorimetry : 0,
    cunningham: tmbCunningham ? totalGEWeight / tmbCunningham : 0,
    harris_benedict_male: tmbHarrisMale ? totalGEWeight / tmbHarrisMale : 0,
    harris_benedict_female: tmbHarrisFemale ? totalGEWeight / tmbHarrisFemale : 0,
  };

  const fa = faType === 'calculated' ? (calculatedFA[tmbFormula] || 1.25) : Number(manualFa) || 1.25;
  const tmbFaResult = calculateTMBFA(selectedTmb, fa);

  const addActivity = () => {
    setActivities(prev => [...prev, { activity_name: '', met_value: 1, duration_hours: 0 }]);
  };

  const removeActivity = (index: number) => {
    setActivities(prev => prev.filter((_, i) => i !== index));
  };

  const updateActivity = (index: number, key: string, value: any) => {
    setActivities(prev => prev.map((a, i) => i === index ? { ...a, [key]: value } : a));
  };

  const handleSave = () => {
    saveActivities.mutate({ consultationId, activities });
    saveConsultation.mutate({
      id: consultationId,
      tmb_formula: tmbFormula,
      calorimetry_value: calorimetryValue ? Number(calorimetryValue) : null,
      activity_factor: fa,
      activity_factor_type: faType,
    });
  };

  return (
    <div className="space-y-4">
      {/* Data availability warning */}
      {weight === 0 && (
        <Card className="border-destructive">
          <CardContent className="pt-4 pb-4 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Preencha os dados de composição corporal (peso, altura) na aba "Composição" antes de calcular a TMB.
          </CardContent>
        </Card>
      )}

      {/* TMB Formulas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Taxa Metabólica Basal (TMB)
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-sm">
                {hasMLG
                  ? 'Com dados de MLG disponíveis, Cunningham é priorizado. Calorimetria também disponível caso o atleta tenha.'
                  : 'Sem dados de bioimpedância (MLG), priorizando Harris-Benedict que usa peso, altura, idade e sexo.'}
              </TooltipContent>
            </Tooltip>
            {!hasMLG && (
              <Badge variant="outline" className="text-xs">Sem MLG — usando peso/altura/idade</Badge>
            )}
            {hasMLG && (
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary">MLG disponível</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Fórmula</TableHead>
                <TableHead className="text-xs text-center">TMB (kcal)</TableHead>
                <TableHead className="text-xs text-center">FA</TableHead>
                <TableHead className="text-xs text-center">TMB×FA+5%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Harris-Benedict always visible */}
              <TableRow className={tmbFormula === 'harris_benedict_male' ? 'bg-primary/10' : ''}>
                <TableCell className="text-xs py-2">
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={tmbFormula === 'harris_benedict_male'} onChange={() => setTmbFormula('harris_benedict_male')} />
                    Harris-Benedict (Homens)
                  </div>
                </TableCell>
                <TableCell className="text-xs text-center py-2">{tmbHarrisMale ? tmbHarrisMale.toFixed(0) : '—'}</TableCell>
                <TableCell className="text-xs text-center py-2">{fa.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-center py-2">{tmbHarrisMale ? calculateTMBFA(tmbHarrisMale, fa).toFixed(0) : '—'}</TableCell>
              </TableRow>
              <TableRow className={tmbFormula === 'harris_benedict_female' ? 'bg-primary/10' : ''}>
                <TableCell className="text-xs py-2">
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={tmbFormula === 'harris_benedict_female'} onChange={() => setTmbFormula('harris_benedict_female')} />
                    Harris-Benedict (Mulheres)
                  </div>
                </TableCell>
                <TableCell className="text-xs text-center py-2">{tmbHarrisFemale ? tmbHarrisFemale.toFixed(0) : '—'}</TableCell>
                <TableCell className="text-xs text-center py-2">{fa.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-center py-2">{tmbHarrisFemale ? calculateTMBFA(tmbHarrisFemale, fa).toFixed(0) : '—'}</TableCell>
              </TableRow>

              {/* Cunningham only when MLG available */}
              {hasMLG && (
                <TableRow className={tmbFormula === 'cunningham' ? 'bg-primary/10' : ''}>
                  <TableCell className="text-xs py-2">
                    <div className="flex items-center gap-2">
                      <input type="radio" checked={tmbFormula === 'cunningham'} onChange={() => setTmbFormula('cunningham')} />
                      Cunningham (500 + 22×MLG)
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-center py-2">{tmbCunningham.toFixed(0)}</TableCell>
                  <TableCell className="text-xs text-center py-2">{fa.toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-center py-2">{calculateTMBFA(tmbCunningham, fa).toFixed(0)}</TableCell>
                </TableRow>
              )}

              {/* Calorimetry always available as option */}
              <TableRow className={tmbFormula === 'calorimetry' ? 'bg-primary/10' : ''}>
                <TableCell className="text-xs py-2">
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={tmbFormula === 'calorimetry'} onChange={() => setTmbFormula('calorimetry')} />
                    Calorimetria Indireta
                    <Input type="number" value={calorimetryValue} onChange={e => setCalorimetryValue(e.target.value)} placeholder="kcal" className="w-24 h-7 text-xs" />
                  </div>
                </TableCell>
                <TableCell className="text-xs text-center py-2">{tmbCalorimetry || '—'}</TableCell>
                <TableCell className="text-xs text-center py-2">{fa.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-center py-2">{tmbCalorimetry ? calculateTMBFA(tmbCalorimetry, fa).toFixed(0) : '—'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* Energy Summary */}
          <div className="border-t border-border pt-3">
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Resumo Energético</h4>
            <div className="flex gap-3 flex-wrap">
              <Badge variant="outline">TMB: {selectedTmb.toFixed(0)} kcal</Badge>
              <Badge variant="outline">FA: {fa.toFixed(2)}</Badge>
              <Badge className="bg-primary/20 text-primary">TMB×FA+5% = {tmbFaResult.toFixed(0)} kcal</Badge>
              {hasMLG && <Badge variant="outline">MLG: {leanMassKg} kg</Badge>}
              <Badge variant="outline">Peso: {weight} kg</Badge>
            </div>
          </div>

          {/* FA Selection */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={faType} onValueChange={v => setFaType(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">FA Manual</SelectItem>
                <SelectItem value="calculated">FA Calculado (METs)</SelectItem>
              </SelectContent>
            </Select>
            {faType === 'manual' && (
              <Select value={String(manualFa)} onValueChange={v => setManualFa(Number(v))}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.00">Sedentária (1.00)</SelectItem>
                  <SelectItem value="1.11">Baixa atividade (1.11/1.12)</SelectItem>
                  <SelectItem value="1.25">Ativa (1.25/1.27)</SelectItem>
                  <SelectItem value="1.48">Muito Ativa (1.48/1.45)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Daily Activities */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Quadro de Atividades Diárias (Cálculo FA por METs)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Atividade</TableHead>
                <TableHead className="text-xs text-center">MET</TableHead>
                <TableHead className="text-xs text-center">Horas</TableHead>
                <TableHead className="text-xs text-center">GE (METs)</TableHead>
                <TableHead className="text-xs text-center">GE×Peso</TableHead>
                <TableHead className="text-xs w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((a, i) => {
                const ge = (Number(a.met_value) || 0) * (Number(a.duration_hours) || 0);
                const geWeight = ge * weight;
                return (
                  <TableRow key={i}>
                    <TableCell className="py-1">
                      <Input value={a.activity_name} onChange={e => updateActivity(i, 'activity_name', e.target.value)} className="h-7 text-xs" />
                    </TableCell>
                    <TableCell className="py-1">
                      <Input type="number" step="0.1" value={a.met_value} onChange={e => updateActivity(i, 'met_value', e.target.value)} className="h-7 text-xs w-16 text-center" />
                    </TableCell>
                    <TableCell className="py-1">
                      <Input type="number" step="0.5" value={a.duration_hours} onChange={e => updateActivity(i, 'duration_hours', e.target.value)} className="h-7 text-xs w-16 text-center" />
                    </TableCell>
                    <TableCell className="text-xs text-center py-1">{ge.toFixed(1)}</TableCell>
                    <TableCell className="text-xs text-center py-1">{geWeight.toFixed(0)}</TableCell>
                    <TableCell className="py-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeActivity(i)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-semibold">
                <TableCell className="text-xs py-1">TOTAL</TableCell>
                <TableCell className="text-xs text-center py-1">—</TableCell>
                <TableCell className="text-xs text-center py-1">{totalHours.toFixed(1)}</TableCell>
                <TableCell className="text-xs text-center py-1">{totalGE.toFixed(1)}</TableCell>
                <TableCell className="text-xs text-center py-1">{totalGEWeight.toFixed(0)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {faType === 'calculated' && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>FA (Harris Homens) = {calculatedFA.harris_benedict_male.toFixed(2)}</p>
              <p>FA (Harris Mulheres) = {calculatedFA.harris_benedict_female.toFixed(2)}</p>
              {hasMLG && <p>FA (Cunningham) = {calculatedFA.cunningham.toFixed(2)}</p>}
              {tmbCalorimetry > 0 && <p>FA (Calorimetria) = {calculatedFA.calorimetry.toFixed(2)}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addActivity} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Adicionar Atividade
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-1">
              <Save className="h-3.5 w-3.5" /> Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
