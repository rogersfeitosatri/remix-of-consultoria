import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Utensils, Clock, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface MealData {
  horario: string;
  itens: string[];
  bebidas: string;
}

export const emptyMealData: MealData = {
  horario: '',
  itens: [''],
  bebidas: '',
};

interface MealCardProps {
  mealKey: string;
  mealName: string;
  isRequired: boolean;
  isEnabled: boolean;
  onToggle?: (enabled: boolean) => void;
  data: MealData;
  onChange: (data: MealData) => void;
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

  const handleFieldChange = (field: 'horario' | 'bebidas', value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleItemChange = (index: number, value: string) => {
    const newItens = [...data.itens];
    newItens[index] = value;
    onChange({ ...data, itens: newItens });
  };

  const handleAddItem = () => {
    onChange({ ...data, itens: [...data.itens, ''] });
  };

  const handleRemoveItem = (index: number) => {
    if (data.itens.length <= 1) return;
    const newItens = data.itens.filter((_, i) => i !== index);
    onChange({ ...data, itens: newItens });
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
                <MealFields
                  data={data}
                  onFieldChange={handleFieldChange}
                  onItemChange={handleItemChange}
                  onAddItem={handleAddItem}
                  onRemoveItem={handleRemoveItem}
                  errors={errors}
                />
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
            <MealFields
              data={data}
              onFieldChange={handleFieldChange}
              onItemChange={handleItemChange}
              onAddItem={handleAddItem}
              onRemoveItem={handleRemoveItem}
              errors={errors}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function MealFields({
  data,
  onFieldChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  errors,
}: {
  data: MealData;
  onFieldChange: (field: 'horario' | 'bebidas', value: string) => void;
  onItemChange: (index: number, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
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
          onChange={(e) => onFieldChange('horario', e.target.value)}
          className={errors.horario ? 'border-destructive' : ''}
        />
        {errors.horario && <p className="text-xs text-destructive">{errors.horario}</p>}
      </div>

      <div className="space-y-2">
        <Label>Alimentos e porções *</Label>
        <div className="space-y-2">
          {data.itens.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={item}
                onChange={(e) => onItemChange(index, e.target.value)}
                placeholder="Ex: Arroz branco – 2 colheres de sopa"
                className={errors.itens ? 'border-destructive' : ''}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveItem(index)}
                disabled={data.itens.length <= 1}
                className="shrink-0 h-9 w-9 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        {errors.itens && <p className="text-xs text-destructive">{errors.itens}</p>}
        <p className="text-xs text-muted-foreground">
          Use medidas caseiras: colher, fatia, copo, unidade, gramas...
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddItem}
          className="flex items-center gap-1 px-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar alimento
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Bebidas e quantidades *</Label>
        <Input
          value={data.bebidas}
          onChange={(e) => onFieldChange('bebidas', e.target.value)}
          placeholder="Ex: 1 copo de suco de laranja, 200ml de café..."
          className={errors.bebidas ? 'border-destructive' : ''}
        />
        {errors.bebidas && <p className="text-xs text-destructive">{errors.bebidas}</p>}
      </div>
    </>
  );
}
