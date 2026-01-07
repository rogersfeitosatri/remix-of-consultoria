import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Utensils, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MealCardProps {
  mealKey: string;
  mealName: string;
  isRequired: boolean;
  isEnabled: boolean;
  onToggle?: (enabled: boolean) => void;
  data: {
    horario: string;
    comida: string;
    quantidades: string;
    bebidas: string;
    observacoes: string;
  };
  onChange: (data: MealCardProps['data']) => void;
  errors?: Record<string, string>;
}

export function MealCard({
  mealKey,
  mealName,
  isRequired,
  isEnabled,
  onToggle,
  data,
  onChange,
  errors = {},
}: MealCardProps) {
  const [isOpen, setIsOpen] = useState(isRequired || isEnabled);

  const handleChange = (field: keyof MealCardProps['data'], value: string) => {
    onChange({ ...data, [field]: value });
  };

  // For optional meals, show toggle
  if (!isRequired) {
    return (
      <Card className={`transition-all ${isEnabled ? 'border-primary/50' : 'opacity-60'}`}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{mealName}</CardTitle>
              <Badge variant="outline" className="text-xs">Opcional</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Eu faço essa refeição</span>
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => {
                  onToggle?.(checked);
                  if (checked) setIsOpen(true);
                }}
              />
            </div>
          </div>
        </CardHeader>
        
        {isEnabled && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="w-full px-6 py-2 flex items-center justify-center text-sm text-muted-foreground hover:text-foreground transition-colors border-t">
              {isOpen ? (
                <>Recolher <ChevronUp className="ml-1 h-4 w-4" /></>
              ) : (
                <>Expandir para preencher <ChevronDown className="ml-1 h-4 w-4" /></>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4 space-y-4">
                <MealFields data={data} onChange={handleChange} errors={errors} />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        )}
      </Card>
    );
  }

  // For required meals, always show expanded
  return (
    <Card className="border-primary/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Utensils className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{mealName}</CardTitle>
                <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            <MealFields data={data} onChange={handleChange} errors={errors} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function MealFields({
  data,
  onChange,
  errors,
}: {
  data: MealCardProps['data'];
  onChange: (field: keyof MealCardProps['data'], value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="h-3 w-3" />
          Horário habitual *
        </Label>
        <Input
          type="time"
          value={data.horario}
          onChange={(e) => onChange('horario', e.target.value)}
          className={errors.horario ? 'border-destructive' : ''}
        />
        {errors.horario && <p className="text-xs text-destructive">{errors.horario}</p>}
      </div>

      <div className="space-y-2">
        <Label>O que costuma comer? *</Label>
        <Textarea
          value={data.comida}
          onChange={(e) => onChange('comida', e.target.value)}
          placeholder="Descreva os alimentos que costuma comer nessa refeição..."
          rows={3}
          className={errors.comida ? 'border-destructive' : ''}
        />
        {errors.comida && <p className="text-xs text-destructive">{errors.comida}</p>}
      </div>

      <div className="space-y-2">
        <Label>Quantidades aproximadas (medidas caseiras) *</Label>
        <Textarea
          value={data.quantidades}
          onChange={(e) => onChange('quantidades', e.target.value)}
          placeholder="Ex: 2 fatias de pão, 1 colher de manteiga, 1 copo de leite..."
          rows={2}
          className={errors.quantidades ? 'border-destructive' : ''}
        />
        {errors.quantidades && <p className="text-xs text-destructive">{errors.quantidades}</p>}
      </div>

      <div className="space-y-2">
        <Label>Bebidas e quantidades *</Label>
        <Input
          value={data.bebidas}
          onChange={(e) => onChange('bebidas', e.target.value)}
          placeholder="Ex: 1 copo de suco de laranja, 200ml de café..."
          className={errors.bebidas ? 'border-destructive' : ''}
        />
        {errors.bebidas && <p className="text-xs text-destructive">{errors.bebidas}</p>}
      </div>

      <div className="space-y-2">
        <Label>Observações (opcional)</Label>
        <Textarea
          value={data.observacoes}
          onChange={(e) => onChange('observacoes', e.target.value)}
          placeholder="Fome excessiva, beliscos, doces, repetição de prato..."
          rows={2}
        />
      </div>
    </>
  );
}
