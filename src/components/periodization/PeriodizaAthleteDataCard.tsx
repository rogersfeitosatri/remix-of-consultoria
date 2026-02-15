import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, User, Calendar, Dumbbell, Target, Scale, Heart, Utensils, Zap } from 'lucide-react';
import { differenceInWeeks, format } from 'date-fns';

interface Props {
  client: any;
  consultation: any;
  athleteProfile: any;
  weeks: any[];
  onRefresh: () => void;
}

export function PeriodizaAthleteDataCard({ client, consultation, athleteProfile, weeks, onRefresh }: Props) {
  const raceDate = athleteProfile?.target_deadline || consultation?.target_race_date;
  const weeksToRace = raceDate ? Math.max(differenceInWeeks(new Date(raceDate + 'T12:00:00'), new Date()), 0) : null;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const currentWeek = weeks.find((w: any) => w.start_date <= todayStr && w.end_date >= todayStr);

  const weight = Number(consultation?.weight) || Number(athleteProfile?.current_weight) || 0;
  const height = Number(consultation?.height) || Number(athleteProfile?.height) || 0;
  const leanMassKg = Number(consultation?.lean_mass_kg) || 0;

  const items = [
    { icon: Dumbbell, label: 'Modalidade', value: consultation?.sport_modality || consultation?.training_type || '—' },
    { icon: Calendar, label: 'Início do ciclo', value: weeks[0]?.start_date ? format(new Date(weeks[0].start_date + 'T12:00:00'), 'dd/MM/yyyy') : '—' },
    { icon: Target, label: 'Prova-alvo', value: athleteProfile?.target_race || consultation?.sport_goal || '—' },
    { icon: Calendar, label: 'Data da prova', value: raceDate ? format(new Date(raceDate + 'T12:00:00'), 'dd/MM/yyyy') : '—' },
    { icon: Calendar, label: 'Semanas até prova', value: weeksToRace != null ? `${weeksToRace} semanas` : '—' },
    { icon: Zap, label: 'Fase atual', value: currentWeek?.phase_name || 'Não definida' },
    { icon: Target, label: 'Objetivo', value: athleteProfile?.main_goal || consultation?.sport_goal || '—' },
    { icon: Scale, label: 'Peso / Estatura', value: weight ? `${weight} kg / ${height ? height + ' cm' : '—'}` : '—' },
    { icon: Heart, label: 'MLG', value: leanMassKg ? `${leanMassKg.toFixed(1)} kg` : 'Não disponível' },
    { icon: Utensils, label: 'Restrições', value: athleteProfile?.food_allergies || athleteProfile?.religious_restrictions || 'Nenhuma' },
    { icon: Dumbbell, label: 'Volume semanal', value: athleteProfile?.weekly_volume_km ? `${athleteProfile.weekly_volume_km} km` : '—' },
    { icon: User, label: 'Plano', value: client?.plan_duration || client?.plan_type || '—' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" /> Dados usados pelo Periodiza
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1 text-xs h-7">
            <RefreshCw className="h-3 w-3" /> Atualizar dados para IA
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border">
              <item.icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                <p className="text-xs font-medium truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
