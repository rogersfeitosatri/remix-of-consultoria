import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Sparkles, X, ChevronDown } from 'lucide-react';
import {
  useFoodSearch,
  useFoodMeasures,
  useLookupCustomFood,
  calcNutrients,
  type FoodItem,
  type FoodMeasure,
  type SelectedFood,
} from '@/hooks/useFoodSearch';
import { toast } from 'sonner';

interface FoodSearchAutocompleteProps {
  onAddFood: (food: SelectedFood) => void;
  defaultGroup?: string;
}

let _tempIdCounter = 0;
function nextTempId() {
  return `food_${Date.now()}_${++_tempIdCounter}`;
}

export default function FoodSearchAutocomplete({ onAddFood, defaultGroup = '' }: FoodSearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedMeasure, setSelectedMeasure] = useState<FoodMeasure | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showMeasures, setShowMeasures] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results = [], isLoading: searching } = useFoodSearch(query);
  const { data: measures = [] } = useFoodMeasures(selectedFood?.id ?? null);
  const { lookupFood, isLooking } = useLookupCustomFood();

  useEffect(() => {
    if (measures.length > 0 && !selectedMeasure) {
      const defaultMeasure = measures.find(m => m.measure_name !== 'Gramas') || measures[0];
      setSelectedMeasure(defaultMeasure);
    }
  }, [measures, selectedMeasure]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowMeasures(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectFood = useCallback((food: FoodItem) => {
    setSelectedFood(food);
    setSelectedMeasure(null);
    setQuantity(1);
    setQuery(food.name);
    setShowDropdown(false);
  }, []);

  const handleCustomLookup = useCallback(async () => {
    if (!query.trim()) return;
    try {
      const food = await lookupFood(query.trim());
      if (food) {
        handleSelectFood(food);
        toast.success(`"${food.name}" encontrado via IA e salvo no banco.`);
      } else {
        toast.error('Não foi possível encontrar dados para esse alimento.');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  }, [query, lookupFood, handleSelectFood]);

  const handleAdd = useCallback(() => {
    if (!selectedFood || !selectedMeasure) return;
    const weightG = selectedMeasure.measure_weight_g * quantity;
    const nutrients = calcNutrients(selectedFood, weightG);

    onAddFood({
      temp_id: nextTempId(),
      food_item_id: selectedFood.id,
      name: selectedFood.name,
      group: defaultGroup,
      measure_id: selectedMeasure.id,
      measure_name: selectedMeasure.measure_name,
      measure_weight_g: selectedMeasure.measure_weight_g,
      quantity,
      weight_g: Math.round(weightG * 10) / 10,
      ...nutrients,
    });

    setQuery('');
    setSelectedFood(null);
    setSelectedMeasure(null);
    setQuantity(1);
    setShowMeasures(false);
    inputRef.current?.focus();
  }, [selectedFood, selectedMeasure, quantity, defaultGroup, onAddFood]);

  const weightG = selectedMeasure ? selectedMeasure.measure_weight_g * quantity : 0;
  const preview = selectedFood && weightG > 0 ? calcNutrients(selectedFood, weightG) : null;

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
            if (selectedFood && e.target.value !== selectedFood.name) {
              setSelectedFood(null);
              setSelectedMeasure(null);
            }
          }}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder="Digite o nome do alimento..."
          className="text-sm pr-8"
        />
        {(searching || isLooking) && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {/* Dropdown results */}
        {showDropdown && query.length >= 2 && !selectedFood && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-[280px] overflow-y-auto">
            {results.length > 0 ? (
              <>
                {results.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
                    onClick={() => handleSelectFood(food)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{food.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                        {food.category}
                      </Badge>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      <span>{food.calories_per_100g} kcal</span>
                      <span>P: {food.protein_per_100g}g</span>
                      <span>C: {food.carbs_per_100g}g</span>
                      <span>G: {food.fat_per_100g}g</span>
                      <span className="text-muted-foreground/60">por 100g</span>
                    </div>
                  </button>
                ))}
              </>
            ) : !searching ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Nenhum alimento encontrado.
              </div>
            ) : null}

            {/* AI lookup button */}
            {!searching && query.length >= 3 && (
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-t bg-primary/5"
                onClick={handleCustomLookup}
                disabled={isLooking}
              >
                <div className="flex items-center gap-2 text-sm">
                  {isLooking ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-primary" />
                  )}
                  <span className="font-medium text-primary">
                    Buscar "{query}" via IA e adicionar ao banco
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 ml-6">
                  A IA pesquisa os valores nutricionais e salva para uso futuro
                </p>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Measure selector + quantity + preview */}
      {selectedFood && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium truncate">{selectedFood.name}</span>
            <button
              type="button"
              onClick={() => { setSelectedFood(null); setSelectedMeasure(null); setQuery(''); }}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Quantity */}
            <Input
              type="number"
              min={0.1}
              step={0.5}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
              className="w-[65px] h-8 text-sm text-center"
            />

            {/* Measure picker */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 max-w-[200px]"
                onClick={() => setShowMeasures(!showMeasures)}
              >
                <span className="truncate">{selectedMeasure?.measure_name ?? 'Medida'}</span>
                {selectedMeasure && (
                  <span className="text-muted-foreground shrink-0">
                    = {Math.round(selectedMeasure.measure_weight_g * quantity)}g
                  </span>
                )}
                <ChevronDown className="h-3 w-3 shrink-0" />
              </Button>

              {showMeasures && measures.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg min-w-[260px] max-h-[200px] overflow-y-auto">
                  {measures.map((m) => {
                    const mWeight = m.measure_weight_g * quantity;
                    const mNutrients = calcNutrients(selectedFood, mWeight);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0 ${
                          selectedMeasure?.id === m.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => { setSelectedMeasure(m); setShowMeasures(false); }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{m.measure_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {quantity > 1 ? `${quantity} × ` : ''}{m.measure_weight_g}g
                            {quantity > 1 ? ` = ${Math.round(mWeight)}g` : ''}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span>C: {mNutrients.carbs_g}g</span>
                          <span>P: {mNutrients.protein_g}g</span>
                          <span>G: {mNutrients.fat_g}g</span>
                          <span>{mNutrients.calories} kcal</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Macro preview */}
            {preview && (
              <div className="flex gap-2 text-[11px] text-muted-foreground items-center">
                <span className="font-medium text-foreground">{preview.calories} kcal</span>
                <span>C: {preview.carbs_g}g</span>
                <span>P: {preview.protein_g}g</span>
                <span>G: {preview.fat_g}g</span>
              </div>
            )}

            {/* Add button */}
            <Button
              size="sm"
              className="h-8 gap-1"
              onClick={handleAdd}
              disabled={!selectedMeasure}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
