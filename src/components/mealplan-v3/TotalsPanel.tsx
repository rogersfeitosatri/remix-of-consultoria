// Painel de totais do plano — desktop (sidebar) e mobile (sheet colapsável).
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { parseText } from '@/lib/smartPlan/parse';
import { astToMeals, planTotals } from '@/lib/smartPlan/serialize';

function fmt(n: number, digits = 0) {
  return Number.isFinite(n) ? n.toFixed(digits).replace('.', ',') : '—';
}

export function TotalsPanel({
  text, weightKg, saveState, onSave, onSendZonaNutri, sending,
  enrichedMeals, enrichedTotals,
}: {
  text: string;
  weightKg: number | null;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  onSave?: () => void;
  onSendZonaNutri?: () => void;
  sending?: boolean;
  /** Meals já enriquecidos (com calories/grams). Preferidos sobre `text`. */
  enrichedMeals?: any[];
  enrichedTotals?: { kcal: number; cho: number; ptn: number; lip: number };
}) {
  const { meals, totals } = useMemo(() => {
    if (enrichedMeals && enrichedTotals) {
      return { meals: enrichedMeals, totals: enrichedTotals };
    }
    const ast = parseText(text);
    return { meals: astToMeals(ast), totals: planTotals(ast) };
  }, [text, enrichedMeals, enrichedTotals]);

  const kg = weightKg && weightKg > 0 ? weightKg : null;
  const gkg = (v: number) => kg ? Math.round((v / kg) * 100) / 100 : null;

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Resumo do plano</CardTitle>
          <StatusBadge state={saveState} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Calorias" value={`${fmt(totals.kcal)} kcal`} sub={kg ? `${fmt(totals.kcal / kg, 1)} kcal/kg` : ''} />
          <Stat label="Peso ref." value={kg ? `${kg} kg` : '—'} sub={kg ? '' : 'Informe na aba do plano'} />
          <Stat label="Carboidratos" value={`${fmt(totals.cho)} g`} sub={gkg(totals.cho) != null ? `${fmt(gkg(totals.cho)!, 1)} g/kg` : ''} status={rangeStatus(gkg(totals.cho), 5, 7)} />
          <Stat label="Proteínas" value={`${fmt(totals.ptn)} g`} sub={gkg(totals.ptn) != null ? `${fmt(gkg(totals.ptn)!, 1)} g/kg` : ''} status={rangeStatus(gkg(totals.ptn), 1.6, 2.0)} />
          <Stat label="Gorduras" value={`${fmt(totals.lip)} g`} sub={gkg(totals.lip) != null ? `${fmt(gkg(totals.lip)!, 1)} g/kg` : ''} status={rangeStatus(gkg(totals.lip), 0.8, 1.2)} />
          <Stat label="Refeições" value={String(meals.length)} sub={`${meals.reduce((a, m: any) => a + (m.foods?.length || 0), 0)} itens`} />
        </div>
        {kg && (
          <p className="text-[10px] text-muted-foreground -mt-1">
            Faixas de referência endurance (g/kg): CHO 5–7 · PTN 1,6–2,0 · LIP 0,8–1,2
          </p>
        )}

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              Ver refeições
              <ChevronDown className="h-3 w-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-1">
            {meals.map((m: any, i) => (
              <div key={i} className="rounded border px-2 py-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="truncate">{m.horario ? `${m.horario} · ` : ''}{m.meal_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{m.foods?.length || 0}</Badge>
                </div>
                {m.meal_macros && <div className="text-[10px] text-muted-foreground mt-0.5">{m.meal_macros}</div>}
              </div>
            ))}
            {!meals.length && <p className="text-xs text-muted-foreground">Nenhuma refeição ainda. Comece digitando "07:00 — Café da manhã".</p>}
          </CollapsibleContent>
        </Collapsible>

        <div className="pt-2 flex flex-col gap-2">
          {onSave && (
            <Button size="sm" onClick={onSave} disabled={saveState === 'saving'}>
              Salvar plano
            </Button>
          )}
          {onSendZonaNutri && (
            <Button size="sm" variant="outline" onClick={onSendZonaNutri} disabled={!!sending}>
              {sending ? 'Enviando…' : 'Enviar ao Zona Nutri'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub, status }: { label: string; value: string; sub?: string; status?: 'low' | 'ok' | 'high' | null }) {
  const ring = status === 'ok' ? 'ring-1 ring-emerald-500/40 bg-emerald-500/5'
    : status === 'low' ? 'ring-1 ring-amber-500/40 bg-amber-500/5'
    : status === 'high' ? 'ring-1 ring-rose-500/40 bg-rose-500/5'
    : '';
  return (
    <div className={`rounded bg-muted/40 px-2 py-1.5 ${ring}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function rangeStatus(v: number | null, min: number, max: number): 'low' | 'ok' | 'high' | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (v < min) return 'low';
  if (v > max) return 'high';
  return 'ok';
}

function StatusBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  const map = {
    idle: { label: 'Pronto', variant: 'secondary' as const },
    saving: { label: 'Salvando…', variant: 'secondary' as const },
    saved: { label: 'Rascunho salvo', variant: 'secondary' as const },
    error: { label: 'Erro ao salvar', variant: 'destructive' as const },
  };
  const s = map[state];
  return <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>;
}
