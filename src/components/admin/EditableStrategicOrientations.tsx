import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Save, X, Plus, Trash2, Loader2, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSaveWorkingPlan } from '@/hooks/useWorkingPlan';

interface Supp { supplement: string; recommendation: string }

export function EditableStrategicOrientations({
  analysis,
  clientId,
  onUpdated,
}: {
  analysis: any;
  clientId: string;
  onUpdated: () => void;
}) {
  const so = analysis?.strategic_orientations || {};
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveWorkingPlan = useSaveWorkingPlan();

  const [summary, setSummary] = useState<string>(analysis?.athlete_summary || '');
  const [mealRoutine, setMealRoutine] = useState<string[]>(so.meal_routine || []);
  const [training, setTraining] = useState<string[]>(so.training_strategy || []);
  const [supps, setSupps] = useState<Supp[]>(so.supplementation || []);
  const [raceContext, setRaceContext] = useState<string>(so.race_context || '');

  const reset = () => {
    setSummary(analysis?.athlete_summary || '');
    setMealRoutine(so.meal_routine || []);
    setTraining(so.training_strategy || []);
    setSupps(so.supplementation || []);
    setRaceContext(so.race_context || '');
  };

  const save = async () => {
    setSaving(true);
    try {
      const cleanList = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);
      const cleanSupps = supps.map((s) => ({ supplement: s.supplement.trim(), recommendation: s.recommendation.trim() })).filter((s) => s.supplement);
      const newSo = {
        meal_routine: cleanList(mealRoutine),
        training_strategy: cleanList(training),
        supplementation: cleanSupps,
        race_context: raceContext.trim(),
      };
      // ETAPA 6B: orientações oficiais vão para o núcleo canônico (meal_plan_versions).
      // `diagnosis` (resumo do atleta) continua em ai_analyses — não é plano.
      await saveWorkingPlan({
        clientId,
        raw: { ...analysis, strategic_orientations: newSo },
        source: 'classic_editor',
      });
      const { error } = await supabase
        .from('ai_analyses')
        .update({
          diagnosis: summary.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', clientId);
      if (error) throw error;
      toast.success('Orientações salvas.');
      setEditing(false);
      onUpdated();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const ListEditor = ({ items, setItems, placeholder }: { items: string[]; setItems: (v: string[]) => void; placeholder: string }) => (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Textarea
            value={it}
            onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="text-sm min-h-[38px]"
            rows={1}
          />
          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => setItems(items.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setItems([...items, ''])}>
        <Plus className="h-3.5 w-3.5" /> Adicionar {placeholder}
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Orientações e Suplementação
          </CardTitle>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => { reset(); setEditing(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { reset(); setEditing(false); }} disabled={saving}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {editing ? (
          <>
            <Field label="Resumo do atleta">
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="text-sm" rows={3} />
            </Field>
            <Field label="Rotina alimentar"><ListEditor items={mealRoutine} setItems={setMealRoutine} placeholder="orientação" /></Field>
            <Field label="Estratégia de treino"><ListEditor items={training} setItems={setTraining} placeholder="estratégia" /></Field>
            <Field label="Suplementação">
              <div className="space-y-2">
                {supps.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={s.supplement} placeholder="Suplemento" onChange={(e) => setSupps(supps.map((x, j) => (j === i ? { ...x, supplement: e.target.value } : x)))} className="text-sm w-40 shrink-0" />
                    <Input value={s.recommendation} placeholder="Recomendação" onChange={(e) => setSupps(supps.map((x, j) => (j === i ? { ...x, recommendation: e.target.value } : x)))} className="text-sm" />
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => setSupps(supps.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSupps([...supps, { supplement: '', recommendation: '' }])}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar suplemento
                </Button>
              </div>
            </Field>
            <Field label="Contexto de prova">
              <Textarea value={raceContext} onChange={(e) => setRaceContext(e.target.value)} className="text-sm" rows={2} />
            </Field>
          </>
        ) : (
          <ReadView summary={summary} mealRoutine={mealRoutine} training={training} supps={supps} raceContext={raceContext} />
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
      {children}
    </div>
  );
}

function ReadView({ summary, mealRoutine, training, supps, raceContext }: { summary: string; mealRoutine: string[]; training: string[]; supps: Supp[]; raceContext: string }) {
  const hasAny = summary || mealRoutine.length || training.length || supps.length || raceContext;
  if (!hasAny) return <p className="text-sm text-muted-foreground py-2">Nenhuma orientação cadastrada. Clique em Editar para adicionar.</p>;
  return (
    <div className="space-y-4 text-sm">
      {summary && <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Resumo</p><p className="text-muted-foreground whitespace-pre-wrap">{summary}</p></div>}
      {mealRoutine.length > 0 && <Bullets title="Rotina alimentar" items={mealRoutine} />}
      {training.length > 0 && <Bullets title="Estratégia de treino" items={training} />}
      {supps.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Suplementação</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {supps.map((s, i) => (
              <div key={i} className="rounded-lg border p-2.5"><p className="font-medium">{s.supplement}</p><p className="text-xs text-muted-foreground mt-0.5">{s.recommendation}</p></div>
            ))}
          </div>
        </div>
      )}
      {raceContext && <div><p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Contexto de prova</p><p className="text-muted-foreground whitespace-pre-wrap">{raceContext}</p></div>}
    </div>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2"><span className="text-primary">•</span><span className="text-muted-foreground flex-1">{it}</span></li>
        ))}
      </ul>
    </div>
  );
}
