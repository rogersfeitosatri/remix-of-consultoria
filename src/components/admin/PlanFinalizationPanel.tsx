// Finalização e publicação do plano (seção 13): Salvar rascunho → Aprovar →
// Finalizar (gera Markdown, congela snapshot) → Publicar para o atleta.
// Trava de auditoria (bloqueios impedem finalizar). SEM PDF. Guarda tudo no
// raw_response (plan_status, final_markdown, versões) via `persist`.
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle2, AlertTriangle, Copy, Lock, Send, Loader2, FileText } from 'lucide-react';
import { buildPlanMarkdown } from '@/lib/planMarkdown';
import { summarizePlanBase, sumFoods, type Nutrients } from '@/lib/nutritionCalc';

type PlanStatus = 'draft' | 'approved' | 'finalized' | 'published';
const STATUS_LABEL: Record<PlanStatus, string> = { draft: 'Rascunho', approved: 'Aprovado', finalized: 'Finalizado', published: 'Publicado' };

function parseMacros(s: string | undefined | null): Nutrients | null {
  if (!s) return null;
  const kcal = s.match(/(\d+(?:[.,]\d+)?)\s*kcal/i);
  const num = (l: string) => { const m = s.match(new RegExp(`(?:${l})\\s*[:=-]?\\s*(\\d+)|(\\d+)\\s*g?\\s*(?:${l})`, 'i')); return m ? parseFloat(m[1] || m[2]) : 0; };
  const calories = kcal ? parseFloat(kcal[1]) : 0;
  const c = num('CHO'), p = num('PTN|PROT'), f = num('LIP|GORD|FAT');
  if (!calories && !c && !p && !f) return null;
  return { calories, protein_g: p, carbs_g: c, fat_g: f };
}
function optionTotals(meal: any): Nutrients[] {
  const opts: any[] = Array.isArray(meal.options) && meal.options.length ? meal.options : [meal];
  return opts.map((o) => {
    const foods: any[] = Array.isArray(o.foods) ? o.foods : [];
    return foods.length
      ? sumFoods(foods.map((f) => ({ calories: +f.calories || 0, protein_g: +f.protein_g || 0, carbs_g: +f.carbs_g || 0, fat_g: +f.fat_g || 0 })))
      : (parseMacros(o.meal_macros || meal.meal_macros) || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });
}

export function PlanFinalizationPanel({ analysis, athleteWeightKg, persist, onNotify }: {
  analysis: any;
  athleteWeightKg?: number | null;
  persist: (next: any) => Promise<void>;
  onNotify?: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const status: PlanStatus = (analysis?.plan_status as PlanStatus) || 'draft';
  const finalMarkdown: string | null = analysis?.final_markdown || null;

  const summary = useMemo(() => {
    const meals: any[] = analysis?.meal_plan?.meals || [];
    return summarizePlanBase({
      meals: meals.map((m) => ({ name: m.meal_name || 'Refeição', optionTotals: optionTotals(m) })),
      weightKg: athleteWeightKg, mode: 'weekly', targetKcal: Number(analysis?.meal_plan?.daily_totals?.kcal) || null,
    });
  }, [analysis, athleteWeightKg]);

  const blocks = summary.findings.filter((f) => f.level === 'block');

  const setStatus = async (next: PlanStatus, extra: any = {}) => {
    setBusy(next);
    try {
      await persist({ ...analysis, plan_status: next, ...extra });
      toast.success(`Plano ${STATUS_LABEL[next].toLowerCase()}.`);
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setBusy(null); }
  };

  const finalize = async () => {
    if (blocks.length) { toast.error('Há bloqueios de auditoria. Corrija antes de finalizar.'); return; }
    if (!athleteWeightKg && !confirm('Sem peso registrado (g/kg indisponível). Finalizar mesmo assim?')) return;
    const md = buildPlanMarkdown(analysis, { date: new Date().toLocaleDateString('pt-BR') });
    const versionNum = (analysis?.plan_version || 0) + 1;
    const snapshot = {
      version: versionNum, finalized_at: new Date().toISOString(), finalized_by: user?.email ?? null,
      weight_kg: athleteWeightKg ?? null, markdown: md, meal_plan: analysis?.meal_plan ?? null,
    };
    await setStatus('finalized', {
      final_markdown: md, plan_version: versionNum, finalized_at: snapshot.finalized_at, finalized_by: snapshot.finalized_by,
      plan_versions: [...(Array.isArray(analysis?.plan_versions) ? analysis.plan_versions : []), snapshot],
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Finalização e publicação</CardTitle>
        <Badge variant={status === 'published' ? 'default' : 'secondary'}>{STATUS_LABEL[status]}{analysis?.plan_version ? ` · v${analysis.plan_version}` : ''}</Badge>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Auditoria */}
        <div className="text-xs">
          {blocks.length > 0 ? (
            <div className="flex items-start gap-1.5 text-red-600"><AlertTriangle className="h-3.5 w-3.5 mt-0.5" /><span>{blocks.length} bloqueio(s) de auditoria: {blocks.map((b) => b.message).join(' ')}</span></div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Auditoria sem bloqueios.</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {status === 'draft' && (
            <Button size="sm" variant="outline" onClick={() => setStatus('approved')} disabled={!!busy}>
              {busy === 'approved' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />} Aprovar prescrição
            </Button>
          )}
          {(status === 'draft' || status === 'approved') && (
            <Button size="sm" onClick={finalize} disabled={!!busy || blocks.length > 0}>
              {busy === 'finalized' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />} Finalizar (gera Markdown)
            </Button>
          )}
          {status === 'finalized' && (
            <Button size="sm" className="gap-1.5" onClick={async () => { await setStatus('published'); onNotify?.(); }} disabled={!!busy}>
              {busy === 'published' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publicar para o atleta
            </Button>
          )}
          {status === 'published' && (
            <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Publicado para o atleta.</span>
          )}
        </div>

        {(status === 'finalized' || status === 'published') && finalMarkdown && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Markdown final (saída documental)</span>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { navigator.clipboard.writeText(finalMarkdown); toast.success('Markdown copiado.'); }}>
                <Copy className="h-3 w-3" /> Copiar
              </Button>
            </div>
            <Textarea readOnly value={finalMarkdown} rows={12} className="font-mono text-xs" />
            <p className="text-[11px] text-muted-foreground">Plano finalizado não é sobrescrito: uma edição posterior deve gerar uma nova versão/rascunho. A saída final é apenas Markdown (sem PDF).</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
