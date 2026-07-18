// IA por alimento: identifica/calcula os macros de um alimento (prévia, SEM
// cadastrar automaticamente). Mostra a sugestão + o impacto na porção atual e só
// aplica após confirmação. Opcionalmente cadastra no banco (item 4) com o
// nutricionista confirmando — registrando fonte/estimativa.
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Sparkles, Loader2, Check, Database, Search, Link2 } from 'lucide-react';

interface Food { name: string; grams?: number | null; measure?: string | null; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; food_item_id?: string; nutrient_source?: string }

export function FoodAiDialog({ food, onApply }: { food: Food; onApply: (f: Food) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sugg, setSugg] = useState<any | null>(null);
  const [bank, setBank] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  const grams = Number(food.grams) || 100;

  // Item 10: pesquisar PRIMEIRO no banco atual (por nome).
  const searchBank = async () => {
    if (!food.name?.trim()) return;
    setSearching(true); setBank(null);
    try {
      const { data } = await supabase.from('food_items' as any)
        .select('id, name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g')
        .ilike('name', `%${food.name.trim()}%`).limit(8);
      setBank((data as any[]) || []);
    } catch { setBank([]); } finally { setSearching(false); }
  };

  const linkFromBank = (item: any) => {
    const k = grams / 100;
    onApply({
      ...food, name: food.name || item.name, grams, food_item_id: item.id, nutrient_source: `Banco (${item.category || 'custom'})`,
      calories: Math.round(item.calories_per_100g * k),
      protein_g: Math.round(item.protein_per_100g * k * 10) / 10,
      carbs_g: Math.round(item.carbs_per_100g * k * 10) / 10,
      fat_g: Math.round(item.fat_per_100g * k * 10) / 10,
    });
    setOpen(false);
  };
  const scaled = sugg ? {
    calories: (sugg.calories_per_100g * grams) / 100,
    protein_g: (sugg.protein_per_100g * grams) / 100,
    carbs_g: (sugg.carbs_per_100g * grams) / 100,
    fat_g: (sugg.fat_per_100g * grams) / 100,
  } : null;

  const run = async () => {
    if (!food.name?.trim()) { toast.error('Informe o nome do alimento primeiro.'); return; }
    setLoading(true); setSugg(null);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-custom-food', { body: { foodName: food.name.trim(), preview: true } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSugg(data.food);
    } catch (e: any) { toast.error(e?.message || 'Erro na IA.'); } finally { setLoading(false); }
  };

  const applyToFood = (extra: Partial<Food> = {}) => {
    if (!sugg || !scaled) return;
    onApply({
      ...food,
      name: food.name || sugg.name,
      grams,
      calories: Math.round(scaled.calories),
      protein_g: Math.round(scaled.protein_g * 10) / 10,
      carbs_g: Math.round(scaled.carbs_g * 10) / 10,
      fat_g: Math.round(scaled.fat_g * 10) / 10,
      nutrient_source: extra.nutrient_source ?? 'IA (estimativa)',
      ...extra,
    });
    setOpen(false);
  };

  const saveToBank = async () => {
    if (!sugg || !user) return;
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase.from('food_items' as any).insert({
        name: sugg.name, category: sugg.category,
        calories_per_100g: sugg.calories_per_100g, protein_per_100g: sugg.protein_per_100g,
        carbs_per_100g: sugg.carbs_per_100g, fat_per_100g: sugg.fat_per_100g, fiber_per_100g: sugg.fiber_per_100g,
        source: 'custom', created_by: user.id,
      }).select('id').single();
      if (error) throw error;
      const measures = [...(sugg.common_measures || []).filter((m: any) => m.measure_name !== 'Gramas'), { measure_name: 'Gramas', measure_weight_g: 1 }];
      await supabase.from('food_measures' as any).insert(measures.map((m: any) => ({ food_item_id: (inserted as any).id, measure_name: m.measure_name, measure_weight_g: m.measure_weight_g })));
      toast.success('Alimento cadastrado no banco.');
      applyToFood({ food_item_id: (inserted as any).id, nutrient_source: 'Banco (custom)' });
    } catch (e: any) { toast.error(e?.message || 'Erro ao cadastrar.'); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setSugg(null); searchBank(); } }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary shrink-0" title="Buscar no banco / identificar com IA"><Sparkles className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-base">Alimento · {food.name || '—'}</DialogTitle></DialogHeader>

        {/* 1º) Banco de alimentos */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold flex items-center gap-1.5"><Search className="h-3.5 w-3.5" /> No banco de alimentos</p>
          {searching ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> buscando…</p>
          ) : bank && bank.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {bank.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-2 rounded border p-2 text-xs">
                  <span className="min-w-0"><strong className="truncate">{it.name}</strong> <span className="text-muted-foreground">· {Math.round(it.calories_per_100g)}kcal/100g</span></span>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs shrink-0" onClick={() => linkFromBank(it)}><Link2 className="h-3 w-3" /> Vincular</Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum resultado no banco. Use a IA abaixo.</p>
          )}
        </div>

        <div className="border-t pt-2">
          <p className="text-xs font-semibold flex items-center gap-1.5 mb-1"><Sparkles className="h-3.5 w-3.5" /> Identificar com IA</p>
          {!sugg && !loading && <Button size="sm" variant="outline" className="gap-1.5" onClick={run}><Sparkles className="h-4 w-4" /> Consultar IA</Button>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> consultando…</div>
        ) : sugg ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{sugg.category}</Badge>
              <span className="text-xs text-muted-foreground">Fonte: TACO/estimativa · reveja antes de aplicar</span>
            </div>
            <div className="rounded-lg border p-2.5">
              <p className="text-xs text-muted-foreground mb-1">Por 100 g</p>
              <p>{Math.round(sugg.calories_per_100g)} kcal · CHO {Math.round(sugg.carbs_per_100g)}g · PTN {Math.round(sugg.protein_per_100g)}g · LIP {Math.round(sugg.fat_per_100g)}g · Fibra {Math.round(sugg.fiber_per_100g)}g</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <p className="text-xs text-muted-foreground mb-1">Para a porção atual ({grams} g)</p>
              {scaled && <p><strong>{Math.round(scaled.calories)} kcal</strong> · CHO {Math.round(scaled.carbs_g)}g · PTN {Math.round(scaled.protein_g)}g · LIP {Math.round(scaled.fat_g)}g</p>}
              <p className="text-[11px] text-muted-foreground mt-1">Antes: {Math.round(Number(food.calories) || 0)} kcal → Depois: {scaled ? Math.round(scaled.calories) : 0} kcal</p>
            </div>
            {Array.isArray(sugg.common_measures) && sugg.common_measures.length > 0 && (
              <p className="text-xs text-muted-foreground">Medidas: {sugg.common_measures.slice(0, 4).map((m: any) => `${m.measure_name} (${m.measure_weight_g}g)`).join(', ')}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">Sem dados.</p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="outline" className="gap-1.5" onClick={saveToBank} disabled={!sugg || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Cadastrar no banco
          </Button>
          <Button className="gap-1.5" onClick={() => applyToFood()} disabled={!sugg}>
            <Check className="h-4 w-4" /> Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
