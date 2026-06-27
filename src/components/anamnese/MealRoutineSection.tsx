import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Utensils } from 'lucide-react';
import { MealCard, MealData, emptyMealData } from './MealCard';

interface MealRoutineData {
  cafe_da_manha: MealData;
  lanche_manha: MealData;
  lanche_manha_enabled: boolean;
  almoco: MealData;
  lanche_tarde: MealData;
  lanche_tarde_enabled: boolean;
  jantar: MealData;
  ceia: MealData;
  ceia_enabled: boolean;
  muda_fim_de_semana: 'sim' | 'nao' | '';
  fim_de_semana_descricao: string;
}

interface MealRoutineSectionProps {
  data: MealRoutineData;
  onChange: (data: MealRoutineData) => void;
  errors: Record<string, any>;
}

export const defaultMealRoutineData: MealRoutineData = {
  cafe_da_manha: { ...emptyMealData },
  lanche_manha: { ...emptyMealData },
  lanche_manha_enabled: false,
  almoco: { ...emptyMealData },
  lanche_tarde: { ...emptyMealData },
  lanche_tarde_enabled: false,
  jantar: { ...emptyMealData },
  ceia: { ...emptyMealData },
  ceia_enabled: false,
  muda_fim_de_semana: '',
  fim_de_semana_descricao: '',
};

export function MealRoutineSection({ data, onChange, errors }: MealRoutineSectionProps) {
  const handleMealChange = (mealKey: keyof MealRoutineData, mealData: MealData) => {
    onChange({ ...data, [mealKey]: mealData });
  };

  const handleToggle = (enabledKey: keyof MealRoutineData, enabled: boolean) => {
    onChange({ ...data, [enabledKey]: enabled });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Utensils className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold">Rotina Alimentar Atual</h3>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Seja o mais específico e realista possível. Para cada refeição, informe o horário e adicione cada alimento com a porção (ex: "Arroz branco – 2 colheres de sopa"). Use medidas caseiras.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <MealCard
          mealKey="cafe_da_manha"
          mealName="Café da Manhã"
          isRequired={true}
          isEnabled={true}
          data={data.cafe_da_manha}
          onChange={(mealData) => handleMealChange('cafe_da_manha', mealData)}
          errors={errors.cafe_da_manha || {}}
        />

        <MealCard
          mealKey="lanche_manha"
          mealName="Lanche da Manhã"
          isRequired={false}
          isEnabled={data.lanche_manha_enabled}
          onToggle={(enabled) => handleToggle('lanche_manha_enabled', enabled)}
          data={data.lanche_manha}
          onChange={(mealData) => handleMealChange('lanche_manha', mealData)}
          errors={errors.lanche_manha || {}}
        />

        <MealCard
          mealKey="almoco"
          mealName="Almoço"
          isRequired={true}
          isEnabled={true}
          data={data.almoco}
          onChange={(mealData) => handleMealChange('almoco', mealData)}
          errors={errors.almoco || {}}
        />

        <MealCard
          mealKey="lanche_tarde"
          mealName="Lanche da Tarde"
          isRequired={false}
          isEnabled={data.lanche_tarde_enabled}
          onToggle={(enabled) => handleToggle('lanche_tarde_enabled', enabled)}
          data={data.lanche_tarde}
          onChange={(mealData) => handleMealChange('lanche_tarde', mealData)}
          errors={errors.lanche_tarde || {}}
        />

        <MealCard
          mealKey="jantar"
          mealName="Jantar"
          isRequired={true}
          isEnabled={true}
          data={data.jantar}
          onChange={(mealData) => handleMealChange('jantar', mealData)}
          errors={errors.jantar || {}}
        />

        <MealCard
          mealKey="ceia"
          mealName="Ceia"
          isRequired={false}
          isEnabled={data.ceia_enabled}
          onToggle={(enabled) => handleToggle('ceia_enabled', enabled)}
          data={data.ceia}
          onChange={(mealData) => handleMealChange('ceia', mealData)}
          errors={errors.ceia || {}}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Sua alimentação muda muito nos fins de semana?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={data.muda_fim_de_semana}
            onValueChange={(value) => onChange({ ...data, muda_fim_de_semana: value as 'sim' | 'nao' })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="nao" id="fds-nao" />
              <Label htmlFor="fds-nao">Não, mantenho praticamente a mesma rotina</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sim" id="fds-sim" />
              <Label htmlFor="fds-sim">Sim, minha alimentação é bem diferente</Label>
            </div>
          </RadioGroup>
          {errors.muda_fim_de_semana && (
            <p className="text-xs text-destructive">{errors.muda_fim_de_semana}</p>
          )}

          {data.muda_fim_de_semana === 'sim' && (
            <div className="space-y-2 mt-4">
              <Label>Descreva como é sua alimentação no sábado e domingo *</Label>
              <Textarea
                value={data.fim_de_semana_descricao}
                onChange={(e) => onChange({ ...data, fim_de_semana_descricao: e.target.value })}
                placeholder="Descreva suas refeições típicas de fim de semana, horários, quantidade de comida, bebidas alcoólicas, delivery, etc..."
                rows={4}
                className={errors.fim_de_semana_descricao ? 'border-destructive' : ''}
              />
              {errors.fim_de_semana_descricao && (
                <p className="text-xs text-destructive">{errors.fim_de_semana_descricao}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
