import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EditableMealPlan } from '@/components/admin/EditableMealPlan';
import { EditableStrategicOrientations } from '@/components/admin/EditableStrategicOrientations';
import { useAthleteWeight } from '@/hooks/useAthleteWeight';
import { ArrowLeft, Brain, Sparkles, FilePlus2, Loader2, ChevronDown, Wand2 } from 'lucide-react';

const PLAN_LABEL: Record<string, string> = { consultoria: 'Consultoria', premium: 'Premium', zona_nutri_diet: 'Zona Nutri Diet' };

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
  const hasPlan = !!structured?.meal_plan?.meals;

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
            <div className="flex items-center gap-1.5 mt-0.5">
              {client && <Badge variant="outline" className="text-[10px]">{PLAN_LABEL[(client as any).plan_type] || (client as any).plan_type}</Badge>}
              {hasPlan ? <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Plano criado</Badge>
                       : <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30">Sem plano</Badge>}
              {athleteWeightKg && (
                <span className="text-xs text-muted-foreground">
                  Peso: {athleteWeightKg} kg
                  {weightInfo?.source === 'checkin' && ' (último check-in)'}
                  {weightInfo?.source === 'anamnese' && ' (anamnese)'}
                </span>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !hasPlan ? (
          /* No plan yet → two paths */
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Gerar com IA (anamnese)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">A IA analisa a anamnese e monta o plano. Ajuste as metas abaixo (opcional).</p>
                {GuidanceInputs}
                <Button className="w-full gap-2" onClick={() => analyzeMutation.mutate()} disabled={busy}>
                  {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  Gerar plano com IA
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><FilePlus2 className="h-4 w-4 text-primary" /> Criar do zero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Comece um plano em branco e monte refeição por refeição manualmente.</p>
                <Button variant="outline" className="w-full gap-2" onClick={() => createFromScratch.mutate()} disabled={busy}>
                  {createFromScratch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
                  Criar plano em branco
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Regenerate with AI (collapsible) */}
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
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Meal plan editor (calories, g/kg, recalc, structured foods) */}
            {structured?.meal_plan?.meals && (
              <EditableMealPlan
                key={`mp-${structured.updated_at}`}
                analysis={structured}
                clientId={clientId!}
                athleteWeightKg={athleteWeightKg}
                mealSchedule={mealSchedule}
                onUpdated={refresh}
              />
            )}

            {/* Orientations & supplementation (editable) */}
            <EditableStrategicOrientations key={`so-${structured.updated_at}`} analysis={structured} clientId={clientId!} onUpdated={refresh} />
          </>
        )}
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
