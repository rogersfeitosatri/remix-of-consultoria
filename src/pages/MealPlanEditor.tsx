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
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, ExternalLink, Upload, Loader2, Sparkles, Undo2, FileDown, Copy, Trash2, Repeat, ClipboardCheck, Plus, Scale, CalendarDays, FileText,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SmartPlanEditor } from '@/components/mealplan-v3/SmartPlanEditor';
import { MealCardsView } from '@/components/mealplan-v3/MealCardsView';
import { TotalsPanel } from '@/components/mealplan-v3/TotalsPanel';
import { useAthleteWeight } from '@/hooks/useAthleteWeight';
import { mealsToText } from '@/lib/smartPlan/fromMeals';
import { parseText } from '@/lib/smartPlan/parse';
import { astToMeals, astToText } from '@/lib/smartPlan/serialize';
import { enrichAst, makeEnrichCache } from '@/lib/smartPlan/enrich';
import { structuredAnalysisToPdfInput, downloadMealPlanPdf } from '@/lib/mealPlanPdf';
import { WeekOverview } from '@/components/mealplan-v3/WeekOverview';
import { useRecordSubstitutions } from '@/hooks/useSubstitutionHistory';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AnamneseResponseSection } from '@/components/admin/AnamneseResponseSection';

type DayKey = 'all' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

const DAY_TABS: { key: DayKey; short: string; long: string }[] = [
  { key: 'all', short: 'Todos', long: 'Todos os dias' },
  { key: 'seg', short: 'Seg', long: 'Segunda' },
  { key: 'ter', short: 'Ter', long: 'Terça' },
  { key: 'qua', short: 'Qua', long: 'Quarta' },
  { key: 'qui', short: 'Qui', long: 'Quinta' },
  { key: 'sex', short: 'Sex', long: 'Sexta' },
  { key: 'sab', short: 'Sáb', long: 'Sábado' },
  { key: 'dom', short: 'Dom', long: 'Domingo' },
];

type PlanTexts = Record<DayKey, string>;

const EMPTY_TEXTS: PlanTexts = {
  all: '', seg: '', ter: '', qua: '', qui: '', sex: '', sab: '', dom: '',
};

// Botão de barra de ferramentas: ícone com tooltip. Mobile 32×32; desktop 64×64.
function ToolIconButton({
  label, children, onClick, disabled, loading, variant = 'outline',
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'outline' | 'secondary' | 'ghost';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={variant}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="h-8 w-8 shrink-0 lg:h-16 lg:w-16 [&_svg]:h-4 [&_svg]:w-4 lg:[&_svg]:h-6 lg:[&_svg]:w-6"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin lg:h-6 lg:w-6" /> : children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}


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
  const [enrichedMeals, setEnrichedMeals] = useState<any[] | undefined>(undefined);
  const [enrichedTotals, setEnrichedTotals] = useState<{ kcal: number; cho: number; ptn: number; lip: number } | undefined>(undefined);
  const [enrichedTotalsByDay, setEnrichedTotalsByDay] = useState<Partial<Record<DayKey, { kcal: number; cho: number; ptn: number; lip: number }>>>({});

  const backupKey = `smart-plan-backup:${clientId}`;
  useEffect(() => {
    try { setHasBackup(!!localStorage.getItem(backupKey)); } catch { /* noop */ }
  }, [backupKey]);

  // Enriquecimento para o painel de totais do dia ativo — recalcula g e macros
  // toda vez que o texto muda (inclusive edições de quantidade).
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const ast = parseText(text);
        await enrichAst(ast, enrichCache.current);
        const { astToMeals, planTotals } = await import('@/lib/smartPlan/serialize');
        const meals = astToMeals(ast);
        const totals = planTotals(ast);
        setEnrichedMeals(meals);
        setEnrichedTotals(totals);
        setEnrichedTotalsText(astToText(ast));
        // Espelha os totais do dia ativo no mapa semanal para atualização
        // instantânea do WeekOverview sem esperar o efeito de todos os dias.
        setEnrichedTotalsByDay((prev) => ({ ...prev, [activeDay]: totals }));
      } catch { /* silencioso */ }
    }, 400);
    return () => clearTimeout(t);
  }, [text, activeDay]);

  // Enriquecimento em segundo plano para TODOS os dias com override + base,
  // permitindo que o WeekOverview mostre kcal/macros reais em tempo real.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { planTotals } = await import('@/lib/smartPlan/serialize');
        const entries: [DayKey, { kcal: number; cho: number; ptn: number; lip: number }][] = [];
        const daysToScan: DayKey[] = ['all', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
        for (const k of daysToScan) {
          const txt = texts[k];
          if (!txt || !txt.trim()) continue;
          const ast = parseText(txt);
          await enrichAst(ast, enrichCache.current);
          entries.push([k, planTotals(ast)]);
        }
        setEnrichedTotalsByDay((prev) => {
          const next = { ...prev };
          for (const [k, v] of entries) next[k] = v;
          return next;
        });
      } catch { /* silencioso */ }
    }, 700);
    return () => clearTimeout(t);
  }, [texts]);


  // Conta quais dias têm override preenchido.
  const overrideDays = useMemo(() => {
    return (DAY_TABS.filter(d => d.key !== 'all').map(d => d.key) as DayKey[])
      .filter(k => texts[k].trim().length > 0);
  }, [texts]);

  const recordSubs = useRecordSubstitutions();

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
      const dayAsts = [baseAst];
      for (const k of overrideDays) {
        const ast = parseText(texts[k]);
        await enrichAst(ast, enrichCache.current);
        dayVariations[k] = astToMeals(ast);
        dayAsts.push(ast);
      }
      // Registra as substituições usadas — a IA aprende com o histórico.
      void recordSubs(dayAsts);
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

  // Salva o conteúdo atual como PROPOSTA (pending_update) — o admin aplica/desfaz
  // depois na página de detalhe do plano (MealPlanDetail).
  const saveAsProposal = async () => {
    if (!clientId || !analysisRow?.id) { toast.error('Salve o plano ao menos uma vez antes de propor.'); return; }
    try {
      setSaving(true);
      const baseAst = parseText(texts.all);
      await enrichAst(baseAst, enrichCache.current);
      const baseMeals = astToMeals(baseAst);
      const dayVariations: Record<string, any> = {};
      for (const k of overrideDays) {
        const ast = parseText(texts[k]);
        await enrichAst(ast, enrichCache.current);
        dayVariations[k] = astToMeals(ast);
      }
      const currentRaw = (analysisRow?.raw_response as any) || {};
      const pending_update = {
        source: 'smart-plan-v3',
        created_at: new Date().toISOString(),
        meal_plan: {
          ...(currentRaw.meal_plan || {}),
          meals: baseMeals,
          day_variations: dayVariations,
        },
      };
      const nextRaw = { ...currentRaw, pending_update };
      const { error } = await supabase.from('ai_analyses').update({ raw_response: nextRaw }).eq('id', analysisRow.id);
      if (error) throw error;
      toast.success('Proposta salva. Abra o plano do atleta e clique em "Aplicar ajustes".');
      qc.invalidateQueries({ queryKey: ['meal-plan-editor-row', clientId] });
      qc.invalidateQueries({ queryKey: ['ai_analysis', clientId] });
    } catch (e: any) {
      toast.error(`Falha ao salvar proposta: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  // Insere um esqueleto de refeição no final do texto da aba atual.
  const insertMealSkeleton = (name: string, time: string) => {
    const skeleton = `@ ${time} ${name}\n`;
    setText(prev => {
      const sep = prev.length === 0 ? '' : (prev.endsWith('\n\n') ? '' : prev.endsWith('\n') ? '\n' : '\n\n');
      return prev + sep + skeleton;
    });
  };
  const QUICK_MEALS: { label: string; time: string }[] = [
    { label: 'Café da manhã', time: '07:00' },
    { label: 'Lanche da manhã', time: '10:00' },
    { label: 'Pré-treino', time: '11:30' },
    { label: 'Almoço', time: '12:30' },
    { label: 'Pós-treino', time: '15:00' },
    { label: 'Lanche da tarde', time: '16:30' },
    { label: 'Jantar', time: '19:30' },
    { label: 'Ceia', time: '22:00' },
  ];

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

  // Item 2 — Exportar semana inteira em um único PDF. Para cada dia usa a
  // variação, se existir; caso contrário, cai no plano base. Prefixa o nome de
  // cada refeição com o dia da semana para manter tudo em um documento único.
  const exportWeekPdf = async () => {
    if (!clientId) return;
    try {
      const days = DAY_TABS.filter(d => d.key !== 'all');
      const allMeals: any[] = [];
      for (const d of days) {
        const src = texts[d.key].trim() ? texts[d.key] : texts.all;
        if (!src.trim()) continue;
        const ast = parseText(src);
        await enrichAst(ast, enrichCache.current);
        const meals = astToMeals(ast);
        for (const m of meals) {
          allMeals.push({ ...m, meal_name: `${d.long} • ${m.meal_name}` });
        }
      }
      if (!allMeals.length) { toast.error('Nada para exportar na semana.'); return; }
      const input = structuredAnalysisToPdfInput(
        { meal_plan: { meals: allMeals } },
        `${client?.name || 'Atleta'} — Semana completa`,
      );
      const safe = `${(client?.name || 'atleta').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_semana`;
      await downloadMealPlanPdf(input, safe);
      toast.success('PDF da semana gerado.');
    } catch (e: any) {
      toast.error(`Falha ao exportar semana: ${e.message || e}`);
    }
  };

  // Item 6 — Ajuste automático por g/kg alvo. Escala as quantidades dos
  // alimentos da aba ativa para atingir o alvo do macro escolhido. Como a
  // escala é proporcional a TODOS os tokens, os outros macros mudam junto —
  // isso é intencional: mantém a proporção do plano montado pelo nutri.
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMacro, setAdjustMacro] = useState<'cho' | 'ptn' | 'lip'>('cho');
  const [adjustTargetGkg, setAdjustTargetGkg] = useState<string>('6');
  const [adjustPreview, setAdjustPreview] = useState<{ current: number; factor: number } | null>(null);

  const openAdjust = async () => {
    if (!weightKg) { toast.error('Peso do atleta não disponível para calcular g/kg.'); return; }
    if (!text.trim()) { toast.error('Aba atual está vazia.'); return; }
    setAdjustPreview(null);
    setAdjustOpen(true);
  };

  const computeAdjustPreview = async () => {
    try {
      if (!weightKg) return;
      const target = Number(String(adjustTargetGkg).replace(',', '.'));
      if (!isFinite(target) || target <= 0) { toast.error('Informe um alvo válido.'); return; }
      const ast = parseText(text);
      await enrichAst(ast, enrichCache.current);
      let sum = 0;
      for (const m of ast.meals) for (const g of m.groups) for (const t of g.tokens) {
        // Só o alimento principal (primeiro token) conta — substituições são opcionais.
        if (g.tokens[0] === t) {
          const macro = adjustMacro === 'cho' ? (t.carbs_g || 0) : adjustMacro === 'ptn' ? (t.protein_g || 0) : (t.fat_g || 0);
          sum += macro;
        }
      }
      const currentGkg = sum / weightKg;
      const factor = currentGkg > 0 ? target / currentGkg : 0;
      setAdjustPreview({ current: currentGkg, factor });
    } catch (e: any) {
      toast.error(`Falha ao calcular: ${e.message || e}`);
    }
  };

  const applyAdjust = async () => {
    try {
      if (!adjustPreview || !isFinite(adjustPreview.factor) || adjustPreview.factor <= 0) {
        toast.error('Calcule a prévia antes de aplicar.');
        return;
      }
      const factor = adjustPreview.factor;
      const ast = parseText(text);
      for (const m of ast.meals) for (const g of m.groups) for (const t of g.tokens) {
        if (t.quantity != null && isFinite(t.quantity)) {
          const scaled = t.quantity * factor;
          t.quantity = Math.round(scaled * 100) / 100;
        }
      }
      const next = astToText(ast);
      setText(next);
      toast.success(`Quantidades escaladas por ${factor.toFixed(2)}× para atingir o alvo.`);
      setAdjustOpen(false);
    } catch (e: any) {
      toast.error(`Falha ao aplicar ajuste: ${e.message || e}`);
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

        <WeekOverview texts={texts} active={activeDay} onSelect={(k) => setActiveDay(k)} weightKg={weightKg} enrichedTotalsByDay={enrichedTotalsByDay} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
          <Card className="min-w-0 overflow-hidden">
            <CardContent className="p-3 md:p-4">
              {/* Descrição do dia ativo */}
              <div className="mb-3">
                <p className="text-xs md:text-sm text-muted-foreground">
                  {activeDay === 'all'
                    ? 'Plano base — aplicado nos dias sem variação específica.'
                    : `Variação de ${DAY_TABS.find(d => d.key === activeDay)?.long}. Se vazio, usa o plano base.`}
                </p>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.md,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importPdf(f); }}
              />

              {/* Toolbar agrupada: ícones + tooltip. Mobile 32×32; desktop 64×64. */}
              <div className="mb-3 flex flex-wrap items-center gap-2 lg:gap-3">
                <div className="flex flex-wrap items-center gap-1.5 lg:gap-2">
                  {/* Criar / Importar */}
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <ToolIconButton label="Gerar com IA" onClick={generateWithAI} disabled={generating} loading={generating} variant="secondary">
                      <Sparkles />
                    </ToolIconButton>
                    {activeDay !== 'all' && (
                      <ToolIconButton label="Copiar do plano base" onClick={copyFromAll}>
                        <Copy />
                      </ToolIconButton>
                    )}
                    <ToolIconButton label="Importar PDF/MD" onClick={() => fileRef.current?.click()} disabled={importing} loading={importing}>
                      <Upload />
                    </ToolIconButton>
                  </div>

                  <Separator orientation="vertical" className="hidden sm:block h-6 lg:h-10" />

                  {/* Exportar */}
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <ToolIconButton label="Exportar PDF" onClick={exportPdf}>
                      <FileDown />
                    </ToolIconButton>
                    <ToolIconButton label="Exportar semana" onClick={exportWeekPdf}>
                      <CalendarDays />
                    </ToolIconButton>
                  </div>

                  <Separator orientation="vertical" className="hidden sm:block h-6 lg:h-10" />

                  {/* Ações do plano */}
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <ToolIconButton label="Ajustar g/kg" onClick={openAdjust} disabled={!text.trim() || !weightKg}>
                      <Scale />
                    </ToolIconButton>
                    <ToolIconButton label="Salvar como proposta" onClick={saveAsProposal} disabled={saving}>
                      <ClipboardCheck />
                    </ToolIconButton>
                    <ToolIconButton label="Replicar para outros dias" onClick={openReplicate} disabled={!text.trim()}>
                      <Repeat />
                    </ToolIconButton>
                  </div>

                  <Separator orientation="vertical" className="hidden sm:block h-6 lg:h-10" />

                  {/* Consulta / Navegação */}
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    <Sheet>
                      <SheetTrigger asChild>
                        <span>
                          <ToolIconButton label="Ver anamnese do atleta">
                            <FileText />
                          </ToolIconButton>
                        </span>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                        <SheetHeader>
                          <SheetTitle>Anamnese — {client?.name || 'Atleta'}</SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                          {clientId && <AnamneseResponseSection clientId={clientId} clientName={client?.name || ''} />}
                        </div>
                      </SheetContent>
                    </Sheet>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`/meal-plans/${clientId}/classic`}
                          className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-md border text-muted-foreground hover:bg-muted lg:h-16 lg:w-16"
                          aria-label="Editor clássico"
                        >
                          <ExternalLink className="h-4 w-4 lg:h-6 lg:w-6" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Editor clássico</TooltipContent>
                    </Tooltip>
                  </div>

                  <Separator orientation="vertical" className="hidden sm:block h-6 lg:h-10" />

                  {/* Perigos */}
                  <div className="flex items-center gap-1.5 lg:gap-2">
                    {text.trim() && (
                      <ToolIconButton label="Limpar aba" onClick={clearDay} variant="ghost">
                        <Trash2 />
                      </ToolIconButton>
                    )}
                    {hasBackup && (
                      <ToolIconButton label="Desfazer salvamento" onClick={undoSave} variant="ghost">
                        <Undo2 />
                      </ToolIconButton>
                    )}
                  </div>
                </div>
              </div>

              {/* Atalhos de refeição */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] md:text-xs text-muted-foreground mr-1">Adicionar refeição:</span>
                {QUICK_MEALS.map((m) => (
                  <Button
                    key={m.label}
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs border"
                    onClick={() => insertMealSkeleton(m.label, m.time)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> {m.label}
                  </Button>
                ))}
              </div>

              <MealCardsView text={text} onChange={setText} />



            </CardContent>
          </Card>

          <div className="min-w-0">
            <TotalsPanel
              text={enrichedTotalsText || text}
              enrichedMeals={enrichedMeals}
              enrichedTotals={enrichedTotals}
              weightKg={weightKg}
              saveState={saving ? 'saving' : saveState}
              onSave={savePlan}
              onSendZonaNutri={sendToZonaNutri}
              sending={sending}
            />
          </div>
        </div>
      </div>


      <Dialog open={replicateOpen} onOpenChange={setReplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Replicar {DAY_TABS.find(d => d.key === activeDay)?.long} para...
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              O texto da aba atual substituirá o conteúdo dos dias selecionados.
            </p>
            <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/30">
              <Checkbox
                id="rep-as-base"
                checked={replicateAsBase}
                onCheckedChange={(v) => setReplicateAsBase(!!v)}
                disabled={activeDay === 'all'}
              />
              <Label htmlFor="rep-as-base" className="text-sm cursor-pointer">
                Definir como <b>Todos os dias</b> (plano base)
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DAY_TABS.filter(d => d.key !== 'all' && d.key !== activeDay).map(d => (
                <label key={d.key} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
                  <Checkbox
                    checked={replicateTargets.includes(d.key)}
                    onCheckedChange={() => toggleTarget(d.key)}
                  />
                  <span className="text-sm">{d.long}</span>
                </label>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={selectAllTargets}>
              Selecionar todos os dias
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplicateOpen(false)}>Cancelar</Button>
            <Button onClick={applyReplicate}>Replicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar g/kg da aba atual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Escala <b>proporcionalmente</b> todas as quantidades dos alimentos principais para atingir o
              alvo do macro escolhido. Os outros macros mudam junto — a proporção do plano é preservada.
              Peso do atleta: <b>{weightKg ?? '—'} kg</b>.
            </p>
            <div className="flex items-center gap-2">
              <Label className="text-sm w-16">Macro</Label>
              <select
                value={adjustMacro}
                onChange={(e) => { setAdjustMacro(e.target.value as any); setAdjustPreview(null); }}
                className="flex h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="cho">CHO (carboidrato)</option>
                <option value="ptn">PTN (proteína)</option>
                <option value="lip">LIP (gordura)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm w-16">Alvo</Label>
              <Input
                type="number"
                step="0.1"
                value={adjustTargetGkg}
                onChange={(e) => { setAdjustTargetGkg(e.target.value); setAdjustPreview(null); }}
                className="w-28"
              />
              <span className="text-xs text-muted-foreground">g/kg</span>
              <Button size="sm" variant="secondary" onClick={computeAdjustPreview}>Calcular</Button>
            </div>
            {adjustPreview && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div>Atual: <b>{adjustPreview.current.toFixed(2)} g/kg</b></div>
                <div>Fator de escala: <b>{adjustPreview.factor.toFixed(2)}×</b></div>
                {adjustPreview.factor > 2 && (
                  <div className="text-amber-600">Atenção: escala &gt; 2× pode gerar porções irrealistas.</div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button onClick={applyAdjust} disabled={!adjustPreview}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
