import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, Trash2, Info } from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { calculateTMBCunningham, calculateTMBHarrisBenedictMale, calculateTMBHarrisBenedictFemale, calculateTMBFA, activityFactors } from '@/lib/nutritionalCalcs';
import { metCompendium } from '@/data/metCompendium';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  consultation: any;
  consultationId: string;
}

const defaultActivities = [
  { activity_name: 'Sono', met_value: 0.9, duration_hours: 7 },
  { activity_name: 'Deitado', met_value: 1.1, duration_hours: 1.5 },
  { activity_name: 'Sentado', met_value: 1.2, duration_hours: 1 },
  { activity_name: 'Trabalho Sentado', met_value: 1.3, duration_hours: 8 },
  { activity_name: 'Caminhar', met_value: 2.9, duration_hours: 0.5 },
  { activity_name: 'Lavar Louça', met_value: 1.7, duration_hours: 0.5 },
  { activity_name: 'Tempo Restante', met_value: 1.4, duration_hours: 5.5 },
];

export function NPTMBTab({ consultation, consultationId }: Props) {
  const { fetchActivities, saveActivities, saveConsultation } = useNutritionalPeriodization();
  const { data: savedActivities = [] } = fetchActivities(consultationId);
  const [activities, setActivities] = useState<any[]>([]);
  const [tmbFormula, setTmbFormula] = useState(consultation?.tmb_formula || 'harris_benedict_male');
  const [calorimetryValue, setCalorimetryValue] = useState(consultation?.calorimetry_value || '');
  const [faType, setFaType] = useState(consultation?.activity_factor_type || 'manual');
  const [manualFa, setManualFa] = useState(consultation?.activity_factor || 1.25);

  useEffect(() => {
    if (savedActivities.length > 0) {
      setActivities(savedActivities);
    } else {
      setActivities([]);
    }
  }, [savedActivities]);

  const weight = Number(consultation?.weight) || 74;
  const height = Number(consultation?.height) || 183;
  const leanMassKg = Number(consultation?.lean_mass_kg) || 68;

  // Calculate TMBs
  const tmbCalorimetry = Number(calorimetryValue) || 0;
  const tmbCunningham = calculateTMBCunningham(leanMassKg);
  const tmbHarrisMale = calculateTMBHarrisBenedictMale(weight, height, 30);
  const tmbHarrisFemale = calculateTMBHarrisBenedictFemale(weight, height, 30);

  const tmbValues: Record<string, number> = {
    calorimetry: tmbCalorimetry,
    cunningham: tmbCunningham,
    harris_benedict_male: tmbHarrisMale,
    harris_benedict_female: tmbHarrisFemale,
  };

  const selectedTmb = tmbValues[tmbFormula] || tmbHarrisMale;

  // Calculate FA from activities
  const totalHours = activities.reduce((s, a) => s + (Number(a.duration_hours) || 0), 0);
  const totalGE = activities.reduce((s, a) => s + (Number(a.met_value) || 0) * (Number(a.duration_hours) || 0), 0);
  const totalGEWeight = activities.reduce((s, a) => s + (Number(a.met_value) || 0) * (Number(a.duration_hours) || 0) * weight, 0);

  const calculatedFA: Record<string, number> = {
    calorimetry: tmbCalorimetry ? totalGEWeight / tmbCalorimetry : 0,
    cunningham: totalGEWeight / tmbCunningham,
    harris_benedict_male: totalGEWeight / tmbHarrisMale,
    harris_benedict_female: totalGEWeight / tmbHarrisFemale,
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
      {/* TMB Formulas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Taxa Metabólica Basal (TMB)
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-sm">
                Compare diferentes fórmulas de TMB. Cunningham: 500 + 22 × MLG. Harris-Benedict usa peso, altura e idade.
              </TooltipContent>
            </Tooltip>
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
              <TableRow className={tmbFormula === 'harris_benedict_male' ? 'bg-primary/10' : ''}>
                <TableCell className="text-xs py-2">
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={tmbFormula === 'harris_benedict_male'} onChange={() => setTmbFormula('harris_benedict_male')} />
                    Harris-Benedict (Homens)
                  </div>
                </TableCell>
                <TableCell className="text-xs text-center py-2">{tmbHarrisMale.toFixed(0)}</TableCell>
                <TableCell className="text-xs text-center py-2">{fa.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-center py-2">{calculateTMBFA(tmbHarrisMale, fa).toFixed(0)}</TableCell>
              </TableRow>
              <TableRow className={tmbFormula === 'harris_benedict_female' ? 'bg-primary/10' : ''}>
                <TableCell className="text-xs py-2">
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={tmbFormula === 'harris_benedict_female'} onChange={() => setTmbFormula('harris_benedict_female')} />
                    Harris-Benedict (Mulheres)
                  </div>
                </TableCell>
                <TableCell className="text-xs text-center py-2">{tmbHarrisFemale.toFixed(0)}</TableCell>
                <TableCell className="text-xs text-center py-2">{fa.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-center py-2">{calculateTMBFA(tmbHarrisFemale, fa).toFixed(0)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

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
            <Badge className="bg-primary/20 text-primary">TMB×FA+5% = {tmbFaResult.toFixed(0)} kcal</Badge>
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
              <p>FA (Calorimetria) = {calculatedFA.calorimetry.toFixed(2)}</p>
              <p>FA (Cunningham) = {calculatedFA.cunningham.toFixed(2)}</p>
              <p>FA (Harris Homens) = {calculatedFA.harris_benedict_male.toFixed(2)}</p>
              <p>FA (Harris Mulheres) = {calculatedFA.harris_benedict_female.toFixed(2)}</p>
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
