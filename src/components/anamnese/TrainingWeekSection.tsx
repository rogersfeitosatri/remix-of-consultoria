import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Info, Dumbbell } from 'lucide-react';

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;

const MODALIDADES = [
  { value: 'repouso', label: '😴 Repouso' },
  { value: 'corrida', label: '🏃 Corrida' },
  { value: 'ciclismo', label: '🚴 Ciclismo' },
  { value: 'natacao', label: '🏊 Natação' },
  { value: 'musculacao', label: '🏋️ Musculação' },
  { value: 'funcional', label: '⚡ Funcional' },
  { value: 'triathlon', label: '🏅 Triathlon' },
  { value: 'outro', label: '🎯 Outro' },
];

const TURNOS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
];

const INTENSIDADES = [
  { value: 'leve', label: '🟢 Leve' },
  { value: 'moderado', label: '🟡 Moderado' },
  { value: 'intenso', label: '🔴 Intenso' },
];

export interface TrainingDay {
  modalidade: string;
  turno: string;
  intensidade: string;
  longao?: boolean;
}

export type TrainingWeekData = Record<typeof DIAS[number], TrainingDay>;

export const defaultTrainingWeekData: TrainingWeekData = {
  Segunda: { modalidade: '', turno: '', intensidade: '', longao: false },
  Terça: { modalidade: '', turno: '', intensidade: '', longao: false },
  Quarta: { modalidade: '', turno: '', intensidade: '', longao: false },
  Quinta: { modalidade: '', turno: '', intensidade: '', longao: false },
  Sexta: { modalidade: '', turno: '', intensidade: '', longao: false },
  Sábado: { modalidade: '', turno: '', intensidade: '', longao: false },
  Domingo: { modalidade: '', turno: '', intensidade: '', longao: false },
};

interface TrainingWeekSectionProps {
  data: TrainingWeekData;
  onChange: (data: TrainingWeekData) => void;
}

export function TrainingWeekSection({ data, onChange }: TrainingWeekSectionProps) {
  const handleDayChange = (dia: typeof DIAS[number], field: keyof TrainingDay, value: string | boolean) => {
    const updated = { ...data, [dia]: { ...data[dia], [field]: value } };
    if (field === 'modalidade' && value === 'repouso') {
      updated[dia] = { modalidade: 'repouso', turno: '', intensidade: '', longao: false };
    }
    if (field === 'modalidade' && value !== 'corrida' && value !== 'ciclismo') {
      updated[dia] = { ...updated[dia], longao: false };
    }
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold">Rotina de Treino Semanal</h3>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Preencha como costuma ser sua semana de treinos. Coloque "Repouso" nos dias que não treina. Isso ajuda a calibrar sua nutrição em cada dia.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {DIAS.map((dia) => {
          const day = data[dia];
          const isRepouso = day.modalidade === 'repouso';
          const showLongao = day.modalidade === 'corrida' || day.modalidade === 'ciclismo';
          return (
            <Card key={dia} className={isRepouso ? 'opacity-60' : ''}>
              <CardHeader className="py-3 pb-0">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {dia}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 pb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Modalidade</p>
                    <Select
                      value={day.modalidade}
                      onValueChange={(v) => handleDayChange(dia, 'modalidade', v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MODALIDADES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Turno</p>
                    <Select
                      value={day.turno}
                      onValueChange={(v) => handleDayChange(dia, 'turno', v)}
                      disabled={isRepouso || !day.modalidade}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TURNOS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Intensidade</p>
                    <Select
                      value={day.intensidade}
                      onValueChange={(v) => handleDayChange(dia, 'intensidade', v)}
                      disabled={isRepouso || !day.modalidade}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {INTENSIDADES.map((i) => (
                          <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {showLongao && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id={`longao-${dia}`}
                      checked={!!day.longao}
                      onCheckedChange={(checked) => handleDayChange(dia, 'longao', !!checked)}
                    />
                    <Label htmlFor={`longao-${dia}`} className="cursor-pointer font-normal text-sm">
                      🐢 É o <strong>longão</strong> da semana
                      <span className="text-xs text-muted-foreground ml-1">(volume longo / sessão de resistência)</span>
                    </Label>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
