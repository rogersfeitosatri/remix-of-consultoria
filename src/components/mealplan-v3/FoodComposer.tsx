// Compositor guiado de alimento: alimento → medida → quantidade → confirmar.
// Fluxo previsível de teclado:
//  • Enter no campo de alimento confirma a sugestão destacada (ou a única).
//  • Enter na medida avança para a quantidade.
//  • Enter na quantidade (ou no botão Adicionar) grava o alimento.
// O Enter nunca propaga para o formulário/página nem cria item vazio, e um
// guard impede duplicidade por duplo Enter / duplo clique.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useFoodSearch,
  useFoodMeasures,
  useLookupCustomFood,
  calcNutrients,
  type FoodItem,
} from '@/hooks/useFoodSearch';
import {
  GENERIC_MEASURES,
  STEP_MESSAGE,
  buildFoodLine,
  cleanMeasureLabel,
  composerStep,
  fmtNum,
  isGramLabel,
  parseFoodLine,
  totalGrams,
  type MeasureChoice,
} from '@/lib/smartPlan/composer';

interface Props {
  /** Linha existente quando estamos EDITANDO um alimento já salvo. */
  initialLine?: string;
  /** Rótulo do contexto (ex.: "Segunda · Café da manhã · Opção 1"). */
  context?: string;
  onConfirm: (line: string) => void;
  onCancel: () => void;
}

const GRAM_CHOICES: MeasureChoice[] = [
  { key: 'unit-g', label: 'g', gramsPerUnit: 1, gramUnit: true },
  { key: 'unit-ml', label: 'ml', gramsPerUnit: 1, gramUnit: true },
];

export function FoodComposer({ initialLine, context, onConfirm, onCancel }: Props) {
  const initial = useMemo(() => (initialLine ? parseFoodLine(initialLine) : null), [initialLine]);

  const [query, setQuery] = useState(initial?.name ?? '');
  const [food, setFood] = useState<FoodItem | null>(null);
  /** Nome confirmado (do banco ou digitado livremente). */
  const [name, setName] = useState<string | null>(initial?.name ?? null);
  const [measureKey, setMeasureKey] = useState<string>('');
  const [quantity, setQuantity] = useState<string>(initial ? fmtNum(initial.quantity) : '1');
  const [activeIdx, setActiveIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const foodInputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSelectElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const search = useFoodSearch(name ? '' : query);
  const suggestions = search.data ?? [];
  const { lookupFood, isLooking } = useLookupCustomFood();
  const bankMeasures = useFoodMeasures(food?.id ?? null);

  useEffect(() => { setActiveIdx(0); }, [query, suggestions.length]);
  useEffect(() => { if (!name) foodInputRef.current?.focus(); }, [name]);

  // Ao editar um item já salvo, tenta reencontrar o alimento no banco para
  // recuperar as medidas cadastradas (sem alterar nada do que foi salvo).
  const editLookup = useFoodSearch(initial?.name && !food ? initial.name : '');
  useEffect(() => {
    if (!initial?.name || food) return;
    const rows = editLookup.data ?? [];
    const exact = rows.find((r) => r.name.toLowerCase() === initial.name.toLowerCase());
    if (exact) setFood(exact);
  }, [initial?.name, food, editLookup.data]);

  const measures: MeasureChoice[] = useMemo(() => {
    const bank = (bankMeasures.data ?? []).map((m) => ({
      key: m.id,
      label: m.measure_name,
      gramsPerUnit: Number(m.measure_weight_g) || 0,
      gramUnit: isGramLabel(m.measure_name),
      measureId: m.id,
    })).filter((m) => m.gramsPerUnit > 0);
    const generic = bank.length
      ? []
      : GENERIC_MEASURES.map((g) => ({ key: `gen-${g.name}`, label: g.name, gramsPerUnit: g.g, gramUnit: false }));
    return [...bank, ...generic, ...GRAM_CHOICES];
  }, [bankMeasures.data]);

  // Pré-seleciona a medida ao editar um item existente (mantém a escolha do nutri).
  useEffect(() => {
    if (measureKey || !initial) return;
    const label = cleanMeasureLabel(initial.measureLabel).toLowerCase();
    if (!label) return;
    if (isGramLabel(label)) {
      setMeasureKey(/ml/.test(label) ? 'unit-ml' : 'unit-g');
      setQuantity(fmtNum(initial.grams ?? initial.quantity));
      return;
    }
    const hit = measures.find((m) => cleanMeasureLabel(m.label).toLowerCase() === label)
      || measures.find((m) => cleanMeasureLabel(m.label).toLowerCase().includes(label));
    if (hit) setMeasureKey(hit.key);
  }, [measures, initial, measureKey]);

  const measure = measures.find((m) => m.key === measureKey) ?? null;
  const qtyNum = Number((quantity || '').replace(',', '.'));
  const step = composerStep({
    foodSelected: !!name,
    measureSelected: !!measure,
    quantity: isFinite(qtyNum) ? qtyNum : null,
  });

  const grams = measure ? totalGrams(qtyNum, measure) : 0;
  const nutrients = food && grams > 0 ? calcNutrients(food, grams) : null;

  const selectFood = (f: FoodItem) => {
    setFood(f);
    setName(f.name);
    setQuery(f.name);
    setError(null);
    setMeasureKey('');
    requestAnimationFrame(() => measureRef.current?.focus());
  };

  const useTypedName = () => {
    const n = query.trim();
    if (n.length < 2) { setError('Digite o nome do alimento.'); return; }
    setFood(null);
    setName(n);
    setError(null);
    setMeasureKey('');
    requestAnimationFrame(() => measureRef.current?.focus());
  };

  const aiLookup = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    try {
      const f = await lookupFood(q);
      if (!f) { toast.error('IA não encontrou esse alimento. Você pode cadastrá-lo manualmente.'); return; }
      toast.success(`Alimento cadastrado: ${f.name}`);
      selectFood(f);
    } catch {
      toast.error('Não foi possível buscar o alimento agora.');
    }
  };

  const confirm = () => {
    if (busy.current) return;
    if (!name) { setError('Selecione um alimento'); foodInputRef.current?.focus(); return; }
    if (!measure) { setError('Escolha uma medida'); measureRef.current?.focus(); return; }
    if (!isFinite(qtyNum) || qtyNum <= 0) { setError('Informe uma quantidade'); qtyRef.current?.focus(); return; }
    busy.current = true;
    const line = buildFoodLine({ name, quantity: qtyNum, measure });
    onConfirm(line);
    toast.success('Alimento adicionado à refeição', { duration: 1500 });
    // Libera o guard só no próximo tick — bloqueia duplo Enter/clique.
    setTimeout(() => { busy.current = false; }, 400);
  };

  const onFoodKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (name && measure) { confirm(); return; }
    if (suggestions.length === 1) { selectFood(suggestions[0]); return; }
    if (suggestions.length > 1) { selectFood(suggestions[activeIdx] ?? suggestions[0]); return; }
    if (query.trim().length >= 2) { useTypedName(); return; }
    setError('Selecione um alimento');
  };

  const stopEnter = (e: React.KeyboardEvent, next: () => void) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    next();
  };

  return (
    <div
      className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-2"
      onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
    >
      {context && <p className="text-[11px] text-muted-foreground truncate">{context}</p>}

      {/* Etapa 1 — alimento */}
      <div className="relative">
        <Input
          ref={foodInputRef}
          value={query}
          placeholder="Digite o alimento (ex.: banana)"
          className="h-8 text-sm"
          onChange={(e) => { setQuery(e.target.value); setName(null); setFood(null); setError(null); }}
          onKeyDown={onFoodKeyDown}
          aria-label="Nome do alimento"
        />
        {!name && query.trim().length >= 2 && (
          <div className="absolute z-30 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-popover shadow-md">
            {search.isFetching && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
              </div>
            )}
            {suggestions.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => selectFood(f)}
                className={`w-full text-left px-2 py-1.5 text-xs ${i === activeIdx ? 'bg-accent' : ''}`}
              >
                <span className="font-medium">{f.name}</span>
                <span className="ml-1 text-muted-foreground">
                  {Math.round(f.calories_per_100g)}kcal/100g
                </span>
              </button>
            ))}
            {!search.isFetching && suggestions.length === 0 && (
              <div className="px-2 py-1.5 text-xs space-y-1">
                <p className="text-muted-foreground">Alimento não encontrado no banco.</p>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="secondary" className="h-6 text-[11px]" onClick={aiLookup} disabled={isLooking}>
                    {isLooking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Cadastrar com IA
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]" onClick={useTypedName}>
                    Usar como digitei
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Etapa 2 e 3 — medida + quantidade */}
      <div className="flex items-center gap-2">
        <select
          ref={measureRef}
          value={measureKey}
          disabled={!name}
          onChange={(e) => setMeasureKey(e.target.value)}
          onKeyDown={(e) => stopEnter(e, () => qtyRef.current?.select())}
          aria-label="Medida"
          className="h-8 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
        >
          <option value="">Escolha uma medida…</option>
          {measures.map((m) => (
            <option key={m.key} value={m.key}>
              {m.gramUnit ? m.label : `${cleanMeasureLabel(m.label)} (${fmtNum(m.gramsPerUnit)}g)`}
            </option>
          ))}
        </select>
        <Input
          ref={qtyRef}
          value={quantity}
          disabled={!measure}
          inputMode="decimal"
          aria-label="Quantidade"
          className="h-8 w-20 text-sm"
          onChange={(e) => { setQuantity(e.target.value); setError(null); }}
          onKeyDown={(e) => stopEnter(e, confirm)}
        />
      </div>

      {/* Feedback do estado atual */}
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[11px] ${error ? 'text-destructive' : 'text-muted-foreground'} truncate`}>
          {error ?? (step === 'ready' && name && measure
            ? `${name} · ${fmtNum(qtyNum)} ${measure.gramUnit ? measure.label : cleanMeasureLabel(measure.label)} (${fmtNum(grams)}g)`
              + (nutrients ? ` · ${Math.round(nutrients.calories)} kcal · C${nutrients.carbs_g} P${nutrients.protein_g} G${nutrients.fat_g}` : '')
            : STEP_MESSAGE[step])}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" size="sm" className="h-7 text-xs" onClick={confirm} disabled={step !== 'ready'}>
            <Check className="h-3.5 w-3.5 mr-1" /> {initialLine ? 'Salvar' : 'Adicionar'}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
