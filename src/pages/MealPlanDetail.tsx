import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PlanPipelinePanel } from '@/components/admin/PlanPipelinePanel';
import { PlanV2Panel } from '@/components/admin/PlanV2Panel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EditableMealPlan } from '@/components/admin/EditableMealPlan';
import { EditableStrategicOrientations } from '@/components/admin/EditableStrategicOrientations';
import { useAthleteWeight } from '@/hooks/useAthleteWeight';
import { ArrowLeft, Brain, Sparkles, FilePlus2, Loader2, ChevronDown, Wand2, Scale, BellRing, Check, RefreshCw, Copy, MessageSquare, FileUp, Send } from 'lucide-react';

const PLAN_LABEL: Record<string, string> = { consultoria: 'Consultoria', premium: 'Premium', zona_nutri_diet: 'Zona Nutri Diet' };

const WEEKDAYS = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' },
  { key: 'dom', label: 'Dom' },
];

interface Guidance {
  meals_count: string;
  target_kcal: string;
  target_cho_gkg: string;
  target_protein_gkg: string;
  target_fat_gkg: string;
  custom_instructions: string;
}
const EMPTY_GUIDANCE: Guidance = { meals_count: '', target_kcal: '', target_cho_gkg: '', target_protein_gkg: '', target_fat_gkg: '', custom_instructions: '' };

function parseStructured(row: any): any | null {
  if (!row) return null;
  try {
    if (row.raw_response) {
      const parsed = typeof row.raw_response === 'string' ? JSON.parse(row.raw_response) : row.raw_response;
      if (parsed?.meal_plan) return { ...parsed, _isNewFormat: true, updated_at: row.updated_at };
    }
  } catch { /* fallthrough */ }
  return {
    _isNewFormat: false,
    athlete_summary: row.diagnosis || '',
    alerts: row.alerts || [],
    strategic_orientations: (row.macronutrients as any)?.strategic_orientations,
    meal_plan: (row.caloric_deficit as any)?.meal_plan,
    updated_at: row.updated_at,
  };
}

export default function MealPlanDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: client } = useQuery({
    queryKey: ['meal-plan-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: analysisRow, isLoading } = useQuery({
    queryKey: ['ai_analysis', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_analyses').select('*').eq('client_id', clientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: anamnese } = useQuery({
    queryKey: ['meal-plan-anamnese', clientId],
    enabled: !!clientId,
    retry: 0,
    staleTime: 300000,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from('anamnese_responses')
          .select('current_weight, meal_breakfast, meal_morning_snack, meal_morning_snack_enabled, meal_lunch, meal_afternoon_snack, meal_afternoon_snack_enabled, meal_dinner, meal_supper, meal_supper_enabled')
          .eq('client_id', clientId)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return data;
      } catch { return null; }
    },
  });

  const structured = parseStructured(analysisRow);
  const isV2 = structured?.planModelVersion === 2 && Array.isArray(structured?.basePlan?.meals);
  const hasPlan = isV2 || !!structured?.meal_plan?.meals;

  // Auto-dispara a análise ao chegar do check-in (?fromCheckin=1), uma única vez.
  const [autoRan, setAutoRan] = useState(false);

  // --- Dias da semana: plano base + variações por dia ---
  const [selectedDay, setSelectedDay] = useState<string>('base'); // 'base' | 'seg'..'dom'
  const dayVariations: Record<string, any> = structured?.meal_plan?.day_variations || {};
  const activeVariation = selectedDay !== 'base' ? dayVariations[selectedDay] : null;

  // Analysis efetivo para o editor: base, ou a variação do dia selecionado.
  const effectiveAnalysis = (() => {
    if (!structured) return structured;
    if (!activeVariation) return structured;
    const clone = JSON.parse(JSON.stringify(structured));
    clone.meal_plan.meals = activeVariation.meals ?? [];
    clone.meal_plan.daily_totals = activeVariation.daily_totals ?? clone.meal_plan.daily_totals;
    return clone;
  })();

  // Persiste o analysis completo em ai_analyses (sem refresh — usado nos saves).
  const persistStructured = async (next: any) => {
    const raw = JSON.stringify({ ...next, _isNewFormat: true });
    const { error } = await supabase.from('ai_analyses').update({
      raw_response: raw,
      caloric_deficit: { meal_plan: next.meal_plan } as any,
      updated_at: new Date().toISOString(),
    }).eq('client_id', clientId!);
    if (error) throw error;
  };

  // Salvamento vindo do editor quando estamos numa variação de dia.
  const onSaveDayVariation = async (mealPlan: any) => {
    const next = JSON.parse(JSON.stringify(structured));
    next.meal_plan.day_variations = {
      ...(next.meal_plan.day_variations || {}),
      [selectedDay]: { meals: mealPlan.meals, daily_totals: mealPlan.daily_totals },
    };
    await persistStructured(next);
  };

  const createDayVariation = async (dayKey: string) => {
    if (!structured) return;
    const next = JSON.parse(JSON.stringify(structured));
    next.meal_plan.day_variations = {
      ...(next.meal_plan.day_variations || {}),
      [dayKey]: {
        meals: JSON.parse(JSON.stringify(structured.meal_plan.meals || [])),
        daily_totals: structured.meal_plan.daily_totals,
      },
    };
    try {
      await persistStructured(next);
      setSelectedDay(dayKey);
      toast.success(`Variação criada para ${WEEKDAYS.find(d => d.key === dayKey)?.label}.`);
      refresh();
    } catch (e: any) { toast.error(e.message || 'Erro ao criar variação'); }
  };

  const removeDayVariation = async (dayKey: string) => {
    if (!structured) return;
    const next = JSON.parse(JSON.stringify(structured));
    if (next.meal_plan.day_variations) delete next.meal_plan.day_variations[dayKey];
    try {
      await persistStructured(next);
      setSelectedDay('base');
      toast.success('Variação removida — o dia volta a seguir o plano base.');
      refresh();
    } catch (e: any) { toast.error(e.message || 'Erro ao remover variação'); }
  };

  // --- Guidance (persisted per client) ---
  const [guidance, setGuidance] = useState<Guidance>(EMPTY_GUIDANCE);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  useEffect(() => {
    if (!clientId) return;
    try {
      const raw = localStorage.getItem(`ai-guidance:${clientId}`);
      if (raw) setGuidance({ ...EMPTY_GUIDANCE, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, [clientId]);
  const setG = (k: keyof Guidance, v: string) => {
    const next = { ...guidance, [k]: v };
    setGuidance(next);
    try { localStorage.setItem(`ai-guidance:${clientId}`, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const buildGuidancePayload = () => {
    const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : undefined);
    const p: any = {
      meals_count: num(guidance.meals_count),
      target_kcal: num(guidance.target_kcal),
      target_cho_gkg: num(guidance.target_cho_gkg),
      target_protein_gkg: num(guidance.target_protein_gkg),
      target_fat_gkg: num(guidance.target_fat_gkg),
      custom_instructions: guidance.custom_instructions.trim() || undefined,
    };
    const has = Object.values(p).some((v) => v !== undefined);
    return has ? p : undefined;
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ai_analysis', clientId] });
    queryClient.invalidateQueries({ queryKey: ['meal-plan-index'] });
  };

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-athlete', {
        body: { clientId, adminGuidance: buildGuidancePayload() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast.success('Plano gerado pela IA!'); refresh(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar plano'),
  });

  const updateFromCheckin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('update-meal-plan', {
        body: { clientId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast.success('Ajustes gerados. Revise e clique em "Aplicar ajustes ao plano".'); refresh(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao atualizar plano'),
  });

  // Aplica a proposta (pending_update) ao plano vigente. Guarda backup para desfazer.
  const applyPendingUpdate = useMutation({
    mutationFn: async () => {
      if (!structured?.pending_update) throw new Error('Não há ajustes pendentes para aplicar.');
      const pu = structured.pending_update;
      const backup = {
        created_at: new Date().toISOString(),
        athlete_summary: structured.athlete_summary,
        carb_estimation: structured.carb_estimation,
        carb_progression: structured.carb_progression,
        meal_plan: structured.meal_plan,
        strategic_orientations: structured.strategic_orientations,
        alerts: structured.alerts,
      };
      const next = {
        ...structured,
        athlete_summary: pu.athlete_summary ?? structured.athlete_summary,
        carb_estimation: pu.carb_estimation ?? structured.carb_estimation,
        carb_progression: pu.carb_progression ?? structured.carb_progression,
        meal_plan: pu.meal_plan ?? structured.meal_plan,
        strategic_orientations: pu.strategic_orientations ?? structured.strategic_orientations,
        alerts: pu.alerts ?? structured.alerts,
        pre_update_backup: backup,
        pending_update: null,
        _isNewFormat: true,
        updated_at: new Date().toISOString(),
      };
      await persistStructured(next);
    },
    onSuccess: () => { toast.success('Ajustes aplicados ao plano alimentar.'); refresh(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao aplicar ajustes'),
  });

  // Desfaz a última aplicação usando o backup salvo.
  const undoPendingUpdate = useMutation({
    mutationFn: async () => {
      if (!structured?.pre_update_backup) throw new Error('Não há aplicação para desfazer.');
      const bk = structured.pre_update_backup;
      const next = {
        ...structured,
        athlete_summary: bk.athlete_summary ?? structured.athlete_summary,
        carb_estimation: bk.carb_estimation ?? structured.carb_estimation,
        carb_progression: bk.carb_progression ?? structured.carb_progression,
        meal_plan: bk.meal_plan ?? structured.meal_plan,
        strategic_orientations: bk.strategic_orientations ?? structured.strategic_orientations,
        alerts: bk.alerts ?? structured.alerts,
        pre_update_backup: null,
        _isNewFormat: true,
        updated_at: new Date().toISOString(),
      };
      await persistStructured(next);
    },
    onSuccess: () => { toast.success('Aplicação desfeita — o plano voltou ao estado anterior.'); refresh(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao desfazer'),
  });


  const generateV2 = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-base-plan', { body: { clientId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast.success('Plano-base (v2) gerado!'); refresh(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar plano-base'),
  });

  // Desfaz o v2: volta ao formato padrão (v1) mantendo a dieta já espelhada.
  // Assim os botões de sempre (anamnese, orientações, check-in) voltam a valer.
  const undoV2 = useMutation({
    mutationFn: async () => {
      if (!structured) return;
      const next = { ...structured, planModelVersion: 1 };
      await persistStructured(next);
    },
    onSuccess: () => { toast.success('Plano v2 desfeito — voltou ao formato padrão (a dieta foi mantida).'); refresh(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao desfazer'),
  });

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPdf, setImportPdf] = useState<{ name: string; base64: string } | null>(null);
  const importDiet = useMutation({
    mutationFn: async () => {
      const body: any = { clientId };
      if (importPdf) body.pdfBase64 = importPdf.base64;
      else body.planText = importText;
      const { data, error } = await supabase.functions.invoke('import-meal-plan', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast.success('Dieta importada! Já aparece em Plano Alimentar.'); setImportOpen(false); setImportText(''); setImportPdf(null); refresh(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao importar dieta'),
  });

  const sendToZonaNutri = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-meal-plan-to-zona-nutri', {
        body: { clientId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success('Plano enviado ao Zona Nutri!'),
    onError: (e: any) => toast.error(e.message || 'Erro ao enviar ao Zona Nutri'),
  });

  const handlePdfPick = (file: File | null) => {
    if (!file) { setImportPdf(null); return; }
    if (file.type !== 'application/pdf') { toast.error('Selecione um arquivo PDF.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setImportPdf({ name: file.name, base64 });
    };
    reader.readAsDataURL(file);
  };

  // Ao chegar do check-in, importa o plano atual e roda a análise automaticamente.
  useEffect(() => {
    if (searchParams.get('fromCheckin') === '1' && hasPlan && !autoRan && !updateFromCheckin.isPending) {
      setAutoRan(true);
      updateFromCheckin.mutate();
      const next = new URLSearchParams(searchParams);
      next.delete('fromCheckin');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, hasPlan, autoRan]);

  const createFromScratch = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('Cliente não encontrado');
      const empty = {
        athlete_summary: '',
        carb_estimation: { current_cho_gkg: 0, classification: 'Moderada', reasoning: '' },
        carb_progression: {},
        meal_plan: {
          meals: [{ meal_name: 'Nova refeição', foods: [], food_groups: [], meal_macros: '', timing_note: '' }],
          daily_totals: { kcal: 0, cho_g: 0, cho_gkg: 0, protein_g: 0, protein_gkg: 0, fat_g: 0, fat_gkg: 0, kcal_kg: 0 },
        },
        strategic_orientations: { meal_routine: [], training_strategy: [], supplementation: [], race_context: '' },
        alerts: [],
      };
      const raw = JSON.stringify({ ...empty, _isNewFormat: true });
      let profileId: string | null = null;
      try {
        const { data: prof } = await (supabase as any).from('athlete_profiles').select('id').eq('client_id', clientId).maybeSingle();
        profileId = prof?.id ?? null;
      } catch { /* ignore */ }

      if (analysisRow) {
        const { error } = await supabase.from('ai_analyses').update({
          raw_response: raw, caloric_deficit: { meal_plan: empty.meal_plan } as any, updated_at: new Date().toISOString(),
        }).eq('client_id', clientId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ai_analyses').insert({
          client_id: clientId!, athlete_profile_id: profileId,
          diagnosis: '', raw_response: raw,
          caloric_deficit: { meal_plan: empty.meal_plan } as any,
          // These columns are NOT NULL on the table.
          energy_expenditure: {} as any,
          macronutrients: { strategic_orientations: empty.strategic_orientations } as any,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success('Plano em branco criado. Clique em Editar Plano para começar.'); refresh(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar plano'),
  });

  // Peso de referência para g/kg: último checkin com peso → anamnese (fallback)
  const { data: weightInfo } = useAthleteWeight(clientId);
  const athleteWeightKg =
    weightInfo?.weightKg ??
    (anamnese as any)?.current_weight ??
    (client as any)?.current_weight ??
    null;
  const mealSchedule = anamnese ? {
    cafe_da_manha: (anamnese as any).meal_breakfast,
    lanche_manha: (anamnese as any).meal_morning_snack,
    lanche_manha_enabled: (anamnese as any).meal_morning_snack_enabled,
    almoco: (anamnese as any).meal_lunch,
    lanche_tarde: (anamnese as any).meal_afternoon_snack,
    lanche_tarde_enabled: (anamnese as any).meal_afternoon_snack_enabled,
    jantar: (anamnese as any).meal_dinner,
    ceia: (anamnese as any).meal_supper,
    ceia_enabled: (anamnese as any).meal_supper_enabled,
  } : undefined;

  // Peso manual (quando não há anamnese/check-in) + aviso ao atleta
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const saveManualWeight = async () => {
    const w = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(w) || w < 20 || w > 300) { toast.error('Informe um peso válido (kg).'); return; }
    setSavingWeight(true);
    try {
      const { error } = await (supabase as any).from('clients').update({ manual_weight_kg: w }).eq('id', clientId);
      if (error) throw error;
      toast.success('Peso salvo.');
      setWeightInput('');
      queryClient.invalidateQueries({ queryKey: ['athlete-weight', clientId] });
    } catch (e: any) {
      toast.error('Erro ao salvar peso: ' + e.message);
    } finally {
      setSavingWeight(false);
    }
  };

  const notifyAthlete = useMutation({
    mutationFn: async (firstTime: boolean) => {
      const { data, error } = await supabase.functions.invoke('notify-meal-plan-ready', {
        body: { client_id: clientId, is_first_time: firstTime },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.skipped) toast.info('O atleta ainda não acessou o app — nada enviado.');
      else if (data?.sent === 0) toast.info('Aviso registrado, mas o atleta não tem dispositivo com notificação ativa.');
      else toast.success('Atleta avisado! 🔔');
    },
    onError: (e: any) => toast.error('Erro ao avisar: ' + e.message),
  });

  const busy = analyzeMutation.isPending || createFromScratch.isPending;

  const GuidanceInputs = (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <NumField label="Nº de refeições" value={guidance.meals_count} onChange={(v) => setG('meals_count', v)} />
      <NumField label="Calorias alvo" value={guidance.target_kcal} onChange={(v) => setG('target_kcal', v)} />
      <NumField label="CHO g/kg" value={guidance.target_cho_gkg} onChange={(v) => setG('target_cho_gkg', v)} step="0.1" />
      <NumField label="PTN g/kg" value={guidance.target_protein_gkg} onChange={(v) => setG('target_protein_gkg', v)} step="0.1" />
      <NumField label="LIP g/kg" value={guidance.target_fat_gkg} onChange={(v) => setG('target_fat_gkg', v)} step="0.1" />
      <div className="col-span-2 md:col-span-3">
        <label className="text-xs text-muted-foreground block mb-1">Instruções específicas (opcional)</label>
        <Textarea value={guidance.custom_instructions} onChange={(e) => setG('custom_instructions', e.target.value)} rows={2} className="text-sm" placeholder="Ex: evitar lactose, priorizar alimentos que o atleta já consome..." />
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/meal-plans')}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{client?.name || 'Atleta'}</h1>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {client && <Badge variant="outline" className="text-[10px]">{PLAN_LABEL[(client as any).plan_type] || (client as any).plan_type}</Badge>}
              {hasPlan ? <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Plano criado</Badge>
                       : <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30">Sem plano</Badge>}
              {athleteWeightKg && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  Peso: {athleteWeightKg} kg
                  {weightInfo?.source === 'checkin' && ' (último check-in)'}
                  {weightInfo?.source === 'anamnese' && ' (anamnese)'}
                  {weightInfo?.source === 'manual' && ' (manual)'}
                  <button
                    type="button"
                    title="Atualizar do último check-in"
                    onClick={async () => {
                      await queryClient.invalidateQueries({ queryKey: ['athlete-weight', clientId] });
                      toast.success('Peso atualizado do último check-in.');
                    }}
                    className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted text-[10px] text-primary"
                  >
                    <RefreshCw className="h-3 w-3" /> Atualizar do check-in
                  </button>
                </span>
              )}

            </div>
          </div>
          {hasPlan && (
            <>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => notifyAthlete.mutate(false)}
                disabled={notifyAthlete.isPending}
                title="Enviar notificação ao atleta avisando que o plano foi atualizado"
              >
                {notifyAthlete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                <span className="hidden sm:inline">Avisar atleta</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => sendToZonaNutri.mutate()}
                disabled={sendToZonaNutri.isPending}
                title="Enviar o plano (com os dias da semana) para o app Zona Nutri"
              >
                {sendToZonaNutri.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">Enviar ao Zona Nutri</span>
              </Button>
            </>
          )}
        </div>

        {/* Peso manual — quando não há anamnese/check-in com peso */}
        {!athleteWeightKg && (
          <Card className="border-amber-500/40 bg-amber-500/[0.04]">
            <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Scale className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm">
                  Sem peso de anamnese/check-in. <span className="text-muted-foreground">Informe o peso para calcular g/kg.</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="kg"
                  className="w-24 h-9"
                />
                <Button size="sm" className="gap-1.5" onClick={saveManualWeight} disabled={savingWeight}>
                  {savingWeight ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  title="Buscar peso no último check-in"
                  onClick={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['athlete-weight', clientId] });
                    toast.success('Verificado. Se houver peso no último check-in, foi atualizado.');
                  }}
                >
                  <RefreshCw className="h-4 w-4" /> Atualizar do check-in
                </Button>

              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !hasPlan ? (
          /* Ainda não há plano → duas formas de criar */
          <div className="space-y-4">
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-sm">Gerar plano-base (novo modelo v2)</p>
                  <p className="text-xs text-muted-foreground">Uma única chamada de IA gera o plano-base; a dinâmica por dia de treino e o carbload são aplicados automaticamente pelo sistema (sem gerar 7 dietas).</p>
                </div>
                <Button className="gap-2 shrink-0" onClick={() => generateV2.mutate()} disabled={busy || generateV2.isPending}>
                  {generateV2.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar plano-base
                </Button>
              </CardContent>
            </Card>

            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Ou pelos modos anteriores:
              <span className="text-foreground"> (1) Importar a dieta atual</span> ou
              <span className="text-foreground"> (2) Gerar pela anamnese</span>.
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {/* 1) Importar dieta atual */}
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><FileUp className="h-4 w-4 text-primary" /> 1. Importar dieta atual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">O atleta já tem uma dieta? Cole o texto dela (do PDF/plano atual) e o sistema estrutura em refeições, alimentos, porções e substituições. Essa dieta vira o Plano Alimentar.</p>
                  <Button className="w-full gap-2" onClick={() => setImportOpen(true)} disabled={busy}>
                    <FileUp className="h-4 w-4" /> Importar dieta
                  </Button>
                </CardContent>
              </Card>

              {/* 2) Gerar pela anamnese */}
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> 2. Gerar pela anamnese (IA)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">Não tem dieta ainda? A IA analisa a anamnese e monta o plano original. Ajuste as metas abaixo (opcional).</p>
                  {GuidanceInputs}
                  <Button className="w-full gap-2" onClick={() => analyzeMutation.mutate()} disabled={busy}>
                    {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                    Gerar plano pela anamnese
                  </Button>
                </CardContent>
              </Card>
            </div>

            <PlanPipelinePanel clientId={clientId!} onDone={refresh} />

            <button className="text-xs text-muted-foreground underline" onClick={() => createFromScratch.mutate()} disabled={busy}>
              ou criar um plano em branco para montar manualmente
            </button>
          </div>
        ) : (
          <>
            {/* Plano v2: estratégia da semana + longão. A dieta segue no editor de
                sempre abaixo; os botões (anamnese, check-in, orientações) continuam
                disponíveis. Pode-se desfazer o v2 sem perder a dieta. */}
            {isV2 && (
              <>
                <PlanV2Panel clientId={clientId!} stored={structured} onUpdated={refresh} />
                <button
                  className="self-start text-xs text-muted-foreground underline"
                  onClick={() => undoV2.mutate()}
                  disabled={busy || undoV2.isPending}
                >
                  Desfazer plano v2 e voltar ao formato padrão (mantém a dieta)
                </button>
              </>
            )}

            {/* Pipeline em etapas (regerar) */}
            <PlanPipelinePanel clientId={clientId!} onDone={refresh} />

            {/* Atualizar plano com base no último check-in */}
            <Card className="border-primary/30">
              <CardContent className="pt-4 space-y-3">
                <Button
                  className="w-full gap-2"
                  onClick={() => updateFromCheckin.mutate()}
                  disabled={busy || updateFromCheckin.isPending}
                >
                  {updateFromCheckin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Atualizar plano com o último check-in
                </Button>
                <p className="text-xs text-muted-foreground">
                  Importa o plano atual como base e a IA o revisa de forma conservadora com base no último check-in, histórico, objetivos, prova-alvo e dinâmica de treinos — ajustando só o necessário.
                </p>
                <button className="text-xs text-muted-foreground underline" onClick={() => setImportOpen(true)}>
                  Substituir por outra dieta (importar do PDF/plano atual)
                </button>

                {/* Leitura do check-in */}
                {structured?.checkin_reading && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <span className="text-xs font-semibold text-foreground">📋 Leitura do check-in</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{structured.checkin_reading}</p>
                  </div>
                )}

                {structured?.no_change_needed && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
                    ✅ A IA avaliou que o plano deve ser <strong>mantido</strong> (sem ajustes necessários neste check-in).
                  </div>
                )}

                {/* Tabela de ajustes */}
                {Array.isArray(structured?.adjustments) && structured.adjustments.length > 0 && (
                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-semibold">Local</th>
                          <th className="text-left p-2 font-semibold">Antes</th>
                          <th className="text-left p-2 font-semibold">Depois</th>
                          <th className="text-left p-2 font-semibold">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {structured.adjustments.map((a: any, i: number) => (
                          <tr key={i} className="border-t align-top">
                            <td className="p-2 font-medium">{a.location}</td>
                            <td className="p-2 text-muted-foreground">{a.before || '—'}</td>
                            <td className="p-2">{a.after}</td>
                            <td className="p-2 text-muted-foreground">{a.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pontos de atenção para avaliação direta */}
                {Array.isArray(structured?.attention_points) && structured.attention_points.length > 0 && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                    <span className="text-xs font-semibold text-amber-700">⚠️ Pontos para sua avaliação direta</span>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-sm text-foreground">
                      {structured.attention_points.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}

                {structured?.adjustment_message && (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" /> Mensagem para enviar ao atleta
                      </span>
                      <Button
                        variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                        onClick={() => { navigator.clipboard.writeText(structured.adjustment_message); toast.success('Mensagem copiada!'); }}
                      >
                        <Copy className="h-3 w-3" /> Copiar
                      </Button>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{structured.adjustment_message}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Collapsible open={guidanceOpen} onOpenChange={setGuidanceOpen}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Regerar com IA / metas</CardTitle>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${guidanceOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    {GuidanceInputs}
                    <Button variant="outline" className="w-full gap-2" onClick={() => analyzeMutation.mutate()} disabled={busy}>
                      {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                      Reanalisar (substitui o plano atual)
                    </Button>
                    <Button variant="outline" className="w-full gap-2" onClick={() => generateV2.mutate()} disabled={busy || generateV2.isPending}>
                      {generateV2.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Gerar/atualizar via v2 (base + camadas, encaixa por dia)
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Seletor de dias da semana: plano base + variações */}
            {structured?.meal_plan?.meals && (
              <Card>
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setSelectedDay('base')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${selectedDay === 'base' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                    >
                      Base (todos)
                    </button>
                    {WEEKDAYS.map(d => {
                      const hasVar = !!dayVariations[d.key];
                      return (
                        <button
                          key={d.key}
                          onClick={() => setSelectedDay(d.key)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${selectedDay === d.key ? 'bg-primary text-primary-foreground' : hasVar ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                          title={hasVar ? 'Tem variação própria' : 'Segue o plano base'}
                        >
                          {d.label}{hasVar ? ' •' : ''}
                        </button>
                      );
                    })}
                  </div>
                  {selectedDay === 'base' ? (
                    <p className="text-xs text-muted-foreground">Editando o <strong>plano base</strong> — vale para todos os dias sem variação própria.</p>
                  ) : activeVariation ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-primary">Editando a variação de <strong>{WEEKDAYS.find(d => d.key === selectedDay)?.label}</strong>.</p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => removeDayVariation(selectedDay)}>
                        Remover variação
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Este dia segue o plano base.</p>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => createDayVariation(selectedDay)}>
                        Criar variação para {WEEKDAYS.find(d => d.key === selectedDay)?.label}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Meal plan editor (calories, g/kg, recalc, structured foods) */}
            {structured?.meal_plan?.meals && (
              <EditableMealPlan
                key={`mp-${structured.updated_at}-${selectedDay}-${activeVariation ? 'var' : 'base'}`}
                analysis={effectiveAnalysis}
                clientId={clientId!}
                athleteWeightKg={athleteWeightKg}
                mealSchedule={mealSchedule}
                onUpdated={refresh}
                onSavePlan={activeVariation ? onSaveDayVariation : undefined}
              />
            )}

            {/* Orientations & supplementation (editable) */}
            <EditableStrategicOrientations key={`so-${structured.updated_at}`} analysis={structured} clientId={clientId!} onUpdated={refresh} />
          </>
        )}

        {/* Diálogo: importar dieta atual */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Importar dieta atual do atleta</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Envie o <strong>PDF</strong> do plano atual (o sistema lê horários, alimentos, porções, substituições, opções e dias da semana) — ou cole o texto. O plano é estruturado <strong>sem inventar nada</strong> e passa a ser o Plano Alimentar.
              </p>

              <div className="rounded-lg border border-dashed p-3">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                  <FileUp className="h-3.5 w-3.5 text-primary" /> Importar do PDF (recomendado)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handlePdfPick(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5 file:text-xs file:font-medium"
                />
                {importPdf && <p className="text-xs text-primary mt-1">📄 {importPdf.name} — pronto para importar.</p>}
              </div>

              {!importPdf && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ou cole o texto da dieta:</p>
                  <Textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={8}
                    placeholder={"Ex.:\nCafé da manhã (07h)\n- 2 fatias de pão francês (100g) ou 1 tapioca (80g)\n- 2 ovos\n\nAlmoço (12h)\n- Arroz 4 col. sopa ou batata 2 unid.\n..."}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancelar</Button>
              <Button onClick={() => importDiet.mutate()} disabled={importDiet.isPending || (!importPdf && importText.trim().length < 20)}>
                {importDiet.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importando...</> : <><FileUp className="h-4 w-4 mr-2" />Importar</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="text-sm" />
    </div>
  );
}
