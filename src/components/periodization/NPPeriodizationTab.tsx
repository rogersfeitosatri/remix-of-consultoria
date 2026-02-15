import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Plus, ChevronDown, ChevronUp, Calendar, Wand2, Info, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addWeeks, format, startOfWeek, differenceInWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { dayLabels } from '@/lib/nutritionalCalcs';
import { PeriodizaAthleteDataCard } from './PeriodizaAthleteDataCard';
import { PeriodizaAdminDirectives } from './PeriodizaAdminDirectives';
import { PeriodizaSuggestionOutput } from './PeriodizaSuggestionOutput';
import { PeriodizaKnowledgeBase } from './PeriodizaKnowledgeBase';

interface Props {
  clientId: string;
  client?: any;
  consultationId?: string;
  consultation?: any;
}

const PHASE_COLORS: Record<string, string> = {
  'Base Metabólica': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Transição / Performance': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Performance Máxima': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Taper': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Competição': 'bg-red-500/20 text-red-400 border-red-500/30',
};

const DAILY_STRATEGY_OPTIONS = [
  { key: 'low_carb', label: 'Low Carb', emoji: '🔘' },
  { key: 'high_carb', label: 'High Carb', emoji: '🔘' },
  { key: 'train_low', label: 'Train Low', emoji: '🔘' },
  { key: 'recovery_support', label: 'Recovery Support', emoji: '🔘' },
  { key: 'long_reduced_cho', label: 'Longo c/ redução de CHO', emoji: '🔘' },
  { key: 'long_progressive_cho', label: 'Longo c/ progressão de CHO', emoji: '🔘' },
  { key: 'strategic_fasting', label: 'Jejum Estratégico', emoji: '🔘' },
  { key: 'reduced_intra', label: 'Intra reduzido (<30g/h)', emoji: '🔘' },
  { key: 'full_support', label: 'Suporte total (treino chave)', emoji: '🔘' },
];

const INTRA_STRATEGIES = [
  { key: '60', label: '60 g/h' },
  { key: '75', label: '75 g/h' },
  { key: '90', label: '90 g/h' },
];

const PHASE_EVIDENCE_NOTES: Record<string, string> = {
  'Base Metabólica': '📚 Burke et al. & Jeukendrup: conceito Train Low / Compete High. CHO ≤ 4 g/kg/dia, Proteína 1.8–2.2 g/kg, fibras elevadas, gorduras moderadas.',
  'Transição / Performance': '📚 CHO 4–5 g/kg/dia. Início de carb loading 24h. Pré treino 1–2 g/kg 2–3h antes. Intra 40→60 g/h progressivo. Cafeína 3 mg/kg.',
  'Performance Máxima': '📚 CHO ≥ 5 g/kg/dia. Pré longo 6 g/kg 24–48h. Simulação completa: café da manhã de prova, timing dos géis, cafeína e estratégia hídrica.',
  'Taper': '📚 ≤14 dias. Redução GEE, manutenção CHO alto. Monitorar peso. Glicogênio: recuperação <8h: 1–1.2 g/kg/h; 8–24h: 5–7 g/kg.',
};

const ergogenicSupplements = [
  { key: 'sup_creatine', label: 'Creatina' },
  { key: 'sup_beta_alanine', label: 'Beta-alanina' },
  { key: 'sup_caffeine', label: 'Cafeína' },
  { key: 'sup_nitrate', label: 'Nitrato' },
  { key: 'sup_recovery', label: 'Recovery 4:1' },
];

const antioxidantSupplements = [
  { key: 'sup_omega3', label: 'Ômega-3' },
  { key: 'sup_cherry_pure', label: 'Cherry Pure' },
  { key: 'sup_curcumin', label: 'Curcumina' },
  { key: 'sup_bromelain', label: 'Bromelina' },
  { key: 'sup_ganoderma', label: 'Ganoderma' },
  { key: 'sup_vitc_time_release', label: 'Vit. C Time Release' },
  { key: 'sup_vitd', label: 'Vitamina D' },
  { key: 'sup_broncovaxon', label: 'Broncovaxon' },
  { key: 'sup_nac', label: 'NAC' },
];

export function NPPeriodizationTab({ clientId, client, consultationId, consultation }: Props) {
  const { fetchPeriodizationWeeks, savePeriodizationWeek } = useNutritionalPeriodization(clientId);
  const { data: weeks = [] } = fetchPeriodizationWeeks(clientId);
  const [cycleStart, setCycleStart] = useState('');
  const [numWeeks, setNumWeeks] = useState(12);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [editingWeek, setEditingWeek] = useState<any>(null);
  const [mainTab, setMainTab] = useState('agent');

  // Fetch athlete profile
  const { data: athleteProfile, refetch: refetchProfile } = useQuery({
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

  // Cycle calculations
  const raceDate = athleteProfile?.target_deadline || consultation?.target_race_date;
  const cycleInfo = useMemo(() => {
    if (!raceDate) return null;
    const race = new Date(raceDate + 'T12:00:00');
    const today = new Date();
    const totalWeeks = Math.max(differenceInWeeks(race, today), 1);
    const totalMonths = (totalWeeks / 4.33).toFixed(1);
    const todayStr = format(today, 'yyyy-MM-dd');
    const currentWeek = weeks.find((w: any) => w.start_date <= todayStr && w.end_date >= todayStr);
    return { totalWeeks, totalMonths, currentPhase: currentWeek?.phase_name || 'Não definida', raceDate: race };
  }, [raceDate, weeks]);

  const getPhaseDistribution = (total: number) => {
    if (total >= 20) {
      return [
        { name: 'Base Metabólica', pct: 30, weeks: Math.round(total * 0.30) },
        { name: 'Transição / Performance', pct: 40, weeks: Math.round(total * 0.40) },
        { name: 'Performance Máxima', pct: 20, weeks: Math.round(total * 0.20) },
        { name: 'Taper', pct: 10, weeks: Math.max(Math.round(total * 0.10), 1) },
      ];
    }
    const taper = Math.max(Math.round(total * 0.10), 1);
    const perf = Math.max(Math.round(total * 0.20), 1);
    const trans = Math.max(Math.round(total * 0.35), 1);
    const base = Math.max(total - taper - perf - trans, 1);
    return [
      { name: 'Base Metabólica', pct: Math.round((base / total) * 100), weeks: base },
      { name: 'Transição / Performance', pct: Math.round((trans / total) * 100), weeks: trans },
      { name: 'Performance Máxima', pct: Math.round((perf / total) * 100), weeks: perf },
      { name: 'Taper', pct: Math.round((taper / total) * 100), weeks: taper },
    ];
  };

  const weight = Number(consultation?.weight) || 0;
  const leanMassKg = Number(consultation?.lean_mass_kg) || 0;

  const getEAStatus = (ea: number) => {
    if (ea <= 0) return { label: '—', color: '' };
    if (ea < 30) return { label: `${ea.toFixed(1)} kcal/kg — ⚠️ Risco RED-S`, color: 'text-destructive' };
    if (ea < 45) return { label: `${ea.toFixed(1)} kcal/kg — Zona de cautela`, color: 'text-amber-400' };
    return { label: `${ea.toFixed(1)} kcal/kg — ✅ Ideal`, color: 'text-emerald-400' };
  };

  const generateAutoPhases = () => {
    if (!raceDate) return;
    const today = new Date();
    const race = new Date(raceDate + 'T12:00:00');
    const totalWeeks = Math.max(differenceInWeeks(race, today), 4);
    const phases = getPhaseDistribution(totalWeeks);
    phases.push({ name: 'Competição', pct: 0, weeks: 1 });
    const adjustedTotal = totalWeeks + 1;
    const cycleStartDate = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    setCycleStart(cycleStartDate);
    setNumWeeks(adjustedTotal);
    const start = startOfWeek(today, { weekStartsOn: 1 });
    let weekCounter = 1;
    const consultFreq = client?.consultation_frequency;

    for (const phase of phases) {
      for (let i = 0; i < phase.weeks; i++) {
        const weekStart = addWeeks(start, weekCounter - 1);
        const weekEnd = addWeeks(weekStart, 1);
        weekEnd.setDate(weekEnd.getDate() - 1);
        const monthName = format(weekStart, 'MMMM', { locale: ptBR }).toUpperCase();
        const isCompetition = phase.name === 'Competição';
        const isAdjustment = weekCounter % 4 === 0 || (consultFreq === '6_weeks' && weekCounter % 6 === 0);

        let choGkg = null;
        let proteinGkg = null;
        if (phase.name === 'Base Metabólica') { choGkg = 4; proteinGkg = 2.0; }
        else if (phase.name === 'Transição / Performance') { choGkg = 5; proteinGkg = 1.8; }
        else if (phase.name === 'Performance Máxima') { choGkg = 6; proteinGkg = 1.6; }
        else if (phase.name === 'Taper') { choGkg = 6; proteinGkg = 1.6; }

        savePeriodizationWeek.mutate({
          client_id: clientId,
          cycle_start_date: cycleStartDate,
          week_number: weekCounter,
          month_name: monthName,
          start_date: format(weekStart, 'yyyy-MM-dd'),
          end_date: format(weekEnd, 'yyyy-MM-dd'),
          phase_name: phase.name,
          has_competition: isCompetition,
          competition_name: isCompetition && athleteProfile?.target_race ? athleteProfile.target_race : null,
          is_adjustment_week: isAdjustment,
          cho_gkg: choGkg,
          protein_gkg: proteinGkg,
        });
        weekCounter++;
      }
    }
    toast({ title: 'Ciclo gerado com sucesso', description: `${adjustedTotal} semanas distribuídas em ${phases.length} fases` });
  };

  const generateWeeks = () => {
    if (!cycleStart) return;
    const start = startOfWeek(new Date(cycleStart), { weekStartsOn: 1 });
    for (let i = 0; i < numWeeks; i++) {
      const weekStart = addWeeks(start, i);
      const weekEnd = addWeeks(weekStart, 1);
      weekEnd.setDate(weekEnd.getDate() - 1);
      const monthName = format(weekStart, 'MMMM', { locale: ptBR }).toUpperCase();
      savePeriodizationWeek.mutate({
        client_id: clientId,
        cycle_start_date: cycleStart,
        week_number: i + 1,
        month_name: monthName,
        start_date: format(weekStart, 'yyyy-MM-dd'),
        end_date: format(weekEnd, 'yyyy-MM-dd'),
      });
    }
  };

  const canAutoGenerate = !!raceDate;

  const toggleWeek = (weekNum: number) => {
    if (expandedWeek === weekNum) {
      setExpandedWeek(null);
      setEditingWeek(null);
    } else {
      setExpandedWeek(weekNum);
      const week = weeks.find((w: any) => w.week_number === weekNum);
      setEditingWeek(week ? { ...week, daily_strategies: week.daily_strategies || {} } : null);
    }
  };

  const updateEditing = (key: string, value: any) => {
    setEditingWeek((prev: any) => prev ? { ...prev, [key]: value } : null);
  };

  const updateDailyStrategy = (dayIndex: number, strategy: string) => {
    setEditingWeek((prev: any) => {
      if (!prev) return null;
      const current = prev.daily_strategies || {};
      const dayKey = dayIndex.toString();
      const newStrategies = { ...current };
      if (current[dayKey] === strategy) {
        delete newStrategies[dayKey];
      } else {
        newStrategies[dayKey] = strategy;
      }
      return { ...prev, daily_strategies: newStrategies };
    });
  };

  const saveWeek = () => {
    if (editingWeek) {
      savePeriodizationWeek.mutate(editingWeek);
    }
  };

  const weeksByPhase: Record<string, any[]> = {};
  weeks.forEach((w: any) => {
    const phase = w.phase_name || 'Sem Fase';
    if (!weeksByPhase[phase]) weeksByPhase[phase] = [];
    weeksByPhase[phase].push(w);
  });

  return (
    <div className="space-y-4">
      {/* Main Mode Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="agent" className="gap-1 text-xs"><Sparkles className="h-3.5 w-3.5" />🤖 Agente Periodiza</TabsTrigger>
          <TabsTrigger value="manual" className="gap-1 text-xs"><Calendar className="h-3.5 w-3.5" />Ciclo Manual</TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1 text-xs"><Info className="h-3.5 w-3.5" />Base de Conhecimento</TabsTrigger>
        </TabsList>

        {/* Agent Tab */}
        <TabsContent value="agent" className="space-y-4">
          <PeriodizaAthleteDataCard
            client={client}
            consultation={consultation}
            athleteProfile={athleteProfile}
            weeks={weeks}
            onRefresh={() => refetchProfile()}
          />
          <PeriodizaAdminDirectives />
          <PeriodizaSuggestionOutput
            clientId={clientId}
            consultationId={consultationId}
            consultation={consultation}
            athleteProfile={athleteProfile}
            client={client}
            weeks={weeks}
          />
        </TabsContent>

        {/* Manual Cycle Tab */}
        <TabsContent value="manual" className="space-y-4">
          {/* Cycle Info Banner */}
          {cycleInfo && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Prova</p>
                      <p className="text-sm font-bold">{athleteProfile?.target_race || '—'}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Semanas restantes</p>
                    <p className="text-xl font-bold text-primary">{cycleInfo.totalWeeks}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Meses</p>
                    <p className="text-xl font-bold">{cycleInfo.totalMonths}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Fase atual</p>
                    <Badge className={PHASE_COLORS[cycleInfo.currentPhase] || 'bg-muted text-muted-foreground'}>
                      {cycleInfo.currentPhase}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Data da Prova</p>
                    <p className="text-sm font-semibold">{format(cycleInfo.raceDate, 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phase Timeline */}
          {weeks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Linha do Tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
                  {Object.entries(weeksByPhase).map(([phase, phaseWeeks]) => {
                    const pct = (phaseWeeks.length / weeks.length) * 100;
                    const colors = PHASE_COLORS[phase] || 'bg-muted';
                    return (
                      <Tooltip key={phase}>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex items-center justify-center text-xs font-medium cursor-default border ${colors}`}
                            style={{ width: `${pct}%`, minWidth: '30px' }}
                          >
                            {pct > 12 ? `${phase.split(' ')[0]}` : ''}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{phase} — {phaseWeeks.length} semanas ({pct.toFixed(0)}%)</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Cycle */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Gerar Ciclo de Periodização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canAutoGenerate && weeks.length === 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Gerar ciclo automaticamente</p>
                    <p className="text-xs text-muted-foreground">BASE → TRANSIÇÃO → PERFORMANCE → TAPER → PROVA</p>
                    {cycleInfo && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {cycleInfo.totalWeeks} semanas até <strong>{athleteProfile?.target_race}</strong>
                      </p>
                    )}
                  </div>
                  <Button onClick={generateAutoPhases} size="sm" className="gap-1">
                    <Wand2 className="h-3.5 w-3.5" /> Gerar com Fases
                  </Button>
                </div>
              )}

              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Início do Ciclo</label>
                  <Input type="date" value={cycleStart} onChange={e => setCycleStart(e.target.value)} className="w-48" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nº Semanas</label>
                  <Input type="number" value={numWeeks} onChange={e => setNumWeeks(Number(e.target.value))} className="w-24" />
                </div>
                <Button onClick={generateWeeks} size="sm" className="gap-1" variant="outline">
                  <Plus className="h-3.5 w-3.5" /> Gerar Manual
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Weeks by Phase */}
          {Object.entries(weeksByPhase).map(([phase, phaseWeeks]) => (
            <Card key={phase}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={PHASE_COLORS[phase] || 'bg-muted'}>{phase}</Badge>
                    <span className="text-xs text-muted-foreground">{phaseWeeks.length} semanas</span>
                  </div>
                </div>
                {PHASE_EVIDENCE_NOTES[phase] && (
                  <p className="text-xs text-muted-foreground mt-2 p-2 rounded bg-muted/30 border border-border">
                    {PHASE_EVIDENCE_NOTES[phase]}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-1">
                {phaseWeeks.map((week: any) => (
                  <div key={week.id} className="border border-border rounded-lg">
                    <button
                      onClick={() => toggleWeek(week.week_number)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">S{week.week_number}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {week.start_date ? format(new Date(week.start_date + 'T12:00:00'), 'dd/MM') : ''} — {week.end_date ? format(new Date(week.end_date + 'T12:00:00'), 'dd/MM') : ''}
                        </span>
                        {week.has_competition && <Badge className="bg-red-500/20 text-red-400 text-xs">🏁 Prova</Badge>}
                        {week.is_adjustment_week && <Badge className="bg-amber-500/20 text-amber-400 text-xs">🔧 Ajuste</Badge>}
                        {week.cho_gkg && <Badge variant="outline" className="text-xs">CHO: {week.cho_gkg} g/kg</Badge>}
                        {week.protein_gkg && <Badge variant="outline" className="text-xs">PTN: {week.protein_gkg} g/kg</Badge>}
                      </div>
                      {expandedWeek === week.week_number ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {expandedWeek === week.week_number && editingWeek && (
                      <div className="px-3 pb-3 space-y-4 border-t border-border pt-3">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Fase</label>
                            <Select value={editingWeek.phase_name || ''} onValueChange={v => updateEditing('phase_name', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Base Metabólica">Base Metabólica</SelectItem>
                                <SelectItem value="Transição / Performance">Transição / Performance</SelectItem>
                                <SelectItem value="Performance Máxima">Performance Máxima</SelectItem>
                                <SelectItem value="Taper">Taper</SelectItem>
                                <SelectItem value="Competição">Competição</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">CHO (g/kg)</label>
                            <Input type="number" step="0.5" value={editingWeek.cho_gkg || ''} onChange={e => updateEditing('cho_gkg', Number(e.target.value) || null)} className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Proteína (g/kg)</label>
                            <Input type="number" step="0.1" value={editingWeek.protein_gkg || ''} onChange={e => updateEditing('protein_gkg', Number(e.target.value) || null)} className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Gordura (g/kg)</label>
                            <Input type="number" step="0.1" value={editingWeek.fat_gkg || ''} onChange={e => updateEditing('fat_gkg', Number(e.target.value) || null)} className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Intra CHO (g/h)</label>
                            <Select value={editingWeek.intra_cho_gh?.toString() || ''} onValueChange={v => updateEditing('intra_cho_gh', Number(v))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {INTRA_STRATEGIES.map(s => (
                                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {(editingWeek.phase_name === 'Transição / Performance' || editingWeek.phase_name === 'Performance Máxima') && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-2 rounded bg-muted/20 border border-border">
                            <div>
                              <label className="text-xs text-muted-foreground">Pré treino (g/kg)</label>
                              <Input type="number" step="0.5" value={editingWeek.pre_training_cho_gkg || ''} onChange={e => updateEditing('pre_training_cho_gkg', Number(e.target.value) || null)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Cafeína (mg/kg)</label>
                              <Input type="number" step="0.5" value={editingWeek.caffeine_mg_kg || ''} onChange={e => updateEditing('caffeine_mg_kg', Number(e.target.value) || null)} className="h-8 text-xs" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Carb Loading</label>
                              <Select value={editingWeek.carb_loading_type || ''} onValueChange={v => updateEditing('carb_loading_type', v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="24h">24h</SelectItem>
                                  <SelectItem value="48h">48h</SelectItem>
                                  <SelectItem value="none">Nenhum</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Tolerância GI (1-5)</label>
                              <Input type="number" min={1} max={5} value={editingWeek.gi_tolerance_rating || ''} onChange={e => updateEditing('gi_tolerance_rating', Number(e.target.value) || null)} className="h-8 text-xs" />
                            </div>
                          </div>
                        )}

                        {/* Daily Strategies */}
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Estratégias Diárias</label>
                          <div className="grid grid-cols-7 gap-1 mt-1">
                            {dayLabels.map((day, di) => {
                              const currentStrategy = (editingWeek.daily_strategies || {})[di.toString()];
                              return (
                                <div key={di} className="space-y-1">
                                  <p className="text-xs font-medium text-center">{day.slice(0, 3)}</p>
                                  <Select value={currentStrategy || ''} onValueChange={v => updateDailyStrategy(di, v)}>
                                    <SelectTrigger className="h-7 text-xs px-1"><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                      {DAILY_STRATEGY_OPTIONS.map(opt => (
                                        <SelectItem key={opt.key} value={opt.key} className="text-xs">{opt.emoji} {opt.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Energy Availability */}
                        {weight > 0 && leanMassKg > 0 && editingWeek.energy_availability != null && (
                          <div className="p-2 rounded border border-border bg-muted/20">
                            <p className="text-xs font-medium text-muted-foreground">Disponibilidade Energética</p>
                            <p className={`text-sm font-bold ${getEAStatus(editingWeek.energy_availability || 0).color}`}>
                              {getEAStatus(editingWeek.energy_availability || 0).label}
                            </p>
                          </div>
                        )}

                        {/* Competition & Adjustment */}
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox checked={editingWeek.has_competition || false} onCheckedChange={v => updateEditing('has_competition', v)} />
                            <label className="text-xs">Competição</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox checked={editingWeek.is_adjustment_week || false} onCheckedChange={v => updateEditing('is_adjustment_week', v)} />
                            <label className="text-xs">Semana de Ajuste</label>
                          </div>
                        </div>
                        {editingWeek.has_competition && (
                          <Input value={editingWeek.competition_name || ''} onChange={e => updateEditing('competition_name', e.target.value)} placeholder="Nome da competição" className="h-8 text-xs" />
                        )}

                        {editingWeek.phase_name === 'Performance Máxima' && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Simulação de Prova</label>
                            <Textarea value={editingWeek.race_simulation_notes || ''} onChange={e => updateEditing('race_simulation_notes', e.target.value)} rows={3} className="text-xs" placeholder="Café da manhã de prova, timing dos géis, cafeína, hidratação, sódio..." />
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Estratégia Hídrica</label>
                            <Input value={editingWeek.hydration_strategy || ''} onChange={e => updateEditing('hydration_strategy', e.target.value)} className="h-8 text-xs" placeholder="Ex: 500ml/h" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Estratégia de Sódio</label>
                            <Input value={editingWeek.sodium_strategy || ''} onChange={e => updateEditing('sodium_strategy', e.target.value)} className="h-8 text-xs" placeholder="Ex: 500-700mg/h" />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Planejamento Nutricional</label>
                          <Textarea value={editingWeek.nutritional_plan || ''} onChange={e => updateEditing('nutritional_plan', e.target.value)} rows={2} className="text-xs" />
                        </div>

                        {editingWeek.is_adjustment_week && (
                          <div className="p-2 rounded border border-amber-500/30 bg-amber-500/5">
                            <label className="text-xs font-medium text-amber-400">Notas do Ajuste</label>
                            <Textarea value={editingWeek.micro_adjustment_notes || ''} onChange={e => updateEditing('micro_adjustment_notes', e.target.value)} rows={2} className="text-xs mt-1" placeholder="Reavaliação, ajuste de CHO, mudança de estratégia..." />
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Recursos Ergogênicos</label>
                          <div className="flex flex-wrap gap-3 mt-1">
                            {ergogenicSupplements.map(s => (
                              <div key={s.key} className="flex items-center gap-1">
                                <Checkbox checked={editingWeek[s.key] || false} onCheckedChange={v => updateEditing(s.key, v)} />
                                <label className="text-xs">{s.label}</label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Suplementação Antioxidante e Reparo</label>
                          <div className="flex flex-wrap gap-3 mt-1">
                            {antioxidantSupplements.map(s => (
                              <div key={s.key} className="flex items-center gap-1">
                                <Checkbox checked={editingWeek[s.key] || false} onCheckedChange={v => updateEditing(s.key, v)} />
                                <label className="text-xs">{s.label}</label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Notas Suplementação</label>
                          <Textarea value={editingWeek.supplement_notes || ''} onChange={e => updateEditing('supplement_notes', e.target.value)} rows={1} className="text-xs" />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Solicitação de Exames</label>
                          <Textarea value={editingWeek.lab_exam_request || ''} onChange={e => updateEditing('lab_exam_request', e.target.value)} rows={1} className="text-xs" />
                        </div>

                        <Button size="sm" onClick={saveWeek} className="gap-1">
                          <Save className="h-3.5 w-3.5" /> Salvar Semana
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {/* Glycogen Reference */}
          {weeks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" /> Referências de Glicogênio (Burke & Jeukendrup)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-2 rounded bg-muted/30 border border-border">
                    <p className="font-medium">Recuperação &lt;8h</p>
                    <p className="text-muted-foreground">1–1.2 g/kg/h de CHO</p>
                  </div>
                  <div className="p-2 rounded bg-muted/30 border border-border">
                    <p className="font-medium">Recuperação 8–24h</p>
                    <p className="text-muted-foreground">5–7 g/kg de CHO</p>
                  </div>
                  <div className="p-2 rounded bg-muted/30 border border-border">
                    <p className="font-medium">High Training</p>
                    <p className="text-muted-foreground">6–10 g/kg de CHO</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {weeks.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma semana gerada. Use o botão acima para criar o ciclo de periodização.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge">
          <PeriodizaKnowledgeBase />
        </TabsContent>
      </Tabs>
    </div>
  );
}
