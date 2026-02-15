import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Calendar, Sparkles, Loader2, RefreshCw, AlertTriangle, Clock, Zap, Target, TrendingUp
} from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { differenceInWeeks, format, isAfter, isBefore, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  dayLabels, calculateTMBCunningham, calculateTMBHarrisBenedictMale,
  calculateTMBHarrisBenedictFemale, calculateTMBFA, calculateAge, calculateGEE, triathlonMets
} from '@/lib/nutritionalCalcs';
import { PeriodizaBlockCard } from './PeriodizaBlockCard';

interface Props {
  clientId: string;
  client?: any;
  consultationId?: string;
  consultation?: any;
}

export function NPPeriodizationTab({ clientId, client, consultationId, consultation }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { fetchRunningZones, fetchRunningSchedule, fetchTriathlonSchedule } = useNutritionalPeriodization(clientId);

  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationType, setGenerationType] = useState('full');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [planType, setPlanType] = useState<'monthly' | '6_weeks'>('monthly');

  // Fetch athlete profile
  const { data: athleteProfile } = useQuery({
    queryKey: ['athlete-profile-periodization', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_profiles')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch training data
  const { data: runningZones = [] } = fetchRunningZones(consultationId || '');
  const { data: runningSchedule = [] } = fetchRunningSchedule(consultationId || '');
  const { data: triathlonSchedule = [] } = fetchTriathlonSchedule(consultationId || '');

  // Fetch active periodization
  const { data: activePeriodization, refetch: refetchPeriodization } = useQuery({
    queryKey: ['periodiza-active', clientId],
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

  // Fetch admin instructions for AI
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

  // Derived data
  const raceDate = athleteProfile?.target_deadline || consultation?.target_race_date;
  const weight = Number(consultation?.weight) || Number(athleteProfile?.current_weight) || 0;
  const height = Number(consultation?.height) || Number(athleteProfile?.height) || 0;
  const leanMassKg = Number(consultation?.lean_mass_kg) || 0;
  const fa = Number(consultation?.activity_factor) || 1.25;

  const age = useMemo(() => {
    const bd = athleteProfile?.birth_date;
    const cd = consultation?.consultation_date;
    return bd && cd ? calculateAge(bd, cd) : (consultation?.manual_age || 30);
  }, [athleteProfile, consultation]);

  const tmb = useMemo(() => {
    switch (consultation?.tmb_formula) {
      case 'calorimetry': return Number(consultation?.calorimetry_value) || 0;
      case 'cunningham': return leanMassKg > 0 ? calculateTMBCunningham(leanMassKg) : 0;
      case 'harris_benedict_female': return calculateTMBHarrisBenedictFemale(weight, height, age);
      default: return calculateTMBHarrisBenedictMale(weight, height, age);
    }
  }, [consultation, leanMassKg, weight, height, age]);

  const tmbFa = calculateTMBFA(tmb, fa);

  // GEE per day
  const geePerDay = useMemo(() => {
    const result = [0, 0, 0, 0, 0, 0, 0];
    const modality = consultation?.sport_modality || consultation?.training_type || '';
    const isTriathlon = modality.toLowerCase().includes('tri');

    if (isTriathlon && triathlonSchedule.length > 0) {
      triathlonSchedule.forEach((s: any) => {
        if (s.duration_minutes > 0 && s.met_value) {
          result[s.day_of_week] += calculateGEE(Number(s.met_value), weight, Number(s.duration_minutes));
        }
      });
    } else if (runningZones.length > 0 && runningSchedule.length > 0) {
      runningSchedule.forEach((s: any) => {
        const zone = runningZones.find((z: any) => z.id === s.zone_id);
        if (zone && s.duration_minutes > 0) {
          result[s.day_of_week] += calculateGEE(Number(zone.met_value), weight, Number(s.duration_minutes));
        }
      });
    }
    return result;
  }, [runningZones, runningSchedule, triathlonSchedule, weight, consultation]);

  // VCT per day
  const vctPerDay = useMemo(() => {
    const keys = ['vct_monday', 'vct_tuesday', 'vct_wednesday', 'vct_thursday', 'vct_friday', 'vct_saturday', 'vct_sunday'];
    return keys.map(k => Number(consultation?.[k]) || 0);
  }, [consultation]);

  // Training stimuli labels
  const trainingStimuli = useMemo(() => {
    const result: Record<number, string[]> = {};
    const modality = consultation?.sport_modality || consultation?.training_type || '';
    const isTriathlon = modality.toLowerCase().includes('tri');

    if (isTriathlon && triathlonSchedule.length > 0) {
      for (let d = 0; d < 7; d++) {
        const entries = triathlonSchedule.filter((s: any) => s.day_of_week === d && Number(s.duration_minutes) > 0);
        if (entries.length > 0) {
          result[d] = entries.map((e: any) => {
            const mod = e.modality === 'natacao' ? 'Nat.' : e.modality === 'corrida' ? 'Corr.' : e.modality === 'bike' ? 'Bike' : e.modality;
            return `${mod} ${e.duration_minutes}min`;
          });
        }
      }
    } else if (runningZones.length > 0 && runningSchedule.length > 0) {
      for (let d = 0; d < 7; d++) {
        const entries = runningSchedule.filter((s: any) => s.day_of_week === d && Number(s.duration_minutes) > 0);
        if (entries.length > 0) {
          result[d] = entries.map((e: any) => {
            const zone = runningZones.find((z: any) => z.id === e.zone_id);
            return `${zone?.zone_name || '?'} ${e.duration_minutes}min`;
          });
        }
      }
    }
    return result;
  }, [runningZones, runningSchedule, triathlonSchedule, consultation]);

  // Cycle calculations
  const cycleInfo = useMemo(() => {
    if (!raceDate) return null;
    const race = new Date(raceDate + 'T12:00:00');
    const startRef = periodStartDate ? new Date(periodStartDate + 'T12:00:00') : new Date();
    const weeksToRace = Math.max(differenceInWeeks(race, startRef), 1);
    const blockSize = planType === '6_weeks' ? 6 : 4;
    const numBlocks = Math.ceil(weeksToRace / blockSize);
    return { weeksToRace, numBlocks, blockSize, raceDate: race };
  }, [raceDate, periodStartDate, planType]);

  // Set defaults
  useEffect(() => {
    if (client?.start_date && !periodStartDate) setPeriodStartDate(client.start_date);
    if (client?.consultation_frequency === '6_weeks') setPlanType('6_weeks');
  }, [client]);

  useEffect(() => {
    if (activePeriodization) {
      if (activePeriodization.periodization_start_date) setPeriodStartDate(activePeriodization.periodization_start_date);
      if (activePeriodization.plan_adjustment_type) setPlanType(activePeriodization.plan_adjustment_type as 'monthly' | '6_weeks');
    }
  }, [activePeriodization]);

  const blocks = (activePeriodization?.blocks as any[]) || [];

  // Current block index
  const currentBlockIndex = useMemo(() => {
    const today = new Date();
    return blocks.findIndex((b: any) => {
      if (!b.date_start || !b.date_end) return false;
      const start = parseISO(b.date_start);
      const end = parseISO(b.date_end);
      return !isBefore(today, start) && !isAfter(today, end);
    });
  }, [blocks]);

  // Detect GEE changes
  const geeChanged = useMemo(() => {
    const snapshot = (activePeriodization as any)?.gee_snapshot as number[] | null;
    if (!snapshot || snapshot.length !== 7) return false;
    return geePerDay.some((v, i) => Math.abs(v - snapshot[i]) > 5);
  }, [geePerDay, activePeriodization]);

  // Build athlete context for AI
  const buildAthleteContext = () => {
    const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const trainingByDay: Record<string, any> = {};
    for (let d = 0; d < 7; d++) {
      trainingByDay[weekDays[d]] = {
        stimuli: trainingStimuli[d] || ['Descanso'],
        gee_kcal: Math.round(geePerDay[d]),
        tmbFa_kcal: Math.round(tmbFa),
        get_kcal: Math.round(tmbFa + geePerDay[d]),
        vct_planejado: vctPerDay[d] || null,
        ea: leanMassKg > 0 && vctPerDay[d] > 0 ? Number(((vctPerDay[d] - geePerDay[d]) / leanMassKg).toFixed(1)) : null,
      };
    }

    return {
      nome: client?.name || '—',
      modalidade: consultation?.sport_modality || consultation?.training_type || '—',
      objetivo: athleteProfile?.main_goal || consultation?.sport_goal || '—',
      prova_alvo: athleteProfile?.target_race || '—',
      data_prova: raceDate || null,
      semanas_ate_prova: cycleInfo?.weeksToRace || null,
      peso_kg: weight,
      altura_cm: height,
      mlg_kg: leanMassKg,
      gordura_pct: Number(consultation?.fat_percentage) || 0,
      tmb_kcal: Math.round(tmb),
      tmbFa_kcal: Math.round(tmbFa),
      fator_atividade: fa,
      plano_tipo: planType === '6_weeks' ? 'Consultas a cada 6 semanas' : 'Consultoria mensal (4 semanas)',
      bloco_semanas: cycleInfo?.blockSize || 4,
      restricoes_alimentares: athleteProfile?.food_allergies || 'Nenhuma',
      intolerancia_lactose: athleteProfile?.lactose_intolerance || null,
      intolerancia_gluten: athleteProfile?.gluten_intolerance || null,
      agenda_treinos_semanal: trainingByDay,
      gee_total_semanal_kcal: geePerDay.reduce((s, v) => s + v, 0),
    };
  };

  // Generate periodization
  const handleGenerate = async (type: string) => {
    if (!raceDate) {
      toast({ title: 'Data da prova não definida', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setGenerationType(type);
    try {
      const { data, error } = await supabase.functions.invoke('generate-periodization', {
        body: {
          athleteContext: buildAthleteContext(),
          adminInstructions: adminInstructions || '',
          knowledgeBase: knowledgeBase || [],
          generationType: type,
          planType,
          blockSize: cycleInfo?.blockSize || 4,
          weeksToRace: cycleInfo?.weeksToRace || 12,
          periodStartDate: periodStartDate || format(new Date(), 'yyyy-MM-dd'),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const nextVersion = (activePeriodization?.version || 0) + 1;

      if (activePeriodization?.id) {
        await supabase
          .from('periodiza_suggestions')
          .update({ is_active: false })
          .eq('id', activePeriodization.id);
      }

      const { error: insertError } = await supabase
        .from('periodiza_suggestions')
        .insert({
          user_id: user!.id,
          client_id: clientId,
          consultation_id: consultationId || null,
          version: nextVersion,
          suggestion_type: type,
          blocks: data.blocks,
          nutritionist_notes: data.nutritionistNotes || null,
          human_readable: data.humanReadable || null,
          is_active: true,
          periodization_start_date: periodStartDate || format(new Date(), 'yyyy-MM-dd'),
          plan_adjustment_type: planType,
          gee_snapshot: geePerDay,
        } as any);

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['periodiza-active'] });
      toast({ title: 'Periodização gerada!', description: `v${nextVersion} — ${data.blocks?.length || 0} blocos` });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Save a single block edit
  const handleSaveBlock = async (blockIndex: number, updatedBlock: any) => {
    if (!activePeriodization?.id) return;
    const newBlocks = [...blocks];
    newBlocks[blockIndex] = updatedBlock;
    const { error } = await supabase
      .from('periodiza_suggestions')
      .update({ blocks: newBlocks, updated_at: new Date().toISOString() })
      .eq('id', activePeriodization.id);
    if (error) {
      toast({ title: 'Erro ao salvar bloco', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['periodiza-active'] });
      toast({ title: `Bloco ${blockIndex + 1} salvo com sucesso` });
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase">Prova</span>
            </div>
            <p className="text-sm font-bold truncate">{athleteProfile?.target_race || '—'}</p>
            <p className="text-[10px] text-muted-foreground">{raceDate ? format(new Date(raceDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Não definida'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-[10px] text-muted-foreground uppercase">Contagem</span>
            </div>
            <p className="text-xl font-bold text-primary">{cycleInfo?.weeksToRace || '—'}</p>
            <p className="text-[10px] text-muted-foreground">semanas restantes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span className="text-[10px] text-muted-foreground uppercase">Fase Atual</span>
            </div>
            <p className="text-sm font-bold">{currentBlockIndex >= 0 ? blocks[currentBlockIndex]?.phase_name : 'Não iniciada'}</p>
            <p className="text-[10px] text-muted-foreground">{currentBlockIndex >= 0 ? `Bloco ${currentBlockIndex + 1} de ${blocks.length}` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <span className="text-[10px] text-muted-foreground uppercase">Energia</span>
            </div>
            <p className="text-sm font-bold">{Math.round(tmbFa)} kcal</p>
            <p className="text-[10px] text-muted-foreground">TMB×FA · MLG {leanMassKg ? `${leanMassKg.toFixed(1)}kg` : 'N/D'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Config + Generation */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Início</label>
              <Input type="date" value={periodStartDate} onChange={e => setPeriodStartDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Periodicidade</label>
              <Select value={planType} onValueChange={(v: 'monthly' | '6_weeks') => setPlanType(v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal (4 sem.)</SelectItem>
                  <SelectItem value="6_weeks">6 semanas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 col-span-2">
              <Button size="sm" onClick={() => handleGenerate('full')} disabled={generating || !raceDate} className="gap-1 text-xs h-8">
                {generating && generationType === 'full' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {blocks.length > 0 ? 'Nova versão' : 'Gerar Periodização'}
              </Button>
              {blocks.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => handleGenerate('recalculate')} disabled={generating} className="gap-1 text-xs h-8">
                  {generating && generationType === 'recalculate' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Recalcular
                </Button>
              )}
              {activePeriodization && (
                <Badge variant="outline" className="text-[10px] h-8 flex items-center">v{activePeriodization.version}</Badge>
              )}
            </div>
          </div>
          {!leanMassKg && (
            <p className="text-[10px] text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> MLG não disponível — Disponibilidade Energética não será calculada.
            </p>
          )}
        </CardContent>
      </Card>

      {/* GEE Changed Alert */}
      {geeChanged && blocks.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-3 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Treinos alterados desde a última geração. Periodização pode estar desatualizada.</span>
            </div>
            <Button
              size="sm" variant="outline"
              onClick={() => handleGenerate('recalculate')}
              disabled={generating}
              className="gap-1 text-xs h-7 shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              <RefreshCw className="h-3 w-3" /> Recalcular
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Visual Timeline */}
      {blocks.length > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Visão Geral do Ciclo</p>
            <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden">
              {blocks.map((block: any, i: number) => {
                const phase = block.phase_name || '';
                const PHASE_BG: Record<string, string> = {
                  'Base Metabólica': 'bg-blue-500/30 hover:bg-blue-500/40 border-blue-500/40',
                  'Transição': 'bg-amber-500/30 hover:bg-amber-500/40 border-amber-500/40',
                  'Performance': 'bg-emerald-500/30 hover:bg-emerald-500/40 border-emerald-500/40',
                  'Taper': 'bg-purple-500/30 hover:bg-purple-500/40 border-purple-500/40',
                };
                const colors = Object.entries(PHASE_BG).find(([k]) => phase.includes(k))?.[1] || 'bg-muted hover:bg-muted/80 border-border';
                const isCurrent = i === currentBlockIndex;

                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setExpandedBlock(expandedBlock === i ? null : i)}
                        className={`flex flex-col items-center justify-center text-[9px] font-medium border transition-all rounded-sm ${colors} ${isCurrent ? 'ring-2 ring-primary scale-105 z-10' : ''} ${expandedBlock === i ? 'ring-1 ring-foreground/30' : ''}`}
                        style={{ flex: 1, minWidth: '28px' }}
                      >
                        <span className="font-bold">B{i + 1}</span>
                        <span className="text-[8px] opacity-70">{phase.split(' ')[0]?.slice(0, 4)}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{block.phase_name}</p>
                      <p className="text-[10px] text-muted-foreground">{block.date_start} → {block.date_end}</p>
                      {block.phase_targets?.cho_gkg && <p className="text-[10px]">CHO: {block.phase_targets.cho_gkg} g/kg</p>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex gap-3 mt-2 justify-center">
              {['Base Metabólica', 'Transição', 'Performance', 'Taper'].map(phase => {
                const colors: Record<string, string> = {
                  'Base Metabólica': 'bg-blue-500/30',
                  'Transição': 'bg-amber-500/30',
                  'Performance': 'bg-emerald-500/30',
                  'Taper': 'bg-purple-500/30',
                };
                return (
                  <div key={phase} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-sm ${colors[phase]}`} />
                    <span className="text-[9px] text-muted-foreground">{phase}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Block Cards */}
      {blocks.length > 0 ? (
        <div className="space-y-2">
          {blocks.map((block: any, i: number) => (
            <PeriodizaBlockCard
              key={i}
              block={block}
              index={i}
              isExpanded={expandedBlock === i}
              isCurrent={i === currentBlockIndex}
              onToggle={() => setExpandedBlock(expandedBlock === i ? null : i)}
              onSave={(updated) => handleSaveBlock(i, updated)}
              trainingStimuli={trainingStimuli}
              geePerDay={geePerDay}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold">Nenhuma periodização gerada</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Configure as datas e clique em "Gerar Periodização" para criar os blocos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Notes */}
      {activePeriodization?.nutritionist_notes && (activePeriodization.nutritionist_notes as string[]).length > 0 && (
        <Card className="border-amber-500/20">
          <CardContent className="pt-3 pb-3 space-y-1">
            <p className="text-xs font-medium text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Notas e Alertas da IA
            </p>
            {(activePeriodization.nutritionist_notes as string[]).map((note: string, i: number) => (
              <p key={i} className="text-xs text-muted-foreground">• {note}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Human-readable summary */}
      {activePeriodization?.human_readable && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Resumo da IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs whitespace-pre-wrap text-muted-foreground">{activePeriodization.human_readable}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
