// IA por refeição: torna as opções equivalentes / ajusta proteína/carbo.
// Mostra a prévia (opções + totais, antes→depois) e só aplica após aprovação.
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wand2, Loader2, Check } from 'lucide-react';
import { sumFoods, type Nutrients } from '@/lib/nutritionCalc';

interface Option { label?: string; foods: any[] }

const ACTIONS = [
  { key: 'equalize_options', label: 'Tornar opções equivalentes' },
  { key: 'adjust_protein', label: 'Ajustar proteína' },
  { key: 'adjust_carb', label: 'Ajustar carboidrato' },
  { key: 'reduce_kcal', label: 'Reduzir calorias' },
];

function totals(foods: any[]): Nutrients {
  return sumFoods((foods || []).map((f) => ({ calories: +f.calories || 0, protein_g: +f.protein_g || 0, carbs_g: +f.carbs_g || 0, fat_g: +f.fat_g || 0 })));
}

export function MealAiDialog({ meal, weightKg, targetKcal, onApply }: {
  meal: { meal_name: string; horario?: string; options: Option[] };
  weightKg?: number | null; targetKcal?: number | null;
  onApply: (options: Option[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<Option[] | null>(null);

  const before = totals(meal.options?.[0]?.foods || []);

  const run = async (instruction: string) => {
    setLoading(instruction); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('adjust-meal-ai', {
        body: { meal, instruction, weightKg, targetKcal },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data.options || []);
    } catch (e: any) { toast.error(e?.message || 'Erro na IA.'); } finally { setLoading(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Ajustar refeição com IA"><Wand2 className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="text-base">IA · {meal.meal_name}</DialogTitle></DialogHeader>

        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <Button key={a.key} size="sm" variant="outline" className="gap-1.5" onClick={() => run(a.key)} disabled={!!loading}>
              {loading === a.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {a.label}
            </Button>
          ))}
        </div>

        {result && (
          <div className="space-y-2 text-sm max-h-[50vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground">Antes (Opção 1): {Math.round(before.calories)} kcal · CHO {Math.round(before.carbs_g)}g · PTN {Math.round(before.protein_g)}g · GORD {Math.round(before.fat_g)}g</p>
            {result.map((o, i) => {
              const t = totals(o.foods);
              return (
                <div key={i} className="rounded-lg border p-2.5">
                  <p className="text-xs font-semibold">{o.label || `Opção ${i + 1}`}</p>
                  <ul className="mt-1 space-y-0.5">
                    {o.foods.map((f, j) => (
                      <li key={j} className="text-xs">• {f.name}{f.grams ? ` — ${Math.round(f.grams)} g` : f.measure ? ` — ${f.measure}` : ''}{(f.substitutions || []).length ? ` (ou ${f.substitutions.join('; ')})` : ''}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-1">{Math.round(t.calories)} kcal · CHO {Math.round(t.carbs_g)}g · PTN {Math.round(t.protein_g)}g · GORD {Math.round(t.fat_g)}g</p>
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground">Revise antes de aplicar. Alimentos sem correspondência no banco vêm como estimativa (0 até completar).</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className="gap-1.5" disabled={!result} onClick={() => { if (result) { onApply(result); setOpen(false); toast.success('Refeição atualizada.'); } }}>
            <Check className="h-4 w-4" /> Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
