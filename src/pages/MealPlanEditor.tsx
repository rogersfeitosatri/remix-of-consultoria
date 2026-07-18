// Página do Editor Inteligente de Plano Alimentar (Fase 2 — multi-dia).
// Rota: /meal-plans/:clientId/editor
// - "Todos os dias" é o plano base (compatível com o formato legado em
//   ai_analyses.raw_response.meal_plan.meals).
// - Overrides por dia da semana ficam em raw_response.meal_plan.day_variations
//   (mapa { mon: [meals], tue: [...], ... }). Consumidores existentes seguem
//   lendo `meals`.
// - Cada aba tem seu próprio texto e rascunho local independente.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, ExternalLink, Upload, Loader2, Sparkles, Undo2, FileDown, Copy, Trash2, Repeat,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SmartPlanEditor } from '@/components/mealplan-v3/SmartPlanEditor';
import { TotalsPanel } from '@/components/mealplan-v3/TotalsPanel';
import { useAthleteWeight } from '@/hooks/useAthleteWeight';
import { mealsToText } from '@/lib/smartPlan/fromMeals';
import { parseText } from '@/lib/smartPlan/parse';
import { astToMeals, astToText } from '@/lib/smartPlan/serialize';
import { enrichAst, makeEnrichCache } from '@/lib/smartPlan/enrich';
import { structuredAnalysisToPdfInput, downloadMealPlanPdf } from '@/lib/mealPlanPdf';

type DayKey = 'all' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const DAY_TABS: { key: DayKey; short: string; long: string }[] = [
  { key: 'all', short: 'Todos', long: 'Todos os dias' },
  { key: 'mon', short: 'Seg', long: 'Segunda' },
  { key: 'tue', short: 'Ter', long: 'Terça' },
  { key: 'wed', short: 'Qua', long: 'Quarta' },
  { key: 'thu', short: 'Qui', long: 'Quinta' },
  { key: 'fri', short: 'Sex', long: 'Sexta' },
  { key: 'sat', short: 'Sáb', long: 'Sábado' },
  { key: 'sun', short: 'Dom', long: 'Domingo' },
];

type PlanTexts = Record<DayKey, string>;

const EMPTY_TEXTS: PlanTexts = {
  all: '', mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '',
};

export default function MealPlanEditor() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: client } = useQuery({
    queryKey: ['meal-plan-editor-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id,name').eq('id', clientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: analysisRow } = useQuery({
    queryKey: ['meal-plan-editor-row', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_analyses').select('*').eq('client_id', clientId!)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  // Constrói o estado inicial a partir do banco.
  const initialTexts = useMemo<PlanTexts>(() => {
    const out: PlanTexts = { ...EMPTY_TEXTS };
    try {
      const raw = analysisRow?.raw_response as any;
      const meals = raw?.meal_plan?.meals || raw?.meals || [];
      if (Array.isArray(meals) && meals.length) out.all = mealsToText(meals);
      const variations = raw?.meal_plan?.day_variations || {};
      for (const k of Object.keys(variations)) {
        if ((DAY_TABS.map(d => d.key) as string[]).includes(k) && k !== 'all') {
          const dm = variations[k];
          if (Array.isArray(dm) && dm.length) out[k as DayKey] = mealsToText(dm);
        }
      }
    } catch { /* noop */ }
    return out;
  }, [analysisRow]);

  const draftKey = clientId ? `smart-plan-draft-v2:${clientId}` : null;
  const [texts, setTexts] = useState<PlanTexts>(() => {
    if (!draftKey) return EMPTY_TEXTS;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) return { ...EMPTY_TEXTS, ...JSON.parse(raw) };
    } catch { /* noop */ }
    return EMPTY_TEXTS;
  });
  const [activeDay, setActiveDay] = useState<DayKey>('all');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidrata do banco quando não há rascunho local.
  useEffect(() => {
    if (!analysisRow || !draftKey) return;
    try {
      if (!localStorage.getItem(draftKey)) {
        setTexts(initialTexts);
      }
    } catch { /* noop */ }
  }, [analysisRow, initialTexts, draftKey]);

  // Autosave em localStorage.
  useEffect(() => {
    if (!draftKey) return;
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(texts)); setSaveState('saved'); }
      catch { setSaveState('error'); }
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [texts, draftKey]);

  const text = texts[activeDay];
  const setText = (v: string | ((prev: string) => string)) => {
    setTexts(prev => ({
      ...prev,
      [activeDay]: typeof v === 'function' ? (v as (p: string) => string)(prev[activeDay]) : v,
    }));
  };

  const { data: weightInfo } = useAthleteWeight(clientId);
  const weightKg = weightInfo?.weightKg ?? null;

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const enrichCache = useRef(makeEnrichCache());
  const [enrichedTotalsText, setEnrichedTotalsText] = useState<string>('');

  const backupKey = `smart-plan-backup:${clientId}`;
  useEffect(() => {
    try { setHasBackup(!!localStorage.getItem(backupKey)); } catch { /* noop */ }
  }, [backupKey]);

  // Enriquecimento para o painel de totais do dia ativo.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const ast = parseText(text);
        await enrichAst(ast, enrichCache.current);
        setEnrichedTotalsText(astToText(ast));
      } catch { /* silencioso */ }
    }, 700);
    return () => clearTimeout(t);
  }, [text]);

  // Conta quais dias têm override preenchido.
  const overrideDays = useMemo(() => {
    return (DAY_TABS.filter(d => d.key !== 'all').map(d => d.key) as DayKey[])
      .filter(k => texts[k].trim().length > 0);
  }, [texts]);

  const savePlan = async () => {
    if (!clientId) return;
    try {
      setSaving(true);
      // Base (Todos os dias)
      const baseAst = parseText(texts.all);
      await enrichAst(baseAst, enrichCache.current);
      const baseMeals = astToMeals(baseAst);
      // Overrides por dia
      const dayVariations: Record<string, any> = {};
      for (const k of overrideDays) {
        const ast = parseText(texts[k]);
        await enrichAst(ast, enrichCache.current);
        dayVariations[k] = astToMeals(ast);
      }
      const currentRaw = (analysisRow?.raw_response as any) || {};
      try {
        localStorage.setItem(backupKey, JSON.stringify({
          raw_response: currentRaw,
          savedAt: new Date().toISOString(),
        }));
        setHasBackup(true);
      } catch { /* noop */ }
      const nextRaw = {
        ...currentRaw,
        meal_plan: {
          ...(currentRaw.meal_plan || {}),
          meals: baseMeals,
          day_variations: dayVariations,
        },
        editor: 'smart-plan-v3',
      };
      if (analysisRow?.id) {
        const { error } = await supabase.from('ai_analyses').update({ raw_response: nextRaw }).eq('id', analysisRow.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('ai_analyses').insert({ client_id: clientId, raw_response: nextRaw });
        if (error) throw error;
      }
      toast.success(overrideDays.length
        ? `Plano salvo (base + ${overrideDays.length} variação(ões) de dia).`
        : 'Plano salvo.');
      qc.invalidateQueries({ queryKey: ['meal-plan-editor-row', clientId] });
      qc.invalidateQueries({ queryKey: ['ai_analysis', clientId] });
    } catch (e: any) {
      toast.error(`Não foi possível salvar: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const undoSave = async () => {
    if (!clientId || !analysisRow?.id) return;
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) { toast.error('Sem backup para desfazer.'); return; }
      const { raw_response } = JSON.parse(raw);
      const { error } = await supabase.from('ai_analyses').update({ raw_response }).eq('id', analysisRow.id);
      if (error) throw error;
      // Reconstrói textos a partir do estado anterior.
      const meals = raw_response?.meal_plan?.meals || raw_response?.meals || [];
      const variations = raw_response?.meal_plan?.day_variations || {};
      const restored: PlanTexts = { ...EMPTY_TEXTS };
      if (Array.isArray(meals) && meals.length) restored.all = mealsToText(meals);
      for (const k of Object.keys(variations)) {
        if (k !== 'all' && (DAY_TABS.map(d => d.key) as string[]).includes(k)) {
          const dm = variations[k];
          if (Array.isArray(dm) && dm.length) restored[k as DayKey] = mealsToText(dm);
        }
      }
      setTexts(restored);
      localStorage.removeItem(backupKey);
      setHasBackup(false);
      toast.success('Último salvamento desfeito.');
      qc.invalidateQueries({ queryKey: ['meal-plan-editor-row', clientId] });
    } catch (e: any) {
      toast.error(`Não foi possível desfazer: ${e.message || e}`);
    }
  };

  const generateWithAI = async () => {
    if (!clientId) return;
    if (text.trim().length > 0 && !window.confirm('Isto substituirá o texto da aba atual pelo plano gerado pela IA. Continuar?')) return;
    try {
      setGenerating(true);
      const { data, error } = await supabase.functions.invoke('generate-base-plan', { body: { clientId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await qc.invalidateQueries({ queryKey: ['meal-plan-editor-row', clientId] });
      const { data: fresh } = await supabase
        .from('ai_analyses').select('raw_response').eq('client_id', clientId)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      const meals = (fresh?.raw_response as any)?.meal_plan?.meals || (fresh?.raw_response as any)?.meals || [];
      if (Array.isArray(meals) && meals.length) {
        setText(mealsToText(meals));
        toast.success('Plano gerado pela IA carregado na aba atual.');
      } else {
        toast.error('A IA não retornou refeições reconhecíveis.');
      }
    } catch (e: any) {
      toast.error(`Falha na geração: ${e.message || e}`);
    } finally {
      setGenerating(false);
    }
  };

  const importPdf = async (file: File) => {
    try {
      setImporting(true);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('client_id', clientId!);
      const { data, error } = await supabase.functions.invoke('import-meal-plan', { body: fd });
      if (error) throw error;
      const meals = (data as any)?.meals || (data as any)?.meal_plan?.meals;
      if (!Array.isArray(meals) || !meals.length) throw new Error('PDF sem refeições reconhecíveis');
      const imported = mealsToText(meals);
      setText((text ? `${text}\n\n` : '') + imported);
      toast.success(`PDF importado na aba atual: ${meals.length} refeições.`);
    } catch (e: any) {
      toast.error(`Falha ao importar: ${e.message || e}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const exportPdf = async () => {
    if (!clientId) return;
    try {
      const ast = parseText(text);
      await enrichAst(ast, enrichCache.current);
      const meals = astToMeals(ast);
      if (!meals.length) { toast.error('Nada para exportar. Escreva o plano primeiro.'); return; }
      const label = DAY_TABS.find(d => d.key === activeDay)?.long || 'Plano';
      const input = structuredAnalysisToPdfInput({ meal_plan: { meals } }, `${client?.name || 'Atleta'} — ${label}`);
      const safe = `${(client?.name || 'atleta').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${activeDay}`;
      await downloadMealPlanPdf(input, safe);
    } catch (e: any) {
      toast.error(`Falha ao exportar PDF: ${e.message || e}`);
    }
  };

  const copyFromAll = () => {
    if (activeDay === 'all') return;
    if (!texts.all.trim()) { toast.error('A aba "Todos os dias" está vazia.'); return; }
    if (text.trim().length > 0 && !window.confirm('Isto substituirá o texto da aba atual. Continuar?')) return;
    setText(texts.all);
    toast.success('Texto copiado do plano base.');
  };

  const clearDay = () => {
    if (!text.trim()) return;
    if (!window.confirm('Limpar o texto desta aba?')) return;
    setText('');
  };

  // Replicação: aba atual -> outros dias selecionados
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [replicateTargets, setReplicateTargets] = useState<DayKey[]>([]);
  const [replicateAsBase, setReplicateAsBase] = useState(false);

  const openReplicate = () => {
    if (!text.trim()) { toast.error('Aba atual está vazia.'); return; }
    setReplicateTargets([]);
    setReplicateAsBase(false);
    setReplicateOpen(true);
  };

  const applyReplicate = () => {
    const source = text;
    setTexts(prev => {
      const next = { ...prev };
      if (replicateAsBase) next.all = source;
      for (const k of replicateTargets) {
        if (k !== activeDay) next[k] = source;
      }
      return next;
    });
    const count = replicateTargets.filter(k => k !== activeDay).length + (replicateAsBase ? 1 : 0);
    toast.success(count > 0
      ? `Plano replicado em ${count} destino(s).`
      : 'Nenhum destino selecionado.');
    setReplicateOpen(false);
  };

  const toggleTarget = (k: DayKey) => {
    setReplicateTargets(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  };

  const selectAllTargets = () => {
    const all = DAY_TABS
      .filter(d => d.key !== 'all' && d.key !== activeDay)
      .map(d => d.key) as DayKey[];
    setReplicateTargets(all);
  };


  const sendToZonaNutri = async () => {
    if (!clientId) return;
    try {
      setSending(true);
      await savePlan();
      const { data, error } = await supabase.functions.invoke('send-meal-plan-to-zona-nutri', { body: { client_id: clientId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Plano enviado ao Zona Nutri.');
    } catch (e: any) {
      toast.error(`Falha no envio: ${e.message || e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto p-3 md:p-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/meal-plans/${clientId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div className="text-right">
            <h1 className="text-lg md:text-xl font-bold">Editor inteligente</h1>
            <p className="text-xs text-muted-foreground">{client?.name || '—'}</p>
          </div>
        </div>

        {/* Abas de dias */}
        <Tabs value={activeDay} onValueChange={(v) => setActiveDay(v as DayKey)} className="mb-3">
          <TabsList className="flex flex-wrap h-auto">
            {DAY_TABS.map(d => {
              const has = texts[d.key].trim().length > 0;
              return (
                <TabsTrigger key={d.key} value={d.key} className="relative">
                  <span className="hidden md:inline">{d.long}</span>
                  <span className="md:hidden">{d.short}</span>
                  {has && d.key !== 'all' && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">•</Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {activeDay === 'all'
                    ? 'Plano base — aplicado nos dias sem variação específica.'
                    : `Variação de ${DAY_TABS.find(d => d.key === activeDay)?.long}. Se vazio, o dia usa o plano base.`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,.md,.txt"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) importPdf(f); }}
                  />
                  <Button size="sm" variant="secondary" onClick={generateWithAI} disabled={generating}>
                    {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    Gerar com IA
                  </Button>
                  {activeDay !== 'all' && (
                    <Button size="sm" variant="outline" onClick={copyFromAll}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar base
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                    {importing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                    Importar PDF/MD
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportPdf}>
                    <FileDown className="h-3 w-3 mr-1" /> Exportar PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={openReplicate} disabled={!text.trim()}>
                    <Repeat className="h-3 w-3 mr-1" /> Replicar para...
                  </Button>
                  {text.trim() && (
                    <Button size="sm" variant="ghost" onClick={clearDay} title="Limpar aba">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  {hasBackup && (
                    <Button size="sm" variant="ghost" onClick={undoSave}>
                      <Undo2 className="h-3 w-3 mr-1" /> Desfazer salvamento
                    </Button>
                  )}
                  <a
                    href={`/meal-plans/${clientId}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Editor clássico <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <SmartPlanEditor value={text} onChange={setText} />
            </CardContent>
          </Card>

          <div className="lg:block">
            <TotalsPanel
              text={enrichedTotalsText || text}
              weightKg={weightKg}
              saveState={saving ? 'saving' : saveState}
              onSave={savePlan}
              onSendZonaNutri={sendToZonaNutri}
              sending={sending}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
