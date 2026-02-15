import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Calendar, Sparkles, Loader2, ChevronDown, ChevronUp, Save, RefreshCw,
  Copy, Check, Zap, Info, AlertTriangle, Plus, Clock
} from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { differenceInWeeks, format, addWeeks, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import {
  dayLabels, calculateTMBCunningham, calculateTMBHarrisBenedictMale,
  calculateTMBHarrisBenedictFemale, calculateTMBFA, calculateAge, calculateGEE, triathlonMets
} from '@/lib/nutritionalCalcs';

interface Props {
  clientId: string;
  client?: any;
  consultationId?: string;
  consultation?: any;
}

const PHASE_COLORS: Record<string, string> = {
  'Base Metabólica': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Transição': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Performance': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Taper': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const DAY_TYPE_COLORS: Record<string, string> = {
  low: 'bg-blue-500/15 text-blue-400',
  moderate: 'bg-amber-500/15 text-amber-400',
  high: 'bg-emerald-500/15 text-emerald-400',
  recovery: 'bg-muted text-muted-foreground',
};

export function NPPeriodizationTab({ clientId, client, consultationId, consultation }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { fetchRunningZones, fetchRunningSchedule, fetchTriathlonSchedule } = useNutritionalPeriodization(clientId);

  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationType, setGenerationType] = useState('full');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [planType, setPlanType] = useState<'monthly' | '6_weeks'>('monthly');
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});

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

  // TMB
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

  // GET and EA per day
  const weeklyEnergy = useMemo(() => {
    return dayLabels.map((day, i) => {
      const gee = geePerDay[i];
      const get = tmbFa + gee;
      const vct = vctPerDay[i];
      const ea = leanMassKg > 0 && vct > 0 ? (vct - gee) / leanMassKg : 0;
      return { day: day.slice(0, 3), tmbFa: Math.round(tmbFa), gee: Math.round(gee), get: Math.round(get), vct, ea };
    });
  }, [tmbFa, geePerDay, vctPerDay, leanMassKg]);

  // Training stimuli labels per day
  const trainingStimuli = useMemo(() => {
    const result: Record<number, string[]> = {};
    const modality = consultation?.sport_modality || consultation?.training_type || '';
    const isTriathlon = modality.toLowerCase().includes('tri');

    if (isTriathlon && triathlonSchedule.length > 0) {
      for (let d = 0; d < 7; d++) {
        const entries = triathlonSchedule.filter((s: any) => s.day_of_week === d && Number(s.duration_minutes) > 0);
        if (entries.length > 0) {
          result[d] = entries.map((e: any) => {
            const mod = e.modality === 'natacao' ? 'Natação' : e.modality === 'corrida' ? 'Corrida' : e.modality === 'bike' ? 'Bike' : e.modality;
            return `${mod} ${e.intensity} ${e.duration_minutes}min`;
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
    if (client?.start_date && !periodStartDate) {
      setPeriodStartDate(client.start_date);
    }
    if (client?.consultation_frequency === '6_weeks') {
      setPlanType('6_weeks');
    }
  }, [client]);

  // Load existing periodization settings
  useEffect(() => {
    if (activePeriodization) {
      if (activePeriodization.periodization_start_date) {
        setPeriodStartDate(activePeriodization.periodization_start_date);
      }
      if (activePeriodization.plan_adjustment_type) {
        setPlanType(activePeriodization.plan_adjustment_type as 'monthly' | '6_weeks');
      }
    }
  }, [activePeriodization]);

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

      // Deactivate previous
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
        });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['periodiza-active'] });
      toast({ title: 'Periodização gerada!', description: `Versão ${nextVersion} — ${data.blocks?.length || 0} blocos` });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Save admin notes for a block
  const saveBlockNotes = async (blockIndex: number) => {
    if (!activePeriodization?.id) return;
    const blocks = [...(activePeriodization.blocks as any[] || [])];
    if (blocks[blockIndex]) {
      blocks[blockIndex].notes_admin = editingNotes[blockIndex] || '';
      await supabase
        .from('periodiza_suggestions')
        .update({ blocks, updated_at: new Date().toISOString() })
        .eq('id', activePeriodization.id);
      queryClient.invalidateQueries({ queryKey: ['periodiza-active'] });
      toast({ title: 'Notas salvas' });
    }
  };

  // Apply as official plan
  const applyPlan = async () => {
    if (!activePeriodization?.id) return;
    toast({ title: 'Periodização aplicada como plano oficial!' });
  };

  // Copy block text
  const copyBlockText = (block: any, index: number) => {
    const lines = [
      `📋 ${block.phase_name} (${block.date_start} a ${block.date_end})`,
      '',
      `CHO: ${block.phase_targets?.cho_gkg || '—'} g/kg/dia`,
      `Proteína: ${block.phase_targets?.protein_gkg || '—'} g/kg/dia`,
      `Gorduras: ${block.phase_targets?.fat_guidance || '—'}`,
      `Fibras: ${block.phase_targets?.fiber_guidance || '—'}`,
      '',
      '📦 Suplementação diária:',
      ...(block.supplements_daily || []).map((s: any) => `  • ${s.name} ${s.dose} (${s.timing})`),
      '',
      '🏃 Estratégia do Longão:',
      `  Pré: ${block.long_run_strategy?.pre || '—'}`,
      `  Intra: ${block.long_run_strategy?.intra || '—'}`,
      `  Pós: ${block.long_run_strategy?.post || '—'}`,
      '',
      '📅 Tabela Semanal:',
      ...(block.weekly_table || []).map((d: any) => `  ${d.day}: [${d.type?.toUpperCase()}] CHO ${d.cho_gkg}g/kg — ${d.note || ''}`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedBlock(index);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  const blocks = (activePeriodization?.blocks as any[]) || [];

  // Cycle status
  const cycleStatus = useMemo(() => {
    if (!cycleInfo) return '—';
    if (cycleInfo.weeksToRace <= 2) return 'Taper / Pré-prova';
    if (cycleInfo.weeksToRace <= 4) return 'Pré-prova';
    return 'Em andamento';
  }, [cycleInfo]);

  return (
    <div className="space-y-4">
      {/* Config Panel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Configuração da Periodização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Início da periodização</label>
              <Input
                type="date"
                value={periodStartDate}
                onChange={e => setPeriodStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Prova-alvo</label>
              <div className="h-8 flex items-center text-xs font-medium px-3 rounded-md border border-border bg-muted/30">
                {raceDate ? `${athleteProfile?.target_race || ''} — ${format(new Date(raceDate + 'T12:00:00'), 'dd/MM/yyyy')}` : 'Não definida'}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Semanas até prova</label>
              <div className="h-8 flex items-center text-xs font-bold text-primary px-3 rounded-md border border-border bg-primary/5">
                {cycleInfo?.weeksToRace || '—'} semanas
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Periodicidade</label>
              <Select value={planType} onValueChange={(v: 'monthly' | '6_weeks') => setPlanType(v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal (4 semanas)</SelectItem>
                  <SelectItem value="6_weeks">6 semanas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
              <Badge variant="outline" className="text-xs h-8 flex items-center">
                <Clock className="h-3 w-3 mr-1" /> {cycleStatus}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => handleGenerate('full')} disabled={generating || !raceDate} className="gap-1 text-xs h-8">
              {generating && generationType === 'full' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Gerar Periodização
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleGenerate('current_block')} disabled={generating || !raceDate} className="gap-1 text-xs h-8">
              {generating && generationType === 'current_block' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Gerar bloco atual
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleGenerate('recalculate')} disabled={generating || !raceDate} className="gap-1 text-xs h-8">
              {generating && generationType === 'recalculate' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Recalcular com dados atuais
            </Button>
            {blocks.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={applyPlan} className="gap-1 text-xs h-8">
                  <Check className="h-3 w-3" /> Aplicar no plano
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleGenerate('full')} className="gap-1 text-xs h-8">
                  <Plus className="h-3 w-3" /> Nova versão
                </Button>
              </>
            )}
            {activePeriodization && (
              <Badge variant="outline" className="text-[10px] self-center">v{activePeriodization.version}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Energy Context (collapsed summary) */}
      {tmbFa > 0 && (
        <Card className="border-border/50">
          <CardContent className="pt-3 pb-3">
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="text-muted-foreground">TMB×FA+5%: <strong className="text-foreground">{Math.round(tmbFa)} kcal</strong></span>
              <span className="text-muted-foreground">GEE semanal: <strong className="text-foreground">{Math.round(geePerDay.reduce((s, v) => s + v, 0))} kcal</strong></span>
              <span className="text-muted-foreground">MLG: <strong className="text-foreground">{leanMassKg ? `${leanMassKg.toFixed(1)} kg` : 'N/D'}</strong></span>
              <span className="text-muted-foreground">Peso: <strong className="text-foreground">{weight} kg</strong></span>
              {!leanMassKg && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> MLG não disponível — EA não será calculada
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {blocks.length > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex gap-0.5 h-8 rounded-lg overflow-hidden">
              {blocks.map((block: any, i: number) => {
                const phase = block.phase_name || 'Base Metabólica';
                const colors = Object.entries(PHASE_COLORS).find(([k]) => phase.includes(k))?.[1] || 'bg-muted text-muted-foreground border-border';
                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setExpandedBlock(expandedBlock === i ? null : i)}
                        className={`flex items-center justify-center text-[10px] font-medium border transition-all ${colors} ${expandedBlock === i ? 'ring-2 ring-primary' : ''}`}
                        style={{ flex: 1, minWidth: '24px' }}
                      >
                        {blocks.length <= 8 ? `B${i + 1}` : ''}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{block.phase_name}</p>
                      <p className="text-[10px] text-muted-foreground">{block.date_start} → {block.date_end}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blocks */}
      {blocks.length > 0 ? (
        <div className="space-y-2">
          {blocks.map((block: any, i: number) => {
            const phase = block.phase_name || 'Bloco';
            const isExpanded = expandedBlock === i;
            const phaseColor = Object.entries(PHASE_COLORS).find(([k]) => phase.includes(k))?.[1] || 'bg-muted text-muted-foreground border-border';

            return (
              <Card key={i} className={isExpanded ? 'border-primary/30' : ''}>
                <button
                  onClick={() => setExpandedBlock(isExpanded ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs ${phaseColor}`}>Bloco {i + 1}</Badge>
                    <span className="text-xs font-medium">{phase}</span>
                    <span className="text-xs text-muted-foreground">{block.date_start} → {block.date_end}</span>
                    {block.phase_targets?.cho_gkg && (
                      <Badge variant="outline" className="text-[10px]">CHO: {block.phase_targets.cho_gkg} g/kg</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost" size="sm"
                      onClick={(e) => { e.stopPropagation(); copyBlockText(block, i); }}
                      className="h-6 w-6 p-0"
                    >
                      {copiedBlock === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isExpanded && (
                  <CardContent className="space-y-4 border-t border-border pt-4">
                    {/* Phase Targets */}
                    {block.phase_targets && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Diretrizes de Dieta</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="p-2 rounded bg-muted/30 border border-border">
                            <p className="text-[10px] text-muted-foreground">CHO (g/kg/dia)</p>
                            <p className="text-sm font-bold">{block.phase_targets.cho_gkg || '—'}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/30 border border-border">
                            <p className="text-[10px] text-muted-foreground">Proteína (g/kg/dia)</p>
                            <p className="text-sm font-bold">{block.phase_targets.protein_gkg || '—'}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/30 border border-border">
                            <p className="text-[10px] text-muted-foreground">Gorduras</p>
                            <p className="text-sm font-bold">{block.phase_targets.fat_guidance || '—'}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/30 border border-border">
                            <p className="text-[10px] text-muted-foreground">Fibras</p>
                            <p className="text-sm font-bold">{block.phase_targets.fiber_guidance || '—'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Supplements */}
                    {block.supplements_daily && block.supplements_daily.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Suplementação Diária</p>
                        <div className="flex flex-wrap gap-1">
                          {block.supplements_daily.map((s: any, si: number) => (
                            <Badge key={si} variant="outline" className="text-[10px]">
                              {s.name} {s.dose} ({s.timing})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Long Run Strategy */}
                    {block.long_run_strategy && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">🏃 Estratégia do Longão</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 rounded bg-muted/20 border border-border">
                            <p className="text-[10px] text-muted-foreground">Pré-longão</p>
                            <p className="text-xs">{block.long_run_strategy.pre || '—'}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/20 border border-border">
                            <p className="text-[10px] text-muted-foreground">Intra-longão</p>
                            <p className="text-xs">{block.long_run_strategy.intra || '—'}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/20 border border-border">
                            <p className="text-[10px] text-muted-foreground">Pós-longão</p>
                            <p className="text-xs">{block.long_run_strategy.post || '—'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Functional Supplements */}
                    {block.functional_supps && block.functional_supps.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">💊 Suplementação Funcional</p>
                        <div className="flex flex-wrap gap-1">
                          {block.functional_supps.map((s: string, si: number) => (
                            <Badge key={si} variant="outline" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pre/Intra Strategy */}
                    {block.pre_intra_strategy && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">⚡ Pré e Intra Treino</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded bg-muted/20 border border-border">
                            <p className="text-[10px] text-muted-foreground">Pré-treino</p>
                            <p className="text-xs">{block.pre_intra_strategy.pre || '—'}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/20 border border-border">
                            <p className="text-[10px] text-muted-foreground">Intra-treino</p>
                            <p className="text-xs">{block.pre_intra_strategy.intra || '—'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Weekly Table */}
                    {block.weekly_table && block.weekly_table.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">📅 Tabela Semanal</p>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[10px] font-bold w-16"></TableHead>
                                {block.weekly_table.map((d: any, di: number) => (
                                  <TableHead key={di} className="text-[10px] text-center font-bold">{d.day}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {/* Training stimulus row */}
                              <TableRow>
                                <TableCell className="text-[10px] font-semibold py-1 whitespace-nowrap">Estímulo</TableCell>
                                {block.weekly_table.map((d: any, di: number) => (
                                  <TableCell key={di} className="text-[9px] text-center py-1 text-muted-foreground max-w-[80px]">
                                    {trainingStimuli[di]?.join(', ') || 'Descanso'}
                                  </TableCell>
                                ))}
                              </TableRow>
                              {/* GEE */}
                              <TableRow>
                                <TableCell className="text-[10px] font-semibold py-1">GEE</TableCell>
                                {block.weekly_table.map((_: any, di: number) => (
                                  <TableCell key={di} className="text-[10px] text-center py-1">
                                    {geePerDay[di] > 0 ? `${Math.round(geePerDay[di])}` : '—'}
                                  </TableCell>
                                ))}
                              </TableRow>
                              {/* Type */}
                              <TableRow>
                                <TableCell className="text-[10px] font-semibold py-1">Tipo</TableCell>
                                {block.weekly_table.map((d: any, di: number) => (
                                  <TableCell key={di} className="py-1 text-center">
                                    <Badge className={`text-[9px] ${DAY_TYPE_COLORS[d.type] || ''}`}>
                                      {d.type?.toUpperCase() || '—'}
                                    </Badge>
                                  </TableCell>
                                ))}
                              </TableRow>
                              {/* CHO */}
                              <TableRow>
                                <TableCell className="text-[10px] font-semibold py-1">CHO g/kg</TableCell>
                                {block.weekly_table.map((d: any, di: number) => (
                                  <TableCell key={di} className="text-[10px] text-center py-1 font-medium">{d.cho_gkg || '—'}</TableCell>
                                ))}
                              </TableRow>
                              {/* Pre */}
                              <TableRow>
                                <TableCell className="text-[10px] font-semibold py-1">Pré</TableCell>
                                {block.weekly_table.map((d: any, di: number) => (
                                  <TableCell key={di} className="text-[9px] text-center py-1 text-muted-foreground">{d.pre_training || '—'}</TableCell>
                                ))}
                              </TableRow>
                              {/* Intra */}
                              <TableRow>
                                <TableCell className="text-[10px] font-semibold py-1">Intra</TableCell>
                                {block.weekly_table.map((d: any, di: number) => (
                                  <TableCell key={di} className="text-[9px] text-center py-1 text-muted-foreground">{d.intra_training || '—'}</TableCell>
                                ))}
                              </TableRow>
                              {/* Post */}
                              <TableRow>
                                <TableCell className="text-[10px] font-semibold py-1">Pós</TableCell>
                                {block.weekly_table.map((d: any, di: number) => (
                                  <TableCell key={di} className="text-[9px] text-center py-1 text-muted-foreground">{d.post_training || '—'}</TableCell>
                                ))}
                              </TableRow>
                              {/* Note */}
                              <TableRow>
                                <TableCell className="text-[10px] font-semibold py-1">Nota</TableCell>
                                {block.weekly_table.map((d: any, di: number) => (
                                  <TableCell key={di} className="text-[9px] text-center py-1 italic text-muted-foreground">{d.note || ''}</TableCell>
                                ))}
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Admin Notes */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Observações do Nutri</label>
                      <Textarea
                        value={editingNotes[i] ?? block.notes_admin ?? ''}
                        onChange={e => setEditingNotes(prev => ({ ...prev, [i]: e.target.value }))}
                        rows={2}
                        className="text-xs mt-1"
                        placeholder="Notas que sobrescrevem as sugestões da IA..."
                      />
                      <Button size="sm" variant="outline" onClick={() => saveBlockNotes(i)} className="gap-1 text-xs h-7 mt-1">
                        <Save className="h-3 w-3" /> Salvar notas
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-sm font-semibold">Nenhuma periodização gerada</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Configure as datas acima e clique em "Gerar Periodização" para criar os blocos automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Nutritionist Notes (from AI) */}
      {activePeriodization?.nutritionist_notes && (activePeriodization.nutritionist_notes as string[]).length > 0 && (
        <Card className="border-amber-500/20">
          <CardContent className="pt-3 pb-3 space-y-1">
            <p className="text-xs font-medium text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Notas e Alertas
            </p>
            {(activePeriodization.nutritionist_notes as string[]).map((note: string, i: number) => (
              <p key={i} className="text-xs text-muted-foreground">• {note}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
