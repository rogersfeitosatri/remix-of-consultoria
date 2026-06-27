import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
}

export type TrainingWeekData = Record<typeof DIAS[number], TrainingDay>;

export const defaultTrainingWeekData: TrainingWeekData = {
  Segunda: { modalidade: '', turno: '', intensidade: '' },
  Terça: { modalidade: '', turno: '', intensidade: '' },
  Quarta: { modalidade: '', turno: '', intensidade: '' },
  Quinta: { modalidade: '', turno: '', intensidade: '' },
  Sexta: { modalidade: '', turno: '', intensidade: '' },
  Sábado: { modalidade: '', turno: '', intensidade: '' },
  Domingo: { modalidade: '', turno: '', intensidade: '' },
};

interface TrainingWeekSectionProps {
  data: TrainingWeekData;
  onChange: (data: TrainingWeekData) => void;
}

export function TrainingWeekSection({ data, onChange }: TrainingWeekSectionProps) {
  const handleDayChange = (dia: typeof DIAS[number], field: keyof TrainingDay, value: string) => {
    const updated = { ...data, [dia]: { ...data[dia], [field]: value } };
    // Se mudou para repouso, limpa turno e intensidade
    if (field === 'modalidade' && value === 'repouso') {
      updated[dia] = { modalidade: 'repouso', turno: '', intensidade: '' };
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
          return (
            <Card key={dia} className={isRepouso ? 'opacity-60' : ''}>
              <CardHeader className="py-3 pb-0">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {dia}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Modalidade */}
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
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Turno */}
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
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Intensidade */}
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
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
