import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Loader2, RefreshCw, CalendarDays, Utensils, Flame } from 'lucide-react';
import {
  buildPlanV2View, dayLabel, WEEKDAY_PT, type PlanV2Stored, type BaseMeal, type MealOption,
} from '@/lib/planV2';

const PHASE_LABEL: Record<string, string> = {
  base: 'Base', build: 'Construção', specific: 'Específico', taper: 'Polimento', race_week: 'Semana da prova', post_race: 'Pós-prova', unknown: '—',
};
const FUEL_LABEL: Record<string, string> = {
  base: 'Base', reinforced: 'Reforçado', quality_session: 'Qualidade', long_run: 'Longão', carbload: 'Carbload', recovery: 'Recuperação',
};

function optionText(o: MealOption): string {
  return (o.foods || []).map((f) => `${f.name}${f.grams ? ` ${Math.round(Number(f.grams))}g` : ''}${f.measure ? ` (${f.measure})` : ''}`).join(' + ');
}

function MealBlock({ meal }: { meal: BaseMeal }) {
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{meal.name}</span>
        <span className="text-xs text-muted-foreground">{meal.defaultTime}</span>
      </div>
      <p className="text-sm">{optionText(meal.mainOption)}</p>
      {(meal.substitutions || []).length > 0 && (
        <p className="text-xs text-muted-foreground">Substituições: {meal.substitutions.map(optionText).join(' ou ')}</p>
      )}
      {(meal.generalInstructions || []).map((g, i) => <p key={i} className="text-xs text-amber-600">• {g}</p>)}
    </div>
  );
}

export function PlanV2Panel({ clientId, stored, onUpdated }: { clientId: string; stored: PlanV2Stored; onUpdated: () => void }) {
  const [tab, setTab] = useState('base');
  const view = useMemo(() => {
    try { return buildPlanV2View(stored); } catch { return null; }
  }, [stored]);

  const regen = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-base-plan', { body: { clientId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast.success('Plano-base gerado.'); onUpdated(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar'),
  });

  if (!view) return null;
  const meals = view.basePlan.meals || [];
  const mealById = Object.fromEntries(meals.map((m) => [m.id, m]));

  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Plano v2 · base + camadas</CardTitle>
          <div className="flex items-center gap-2">
            {view.daysToRace != null && <Badge variant="outline">Fase: {PHASE_LABEL[view.phase]} · {view.daysToRace}d p/ prova</Badge>}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => regen.mutate()} disabled={regen.isPending}>
              {regen.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Regerar base
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(stored as any).athlete_summary && <p className="text-sm text-muted-foreground mb-2">{(stored as any).athlete_summary}</p>}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="base"><Utensils className="h-3.5 w-3.5 mr-1" />Plano-base</TabsTrigger>
              <TabsTrigger value="week"><CalendarDays className="h-3.5 w-3.5 mr-1" />Minha semana</TabsTrigger>
              <TabsTrigger value="long"><Flame className="h-3.5 w-3.5 mr-1" />Estratégia do longão</TabsTrigger>
            </TabsList>

            <TabsContent value="base" className="space-y-2 pt-3">
              {meals.map((m) => <MealBlock key={m.id} meal={m} />)}
              {(view.basePlan.generalInstructions || []).length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <span className="text-xs font-semibold">Orientações gerais</span>
                  {view.basePlan.generalInstructions!.map((g, i) => <p key={i} className="text-xs text-muted-foreground">• {g}</p>)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="week" className="pt-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {view.weekMap.map((d) => (
                  <div key={d.weekday} className={`rounded-lg border p-3 ${d.weekday === view.todayWeekday ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{d.label}</span>
                      <div className="flex gap-1">
                        {d.isCarbload && <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">Carbload</Badge>}
                        {d.isKeySession && <Badge variant="outline" className="text-[10px]">Chave</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{dayLabel(d)} · {FUEL_LABEL[d.fuelProfile]}{d.trainingTime ? ` · ${d.trainingTime}` : ''}</p>
                    {d.mealNotes.slice(0, 2).map((n, i) => (
                      <p key={i} className="text-xs mt-1"><span className="text-muted-foreground">{mealById[n.mealId]?.name}:</span> {n.text}</p>
                    ))}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="long" className="pt-3 space-y-2">
              {view.carbload.longRunWeekday ? (
                <>
                  <p className="text-sm">Longão em <strong>{WEEKDAY_PT[view.carbload.longRunWeekday]}</strong>. Carbload de <strong>{view.carbload.numberOfDays} dia(s)</strong> em: <strong>{view.carbload.appliesOn.map((w) => WEEKDAY_PT[w]).join(', ')}</strong>.</p>
                  <p className="text-xs text-muted-foreground">Motivos: {view.carbload.reasonCodes.join(', ')}</p>
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Nos dias de carbload, as refeições usam a <strong>opção completa de carboidrato</strong> do plano-base e podem receber um <strong>bloco adicional</strong>{view.basePlan.carbBlocks?.length ? ` (${view.basePlan.carbBlocks.map((b) => b.label).join(', ')})` : ''}. Sem criar uma segunda dieta.
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-600">Dia do longão não identificado na anamnese. Complete a rotina de treinos para ativar o carbload automático.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {Array.isArray(stored.patches) && stored.patches.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de ajustes (check-in)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[...stored.patches].reverse().map((p, i) => (
              <div key={i} className="rounded-lg border p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
                  {p.carbloadChange
                    ? <Badge variant="outline" className="text-[10px]">Carbload {p.carbloadChange.fromDays}→{p.carbloadChange.toDays} dia(s)</Badge>
                    : <Badge variant="secondary" className="text-[10px]">Mantido</Badge>}
                </div>
                {p.summaryForAthlete && <p className="text-foreground">{p.summaryForAthlete}</p>}
                {p.signals?.length ? <p className="text-muted-foreground">Sinais: {p.signals.join(', ')}</p> : null}
                {p.professionalReviewRequired && <p className="text-amber-600">⚠️ Requer sua avaliação direta.</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
