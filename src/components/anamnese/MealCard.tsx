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
  // Cada alimento é um "slot" com uma ou mais opções/substituições (ex: pão OU tapioca OU cuscuz)
  itens: string[][];
  bebidas: string;
}

export const emptyMealData: MealData = {
  horario: '',
  itens: [['']],
  bebidas: '',
};

// Normaliza o formato antigo (string[]) para o novo (string[][])
export function normalizeMealItens(itens: any): string[][] {
  if (!Array.isArray(itens) || itens.length === 0) return [['']];
  return itens.map((slot) => {
    if (Array.isArray(slot)) return slot.length ? slot : [''];
    return [typeof slot === 'string' ? slot : ''];
  });
}

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

  const itens = normalizeMealItens(data.itens);

  const handleFieldChange = (field: 'horario' | 'bebidas', value: string) => {
    onChange({ ...data, [field]: value });
  };

  const update = (next: string[][]) => onChange({ ...data, itens: next });

  const handleOptionChange = (si: number, oi: number, value: string) => {
    update(itens.map((slot, i) => (i === si ? slot.map((o, j) => (j === oi ? value : o)) : slot)));
  };

  const handleAddOption = (si: number) => {
    update(itens.map((slot, i) => (i === si ? [...slot, ''] : slot)));
  };

  const handleRemoveOption = (si: number, oi: number) => {
    const next = itens.map((slot, i) => (i === si ? slot.filter((_, j) => j !== oi) : slot));
    update(next.map((slot) => (slot.length ? slot : [''])));
  };

  const handleAddItem = () => {
    update([...itens, ['']]);
  };

  const handleRemoveItem = (si: number) => {
    if (itens.length <= 1) return;
    update(itens.filter((_, i) => i !== si));
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
                  itens={itens}
                  onFieldChange={handleFieldChange}
                  onOptionChange={handleOptionChange}
                  onAddOption={handleAddOption}
                  onRemoveOption={handleRemoveOption}
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
              itens={itens}
              onFieldChange={handleFieldChange}
              onOptionChange={handleOptionChange}
              onAddOption={handleAddOption}
              onRemoveOption={handleRemoveOption}
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
  itens,
  onFieldChange,
  onOptionChange,
  onAddOption,
  onRemoveOption,
  onAddItem,
  onRemoveItem,
  errors,
}: {
  data: MealData;
  itens: string[][];
  onFieldChange: (field: 'horario' | 'bebidas', value: string) => void;
  onOptionChange: (si: number, oi: number, value: string) => void;
  onAddOption: (si: number) => void;
  onRemoveOption: (si: number, oi: number) => void;
  onAddItem: () => void;
  onRemoveItem: (si: number) => void;
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

      <div className="space-y-3">
        <Label>Alimentos e porções *</Label>
        {itens.map((slot, si) => (
          <div key={si} className="rounded-md border bg-background/60 p-2 space-y-1.5">
            {slot.map((option, oi) => (
              <div key={oi} className="flex items-center gap-2">
                {oi > 0 && <span className="text-xs text-muted-foreground font-medium shrink-0 w-7 text-center">ou</span>}
                <Input
                  value={option}
                  onChange={(e) => onOptionChange(si, oi, e.target.value)}
                  placeholder={oi === 0 ? 'Ex: Pão francês – 2 fatias' : 'Substituição. Ex: Tapioca – 1 unidade'}
                  className={errors.itens && si === 0 && oi === 0 ? 'border-destructive' : ''}
                />
                {oi > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveOption(si, oi)} className="shrink-0 h-9 w-9 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveItem(si)} disabled={itens.length <= 1} className="shrink-0 h-9 w-9 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => onAddOption(si)} className="gap-1 px-2 h-7 text-xs text-muted-foreground">
              <Plus className="h-3 w-3" /> ou (substituição)
            </Button>
          </div>
        ))}
        {errors.itens && <p className="text-xs text-destructive">{errors.itens}</p>}
        <p className="text-xs text-muted-foreground">
          Cada linha é um alimento. Use "ou (substituição)" para registrar variações que você costuma comer (ex: pão ou tapioca ou cuscuz). Use medidas caseiras: colher, fatia, copo, unidade, gramas...
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
