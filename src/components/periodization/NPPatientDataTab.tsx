import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, Info, Target } from 'lucide-react';
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
        .select('target_race, target_deadline, current_weight, height, gender, birth_date')
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
      // Auto-fill weight from athlete profile if empty
      if (!updated.weight && athleteProfile?.current_weight) {
        updated.weight = athleteProfile.current_weight;
      }
      // Auto-fill height from athlete profile if empty
      if (!updated.height && athleteProfile?.height) {
        updated.height = athleteProfile.height;
      }
      setForm(updated);
    }
  }, [consultation, athleteProfile]);

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

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
                Cadastro básico do atleta. Dados de composição corporal e energia ficam nas respectivas abas.
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

          <Button onClick={handleSave} className="gap-1">
            <Save className="h-4 w-4" /> Salvar Dados
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
