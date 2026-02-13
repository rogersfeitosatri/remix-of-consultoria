import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Save, Info, Target } from 'lucide-react';
import { calculateAge, calculateTMBFA, calculateTMBCunningham, calculateTMBHarrisBenedictMale, calculateTMBHarrisBenedictFemale, calculateEnergyAvailability, dayLabels } from '@/lib/nutritionalCalcs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface Props {
  consultation: any;
  client: any;
  onSave: (data: any) => void;
}

export function NPPatientDataTab({ consultation, client, onSave }: Props) {
  const [form, setForm] = useState<any>({});

  // Fetch target_race from athlete_profiles
  const { data: athleteProfile } = useQuery({
    queryKey: ['athlete-profile-target-race', client?.id],
    queryFn: async () => {
      if (!client?.id) return null;
      const { data } = await supabase
        .from('athlete_profiles')
        .select('target_race, target_deadline')
        .eq('client_id', client.id)
        .maybeSingle();
      return data;
    },
    enabled: !!client?.id,
  });

  useEffect(() => {
    if (consultation) {
      const updated = { ...consultation };
      // Auto-fill sport_goal from target_race if empty
      if (!updated.sport_goal && athleteProfile?.target_race) {
        updated.sport_goal = athleteProfile.target_race;
      }
      // Auto-fill target_race_date from athlete profile if empty
      if (!updated.target_race_date && athleteProfile?.target_deadline) {
        updated.target_race_date = athleteProfile.target_deadline;
      }
      setForm(updated);
    }
  }, [consultation, athleteProfile]);

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  const age = form.consultation_date && client?.phone
    ? null // will use birth_date from athlete_profiles if available
    : null;

  // Calculate TMB based on selected formula
  const weight = Number(form.weight) || 0;
  const height = Number(form.height) || 0;
  const leanMassKg = Number(form.lean_mass_kg) || 0;
  const fa = Number(form.activity_factor) || 1.25;

  let tmb = 0;
  switch (form.tmb_formula) {
    case 'calorimetry':
      tmb = Number(form.calorimetry_value) || 0;
      break;
    case 'cunningham':
      tmb = calculateTMBCunningham(leanMassKg);
      break;
    case 'harris_benedict_female':
      tmb = calculateTMBHarrisBenedictFemale(weight, height, 30); // age placeholder
      break;
    default:
      tmb = calculateTMBHarrisBenedictMale(weight, height, 30);
  }

  const tmbFa = calculateTMBFA(tmb, fa);

  // VCT and energy availability
  const vctKeys = ['vct_monday', 'vct_tuesday', 'vct_wednesday', 'vct_thursday', 'vct_friday', 'vct_saturday', 'vct_sunday'];

  const handleSave = () => {
    onSave(form);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            Dados do Paciente
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Cadastro do atleta com dados para cálculos de composição corporal e gasto energético.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input value={client?.name || ''} disabled className="bg-muted/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data da Consulta</label>
              <Input type="date" value={form.consultation_date || ''} onChange={e => update('consultation_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Modalidade Esportiva</label>
              <Select value={form.sport_modality || ''} onValueChange={v => update('sport_modality', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrida">Corrida</SelectItem>
                  <SelectItem value="triathlon">Triathlon</SelectItem>
                  <SelectItem value="ciclismo">Ciclismo</SelectItem>
                  <SelectItem value="natacao">Natação</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Meta Esportiva</label>
              <div className="flex gap-1">
                <Input value={form.sport_goal || ''} onChange={e => update('sport_goal', e.target.value)} placeholder="Ex: Long Distance" />
                {athleteProfile?.target_race && !form.sport_goal && (
                  <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9" title="Usar prova alvo do atleta" onClick={() => update('sport_goal', athleteProfile.target_race)}>
                    <Target className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {athleteProfile?.target_race && (
                <p className="text-xs text-muted-foreground mt-0.5">Prova alvo: {athleteProfile.target_race}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data da Prova</label>
              <div className="flex gap-1">
                <Input type="date" value={form.target_race_date || ''} onChange={e => update('target_race_date', e.target.value)} />
                {athleteProfile?.target_deadline && !form.target_race_date && (
                  <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9" title="Usar data da prova alvo do atleta" onClick={() => update('target_race_date', athleteProfile.target_deadline)}>
                    <Target className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {athleteProfile?.target_deadline && (
                <p className="text-xs text-muted-foreground mt-0.5">Prazo: {new Date(athleteProfile.target_deadline + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Peso (kg)</label>
              <Input type="number" step="0.1" value={form.weight || ''} onChange={e => update('weight', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Estatura (cm)</label>
              <Input type="number" value={form.height || ''} onChange={e => update('height', e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Checkbox checked={form.has_training_plan || false} onCheckedChange={v => update('has_training_plan', v)} id="plan" />
              <label htmlFor="plan" className="text-sm">Planilha de Treino</label>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo Treino</label>
              <Select value={form.training_type || 'running'} onValueChange={v => update('training_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="running">Corrida</SelectItem>
                  <SelectItem value="triathlon">Triatlo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Body Composition */}
          <div className="border-t border-border pt-3">
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Composição Corporal</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Σ Dobras (mm)</label>
                <Input type="number" step="0.1" value={form.skinfold_sum || ''} onChange={e => update('skinfold_sum', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">% Gordura</label>
                <Input type="number" step="0.1" value={form.fat_percentage || ''} onChange={e => update('fat_percentage', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Gordura (kg)</label>
                <Input type="number" step="0.1" value={form.fat_kg || ''} onChange={e => update('fat_kg', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">% MLG</label>
                <Input type="number" step="0.1" value={form.lean_mass_percentage || ''} onChange={e => update('lean_mass_percentage', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">MLG (kg)</label>
                <Input type="number" step="0.1" value={form.lean_mass_kg || ''} onChange={e => update('lean_mass_kg', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Energy Summary */}
          <div className="border-t border-border pt-3">
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Resumo Energético</h4>
            <div className="flex gap-3 flex-wrap mb-3">
              <Badge variant="outline">TMB: {tmb.toFixed(0)} kcal</Badge>
              <Badge variant="outline">FA: {fa}</Badge>
              <Badge className="bg-primary/20 text-primary">TMB×FA+5%: {tmbFa.toFixed(0)} kcal</Badge>
            </div>
          </div>

          {/* VCT per day */}
          <div className="border-t border-border pt-3">
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-1">
              VCT Planejado (kcal/dia)
              <Tooltip>
                <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent>Valor Calórico Total planejado para a dieta de cada dia.</TooltipContent>
              </Tooltip>
            </h4>
            <div className="grid grid-cols-7 gap-2">
              {dayLabels.map((day, i) => (
                <div key={day}>
                  <label className="text-xs text-muted-foreground text-center block">{day.slice(0, 3)}</label>
                  <Input
                    type="number"
                    className="text-center text-xs"
                    value={form[vctKeys[i]] || ''}
                    onChange={e => update(vctKeys[i], Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} className="gap-1">
            <Save className="h-4 w-4" /> Salvar Dados
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
