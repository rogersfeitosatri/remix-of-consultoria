import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Save, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Calendar, Zap, ListChecks, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Props {
  clientId: string;
  consultationId?: string;
  consultation: any;
  athleteProfile: any;
  client: any;
  weeks: any[];
}

const DAY_MAP: Record<string, string> = { Mon: 'Seg', Tue: 'Ter', Wed: 'Qua', Thu: 'Qui', Fri: 'Sex', Sat: 'Sáb', Sun: 'Dom' };
const TYPE_COLORS: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  recovery: 'bg-emerald-500/20 text-emerald-400',
};

export function PeriodizaSuggestionOutput({ clientId, consultationId, consultation, athleteProfile, client, weeks }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [generationType, setGenerationType] = useState('full');
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  // Fetch latest suggestion
  const { data: latestSuggestion } = useQuery({
    queryKey: ['periodiza-suggestion', clientId, consultationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('periodiza_suggestions')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch admin instructions
  const { data: adminInstructions } = useQuery({
    queryKey: ['periodiza-admin-instructions', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('periodiza_admin_instructions')
        .select('instructions')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.instructions || '';
    },
    enabled: !!user?.id,
  });

  // Fetch active knowledge base
  const { data: knowledgeBase } = useQuery({
    queryKey: ['periodiza-kb-active', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('periodiza_knowledge_base')
        .select('title, tags, content, priority')
        .eq('user_id', user!.id)
        .eq('active', true)
        .order('priority', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const buildAthleteContext = () => {
    const raceDate = athleteProfile?.target_deadline || consultation?.target_race_date;
    const weight = Number(consultation?.weight) || Number(athleteProfile?.current_weight) || 0;
    const leanMassKg = Number(consultation?.lean_mass_kg) || 0;

    return {
      nome: client?.name || '—',
      modalidade: consultation?.sport_modality || consultation?.training_type || '—',
      objetivo: athleteProfile?.main_goal || consultation?.sport_goal || '—',
      prova_alvo: athleteProfile?.target_race || '—',
      data_prova: raceDate || null,
      semanas_ate_prova: raceDate ? Math.max(Math.round((new Date(raceDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)), 0) : null,
      peso_kg: weight,
      altura_cm: Number(consultation?.height) || Number(athleteProfile?.height) || 0,
      mlg_kg: leanMassKg,
      gordura_pct: Number(consultation?.fat_percentage) || 0,
      volume_semanal_km: athleteProfile?.weekly_volume_km || null,
      frequencia_semanal: athleteProfile?.weekly_frequency || null,
      restricoes_alimentares: athleteProfile?.food_allergies || athleteProfile?.religious_restrictions || 'Nenhuma',
      preferencias: athleteProfile?.favorite_foods || null,
      alimentos_nao_gosta: athleteProfile?.disliked_foods || null,
      intolerancia_lactose: athleteProfile?.lactose_intolerance || null,
      intolerancia_gluten: athleteProfile?.gluten_intolerance || null,
      plano_atleta: client?.plan_duration || client?.plan_type || null,
      frequencia_consulta: client?.consultation_frequency || null,
      fases_existentes: weeks.length > 0 ? [...new Set(weeks.map((w: any) => w.phase_name))].join(', ') : 'Nenhuma',
    };
  };

  const handleGenerate = async (type: string) => {
    setGenerating(true);
    setGenerationType(type);
    try {
      const { data, error } = await supabase.functions.invoke('generate-periodization', {
        body: {
          athleteContext: buildAthleteContext(),
          adminInstructions: adminInstructions || '',
          knowledgeBase: knowledgeBase || [],
          generationType: type,
          manualEdits: latestSuggestion?.manual_edits || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const nextVersion = (latestSuggestion?.version || 0) + 1;

      // Deactivate previous
      if (latestSuggestion?.id) {
        await supabase
          .from('periodiza_suggestions')
          .update({ is_active: false })
          .eq('id', latestSuggestion.id);
      }

      const { error: insertError } = await supabase
        .from('periodiza_suggestions')
        .insert({
          user_id: user!.id,
          client_id: clientId,
          consultation_id: consultationId || null,
          version: nextVersion,
          suggestion_type: type,
          phase_plan: data.plan?.phasePlan || null,
          monthly_adjustments: data.plan?.monthlyAdjustments || null,
          taper_protocol: data.plan?.taperProtocol || null,
          nutritionist_notes: data.plan?.nutritionistNotes || null,
          human_readable: data.humanReadable || null,
          is_active: true,
        });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['periodiza-suggestion'] });
      toast({ title: 'Periodização gerada com sucesso!', description: `Versão ${nextVersion}` });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar periodização', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const plan = latestSuggestion?.phase_plan as any[] | null;
  const adjustments = latestSuggestion?.monthly_adjustments as any[] | null;
  const taper = latestSuggestion?.taper_protocol as any;
  const notes = latestSuggestion?.nutritionist_notes as string[] | null;
  const humanReadable = latestSuggestion?.human_readable;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Sugestão do Periodiza
            {latestSuggestion && (
              <Badge variant="outline" className="text-[10px]">v{latestSuggestion.version}</Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => handleGenerate('full')} disabled={generating} className="gap-1 text-xs h-7">
            {generating && generationType === 'full' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Gerar Periodização
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGenerate('next_phase')} disabled={generating} className="gap-1 text-xs h-7">
            {generating && generationType === 'next_phase' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Próxima fase
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGenerate('monthly_adjustment')} disabled={generating} className="gap-1 text-xs h-7">
            {generating && generationType === 'monthly_adjustment' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Settings className="h-3 w-3" />}
            Microajuste do mês
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleGenerate('long_run_week')} disabled={generating} className="gap-1 text-xs h-7">
            {generating && generationType === 'long_run_week' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calendar className="h-3 w-3" />}
            Semana do longão
          </Button>
        </div>

        {/* Results */}
        {latestSuggestion ? (
          <Tabs defaultValue="phases" className="w-full">
            <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1">
              <TabsTrigger value="summary" className="text-xs gap-1"><Zap className="h-3 w-3" />Resumo</TabsTrigger>
              <TabsTrigger value="phases" className="text-xs gap-1"><Calendar className="h-3 w-3" />Fases</TabsTrigger>
              <TabsTrigger value="adjustments" className="text-xs gap-1"><Settings className="h-3 w-3" />Microajustes</TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs gap-1"><ListChecks className="h-3 w-3" />Checklist</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-3">
              {humanReadable && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs whitespace-pre-wrap">
                  {humanReadable}
                </div>
              )}
              {notes && notes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Notas do Nutricionista</p>
                  {notes.map((note: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-amber-500/5 border border-amber-500/20">
                      <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Phases Tab */}
            <TabsContent value="phases" className="space-y-2">
              {plan && plan.map((phase: any, pi: number) => (
                <div key={pi} className="border border-border rounded-lg">
                  <button
                    onClick={() => setExpandedPhase(expandedPhase === pi ? null : pi)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-xs">{phase.phase}</Badge>
                      <span className="text-xs text-muted-foreground">Sem. {phase.startWeek}–{phase.endWeek}</span>
                      {phase.targets?.EA_target_kcal_kgFFM && (
                        <Badge variant="outline" className="text-[10px]">EA: {phase.targets.EA_target_kcal_kgFFM}</Badge>
                      )}
                    </div>
                    {expandedPhase === pi ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {expandedPhase === pi && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                      {/* Targets */}
                      {phase.targets && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {Object.entries(phase.targets).map(([k, v]) => (
                            <div key={k} className="p-2 rounded bg-muted/30 border border-border">
                              <p className="text-[10px] text-muted-foreground uppercase">{k.replace(/_/g, ' ')}</p>
                              <p className="text-xs font-medium">{String(v)}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Strategies */}
                      {phase.strategies && phase.strategies.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Estratégias</p>
                          <div className="space-y-1">
                            {phase.strategies.map((s: string, si: number) => (
                              <div key={si} className="flex items-start gap-2 text-xs">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                                <span>{s}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Weekly Structure */}
                      {phase.weeklyStructure && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Estrutura Semanal</p>
                          <div className="grid grid-cols-7 gap-1">
                            {Object.entries(phase.weeklyStructure).map(([day, info]: [string, any]) => (
                              <div key={day} className={`p-2 rounded border border-border text-center ${TYPE_COLORS[info.type] || 'bg-muted/30'}`}>
                                <p className="text-[10px] font-bold">{DAY_MAP[day] || day}</p>
                                <p className="text-[10px] capitalize">{info.type}</p>
                                {info.notes && <p className="text-[9px] text-muted-foreground mt-0.5">{info.notes}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Checkpoints */}
                      {phase.checkpoints && phase.checkpoints.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {phase.checkpoints.map((cp: string, ci: number) => (
                            <Badge key={ci} variant="outline" className="text-[10px]">📋 {cp}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Taper Protocol */}
              {taper && (
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-2">
                  <p className="text-xs font-medium text-purple-400">🏁 Protocolo de Taper ({taper.daysOut} dias)</p>
                  {taper.carbLoading?.enabled && (
                    <p className="text-xs">Carb Loading: {taper.carbLoading.carb_gkg_day} g/kg por {taper.carbLoading.durationHours}h</p>
                  )}
                  {taper.raceStrategy && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Café:</span> {taper.raceStrategy.breakfast}</div>
                      <div><span className="text-muted-foreground">Intra:</span> {taper.raceStrategy.intraCHO_gph} g/h</div>
                      <div><span className="text-muted-foreground">Cafeína:</span> {taper.raceStrategy.caffeine_mgkg} mg/kg</div>
                      <div><span className="text-muted-foreground">Sódio:</span> {taper.raceStrategy.sodium_strategy}</div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Adjustments Tab */}
            <TabsContent value="adjustments" className="space-y-2">
              {adjustments && adjustments.length > 0 ? adjustments.map((adj: any, ai: number) => (
                <div key={ai} className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                  <p className="text-xs font-medium">Mês {adj.monthIndex}</p>
                  <ul className="space-y-1">
                    {(adj.changes || []).map((c: string, ci: number) => (
                      <li key={ci} className="text-xs flex items-start gap-1">
                        <span className="text-primary">•</span> {c}
                      </li>
                    ))}
                  </ul>
                  {adj.why && <p className="text-[10px] text-muted-foreground italic">Porquê: {adj.why}</p>}
                </div>
              )) : (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum microajuste gerado.</p>
              )}
            </TabsContent>

            {/* Checklist Tab */}
            <TabsContent value="checklist" className="space-y-2">
              {plan && plan.length > 0 && (
                <div className="space-y-3">
                  {plan.map((phase: any, pi: number) => (
                    phase.weeklyStructure && (
                      <div key={pi} className="space-y-1">
                        <p className="text-xs font-medium">{phase.phase}</p>
                        <div className="grid grid-cols-7 gap-1">
                          {Object.entries(phase.weeklyStructure).map(([day, info]: [string, any]) => (
                            <div key={day} className={`p-1.5 rounded border text-center ${TYPE_COLORS[info.type] || 'bg-muted/30 border-border'}`}>
                              <p className="text-[10px] font-bold">{DAY_MAP[day] || day}</p>
                              <p className="text-[9px]">{info.type}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
              {(!plan || plan.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">Gere uma periodização para ver o checklist semanal.</p>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma periodização gerada ainda.</p>
            <p className="text-xs text-muted-foreground">Clique em "Gerar Periodização" para o agente criar uma sugestão.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
