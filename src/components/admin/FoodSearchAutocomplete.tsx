import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Sparkles, X, ChevronDown, Check, ListChecks } from 'lucide-react';
import {
  useFoodSearch,
  useFoodMeasures,
  useLookupCustomFood,
  calcNutrients,
  type FoodItem,
  type FoodMeasure,
  type SelectedFood,
} from '@/hooks/useFoodSearch';
import { supabase } from '@/integrations/supabase/client';
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
  /** Enable "Selecionar vários": pick several equivalents → primeiro vira o alimento, os demais viram substituições */
  allowMultiSelect?: boolean;
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
  allowMultiSelect,
}: FoodSearchAutoCompleteProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [multi, setMulti] = useState(false);
  const [selectedItems, setSelectedItems] = useState<FoodItem[]>([]);
  const [committing, setCommitting] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedMeasure, setSelectedMeasure] = useState<FoodMeasure | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showMeasures, setShowMeasures] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const measureButtonRef = useRef<HTMLButtonElement>(null);
  const measuresDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const [measuresStyle, setMeasuresStyle] = useState<CSSProperties>({});

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

  const getFloatingStyle = useCallback((anchor: HTMLElement, desiredHeight: number, minWidth?: number): CSSProperties => {
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
      left: Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin)),
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

  const toggleSelectItem = (food: FoodItem) => {
    setSelectedItems((prev) => prev.some((f) => f.id === food.id) ? prev.filter((f) => f.id !== food.id) : [...prev, food]);
  };

  const makeFood = (item: FoodItem, measure: FoodMeasure, qty: number, group: string): SelectedFood => {
    const weightG = measure.measure_weight_g * qty;
    const n = calcNutrients(item, weightG);
    return {
      temp_id: nextTempId(),
      food_item_id: item.id,
      name: item.name,
      group,
      measure_id: measure.id,
      measure_name: measure.measure_name,
      measure_weight_g: measure.measure_weight_g,
      quantity: qty,
      weight_g: Math.round(weightG * 10) / 10,
      calories_per_100g: item.calories_per_100g,
      ...n,
    };
  };

  // "Selecionar vários": 1º item vira o alimento; os demais viram substituições
  // com porções calculadas para equivaler às calorias do 1º.
  const handleAddMultiple = useCallback(async () => {
    if (selectedItems.length === 0) return;
    setCommitting(true);
    try {
      const ids = selectedItems.map((i) => i.id);
      const { data, error } = await (supabase as any).from('food_measures').select('*').in('food_item_id', ids);
      if (error) throw error;
      const byFood: Record<string, FoodMeasure[]> = {};
      for (const m of (data || []) as any[]) (byFood[m.food_item_id] ||= []).push(m);
      const pick = (id: string) => { const l = byFood[id] || []; return l.find((m) => m.measure_name !== 'Gramas') || l[0]; };

      const primaryItem = selectedItems[0];
      const pMeasure = pick(primaryItem.id);
      if (!pMeasure) { toast.error('Sem medidas para o alimento principal.'); return; }
      const group = defaultGroup ?? CATEGORY_TO_GROUP[primaryItem.category] ?? 'Outros';
      const primary = makeFood(primaryItem, pMeasure, 1, group);
      const targetCal = primary.calories;
      const subs: SelectedFood[] = [];
      for (const item of selectedItems.slice(1)) {
        const m = pick(item.id);
        if (!m) continue;
        let qty = 1;
        if (item.calories_per_100g > 0 && targetCal > 0) {
          const targetWeight = (targetCal / item.calories_per_100g) * 100;
          qty = Math.max(0.1, Math.round((targetWeight / m.measure_weight_g) * 10) / 10);
        }
        subs.push(makeFood(item, m, qty, group));
      }
      if (subs.length) (primary as any).substitutions = subs;
      onAddFood(primary);
      toast.success(`${primaryItem.name}${subs.length ? ` + ${subs.length} substituição(ões)` : ''} adicionado.`);
      setSelectedItems([]);
      setQuery('');
      setShowDropdown(false);
      inputRef.current?.focus();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setCommitting(false);
    }
  }, [selectedItems, defaultGroup, onAddFood]);

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
          className={`text-sm pr-8 h-10 ${compact ? 'h-9' : ''}`}
        />
        {(searching || isLooking) && (
          <Loader2 className={`absolute right-2.5 animate-spin text-muted-foreground ${compact ? 'top-1.5 h-3.5 w-3.5' : 'top-2.5 h-4 w-4'}`} />
        )}

        {/* Dropdown results */}
        {showDropdown && query.length >= 2 && !selectedFood && createPortal(
          <div ref={dropdownRef} style={dropdownStyle} className="bg-popover border rounded-lg shadow-lg overflow-y-auto">
            {allowMultiSelect && (results.length > 0 || multi) && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/40 sticky top-0">
                <span className="text-[11px] text-muted-foreground">{results.length} opções</span>
                <button
                  type="button"
                  onClick={() => { setMulti((v) => !v); setSelectedItems([]); }}
                  className={`text-[11px] font-medium flex items-center gap-1 rounded-full px-2 py-0.5 ${multi ? 'bg-primary text-primary-foreground' : 'text-primary'}`}
                >
                  <ListChecks className="h-3.5 w-3.5" /> Selecionar vários
                </button>
              </div>
            )}
            {results.length > 0 ? (
              results.map((food) => {
                const isSel = selectedItems.some((f) => f.id === food.id);
                const selIdx = selectedItems.findIndex((f) => f.id === food.id);
                return (
                <button
                  key={food.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0 flex items-start gap-2 ${isSel ? 'bg-primary/10' : ''}`}
                  onClick={() => (multi ? toggleSelectItem(food) : handleSelectFood(food))}
                >
                  {multi && (
                    <span className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSel ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                      {isSel ? (selIdx === 0 ? <span className="text-[9px] font-bold">1º</span> : <Check className="h-3 w-3" />) : null}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
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
                  </div>
                </button>
                );
              })
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

            {/* Multi-select confirm footer */}
            {multi && selectedItems.length > 0 && (
              <div className="sticky bottom-0 border-t bg-popover p-2">
                <button
                  type="button"
                  onClick={handleAddMultiple}
                  disabled={committing}
                  className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Adicionar {selectedItems.length} (1º = alimento, resto = substituições)
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
      </div>

      {/* Measure selector + quantity + preview */}
      {selectedFood && (
        <div className="p-2.5 rounded-lg border bg-muted/30 space-y-2">
          {/* Name + clear */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">{selectedFood.name}</span>
            <button
              type="button"
              onClick={() => { setSelectedFood(null); setSelectedMeasure(null); setQuery(''); }}
              className="text-muted-foreground hover:text-foreground shrink-0 p-1 -m-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quantity + measure + add */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Input
              type="number"
              min={0.1}
              step={0.5}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
              className="w-16 h-10 text-sm text-center font-medium shrink-0"
            />

            {/* Measure picker */}
            <div className="relative flex-1 min-w-[130px]">
              <Button
                ref={measureButtonRef}
                variant="outline"
                size="sm"
                className="text-xs gap-1 h-10 w-full justify-between"
                onClick={() => setShowMeasures(!showMeasures)}
              >
                <span className="truncate">{selectedMeasure?.measure_name ?? 'Medida caseira'}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {selectedMeasure && (
                    <span className="text-muted-foreground">= {Math.round(selectedMeasure.measure_weight_g * quantity)}g</span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5" />
                </span>
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
                        className={`w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b last:border-b-0 ${
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
                          <span>{mNutrients.calories} kcal</span>
                          <span>C {mNutrients.carbs_g}g</span>
                          <span>P {mNutrients.protein_g}g</span>
                          <span>G {mNutrients.fat_g}g</span>
                        </div>
                      </button>
                    );
                  })}
                </div>, document.body)
              )}
            </div>

            {/* Add button */}
            <Button
              className="gap-1 h-10 shrink-0"
              onClick={handleAdd}
              disabled={!selectedMeasure}
            >
              <Plus className="h-4 w-4" />
              {compact ? 'Add' : 'Adicionar'}
            </Button>
          </div>

          {/* Macro preview */}
          {preview && (
            <div className="flex gap-2.5 text-[11px] text-muted-foreground items-center">
              <span className="font-semibold text-foreground">{preview.calories} kcal</span>
              <span>C {preview.carbs_g}g</span>
              <span>P {preview.protein_g}g</span>
              <span>G {preview.fat_g}g</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { GROUP_TO_CATEGORIES, CATEGORY_TO_GROUP };
