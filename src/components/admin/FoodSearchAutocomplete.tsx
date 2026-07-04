import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

const CATEGORY_TO_GROUP: Record<string, string> = {
  'Cereais': 'Carboidratos',
  'Leguminosas': 'Carboidratos',
  'Carnes': 'Proteinas',
  'Laticínios': 'Proteinas',
  'Suplementos': 'Proteinas',
  'Gorduras': 'Gorduras',
  'Frutas': 'Frutas',
  'Vegetais': 'Vegetais',
  'Outros': 'Outros',
};

const GROUP_TO_CATEGORIES: Record<string, string[]> = {
  'Carboidratos': ['Cereais', 'Leguminosas'],
  'Proteinas': ['Carnes', 'Laticínios', 'Suplementos'],
  'Gorduras': ['Gorduras'],
  'Frutas': ['Frutas'],
  'Vegetais': ['Vegetais'],
  'Outros': ['Outros'],
};

export interface FoodSearchAutoCompleteProps {
  onAddFood: (food: SelectedFood) => void;
  defaultGroup?: string;
  placeholder?: string;
  /** When set, auto-calculate portion to match these calories */
  targetCalories?: number;
  /** Filter results to these food categories */
  filterCategories?: string[];
  /** Compact mode for inline substitution search */
  compact?: boolean;
}

let _tempIdCounter = 0;
function nextTempId() {
  return `food_${Date.now()}_${++_tempIdCounter}`;
}

export default function FoodSearchAutocomplete({
  onAddFood,
  defaultGroup,
  placeholder,
  targetCalories,
  filterCategories,
  compact,
}: FoodSearchAutoCompleteProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedMeasure, setSelectedMeasure] = useState<FoodMeasure | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showMeasures, setShowMeasures] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const measureButtonRef = useRef<HTMLButtonElement>(null);
  const measuresDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [measuresStyle, setMeasuresStyle] = useState<React.CSSProperties>({});

  const { data: rawResults = [], isLoading: searching } = useFoodSearch(query);
  const { data: measures = [] } = useFoodMeasures(selectedFood?.id ?? null);
  const { lookupFood, isLooking } = useLookupCustomFood();

  // Filter results by category if specified
  const results = filterCategories
    ? rawResults.filter(f => filterCategories.includes(f.category))
    : rawResults;

  // Auto-select best measure and calculate equivalent quantity when targetCalories is set
  useEffect(() => {
    if (measures.length > 0 && !selectedMeasure) {
      const defaultMeasure = measures.find(m => m.measure_name !== 'Gramas') || measures[0];
      setSelectedMeasure(defaultMeasure);

      // Auto-calc portion for target calories
      if (targetCalories && targetCalories > 0 && selectedFood && defaultMeasure) {
        const calPer100g = selectedFood.calories_per_100g;
        if (calPer100g > 0) {
          const targetWeightG = (targetCalories / calPer100g) * 100;
          const autoQty = Math.round((targetWeightG / defaultMeasure.measure_weight_g) * 10) / 10;
          setQuantity(Math.max(0.5, autoQty));
        }
      }
    }
  }, [measures, selectedMeasure, targetCalories, selectedFood]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !dropdownRef.current?.contains(target) &&
        !measuresDropdownRef.current?.contains(target)
      ) {
        setShowDropdown(false);
        setShowMeasures(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getFloatingStyle = useCallback((anchor: HTMLElement, desiredHeight: number, minWidth?: number): React.CSSProperties => {
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const shouldOpenUp = below < 160 && above > below;
    const available = Math.max(120, shouldOpenUp ? above : below);
    const maxHeight = Math.min(desiredHeight, available);
    const width = Math.max(rect.width, minWidth ?? rect.width);

    return {
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - width - margin),
      top: shouldOpenUp ? Math.max(margin, rect.top - maxHeight - 4) : rect.bottom + 4,
      width,
      maxHeight,
      zIndex: 9999,
    };
  }, []);

  const updateFloatingPositions = useCallback(() => {
    if (showDropdown && inputRef.current) {
      setDropdownStyle(getFloatingStyle(inputRef.current, 280));
    }
    if (showMeasures && measureButtonRef.current) {
      setMeasuresStyle(getFloatingStyle(measureButtonRef.current, 200, 260));
    }
  }, [getFloatingStyle, showDropdown, showMeasures]);

  useEffect(() => {
    updateFloatingPositions();
  }, [updateFloatingPositions, query, results.length, searching, selectedFood, measures.length]);

  useEffect(() => {
    if (!showDropdown && !showMeasures) return;
    window.addEventListener('scroll', updateFloatingPositions, true);
    window.addEventListener('resize', updateFloatingPositions);
    return () => {
      window.removeEventListener('scroll', updateFloatingPositions, true);
      window.removeEventListener('resize', updateFloatingPositions);
    };
  }, [showDropdown, showMeasures, updateFloatingPositions]);

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
        toast.error('Nao foi possivel encontrar dados para esse alimento.');
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
      group: defaultGroup ?? CATEGORY_TO_GROUP[selectedFood.category] ?? 'Outros',
      measure_id: selectedMeasure.id,
      measure_name: selectedMeasure.measure_name,
      measure_weight_g: selectedMeasure.measure_weight_g,
      quantity,
      weight_g: Math.round(weightG * 10) / 10,
      calories_per_100g: selectedFood.calories_per_100g,
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
    <div ref={containerRef} className={compact ? 'space-y-1' : 'space-y-2'}>
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
          placeholder={placeholder ?? "Digite o nome do alimento..."}
          className={`text-sm pr-8 ${compact ? 'h-7 text-xs' : ''}`}
        />
        {(searching || isLooking) && (
          <Loader2 className={`absolute right-2.5 animate-spin text-muted-foreground ${compact ? 'top-1.5 h-3.5 w-3.5' : 'top-2.5 h-4 w-4'}`} />
        )}

        {/* Dropdown results */}
        {showDropdown && query.length >= 2 && !selectedFood && createPortal(
          <div ref={dropdownRef} style={dropdownStyle} className="bg-popover border rounded-lg shadow-lg overflow-y-auto">
            {results.length > 0 ? (
              results.map((food) => (
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
              ))
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
          </div>,
          document.body,
        )}
      </div>

      {/* Measure selector + quantity + preview */}
      {selectedFood && (
        <div className={`flex flex-wrap items-center gap-2 ${compact ? 'p-1.5' : 'p-2.5'} rounded-lg border bg-muted/30`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`font-medium truncate ${compact ? 'text-xs' : 'text-sm'}`}>{selectedFood.name}</span>
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
              className={`w-[60px] text-sm text-center ${compact ? 'h-7' : 'h-8'}`}
            />

            {/* Measure picker */}
            <div className="relative">
              <Button
                ref={measureButtonRef}
                variant="outline"
                size="sm"
                className={`text-xs gap-1 max-w-[200px] ${compact ? 'h-7' : 'h-8'}`}
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
                createPortal(<div ref={measuresDropdownRef} style={measuresStyle} className="bg-popover border rounded-lg shadow-lg overflow-y-auto">
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
                            {quantity > 1 ? `${quantity} x ` : ''}{m.measure_weight_g}g
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
                </div>, document.body)
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
              className={`gap-1 ${compact ? 'h-7 text-xs' : 'h-8'}`}
              onClick={handleAdd}
              disabled={!selectedMeasure}
            >
              <Plus className="h-3.5 w-3.5" />
              {compact ? 'Add' : 'Adicionar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { GROUP_TO_CATEGORIES, CATEGORY_TO_GROUP };
