import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Target, ChevronRight, ChevronLeft, ChevronDown, Sparkles, Loader2,
  Calendar, Dumbbell, Zap, CheckCircle2, Clock, ArrowRight,
  CalendarDays, RefreshCw, Eye, Plus, Trash2, Moon, Sun,
  Pill, Droplets, Flame, ShieldCheck, AlertTriangle, TrendingUp, Beaker, Apple
} from 'lucide-react';
import { differenceInWeeks, parseISO, format, addWeeks, isAfter, isBefore, differenceInDays } from 'date-fns';
import { useThemeToggle } from '@/App';
import { DayDynamicDetailModal } from './DayDynamicDetailModal';
import { PeriodizationExportButton } from './PeriodizationExportButton';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const SHIFTS = ['Manhã', 'Tarde', 'Noite'];
const INTENSITIES = ['Leve', 'Moderado', 'Intenso'];
const PRIORITIES = ['A', 'B', 'C'];
const MODALITIES = ['Corrida', 'Natação', 'Ciclismo', 'Força', 'Day Off'];
const DURATIONS = ['30', '45', '60', '75', '90', '120', '150', '180'];

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'Base': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  'Específica': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  'Polimento': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  'Transição': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', dot: 'bg-purple-500' },
};

const getPhaseStyle = (name: string) =>
  Object.entries(PHASE_COLORS).find(([k]) => name.includes(k))?.[1] || { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', dot: 'bg-muted-foreground' };

const CHO_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  'High': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: '🔋' },
  'Medium': { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: '⚡' },
  'Low': { bg: 'bg-blue-500/15', text: 'text-blue-400', icon: '🧊' },
  'Recovery': { bg: 'bg-purple-500/15', text: 'text-purple-400', icon: '💤' },
};

interface SupplementInfo {
  emoji: string;
  name: string;
  dose: string;
  timing?: string;
  note?: string;
  active: boolean;
}

interface PhaseNutrientInfo {
  protein: string;
  fat: string;
  hydration: string;
  preTiming: string;
  intraTiming: string;
  postTiming: string;
  alerts: { type: 'warning' | 'success' | 'info'; text: string }[];
}

function getPhaseSupplements(phaseName: string): SupplementInfo[] {
  const isBase = phaseName.includes('Base');
  const isEspecifica = phaseName.includes('Específica');
  const isPolimento = phaseName.includes('Polimento');
  const isTransicao = phaseName.includes('Transição');

  return [
    {
      emoji: '💪',
      name: 'Creatina',
      dose: isBase ? '20g/dia (4x5g) por 5-7d → 3-5g/dia' : '3-5g/dia manutenção',
      timing: 'Pós-treino com refeição rica em CHO',
      active: true,
      note: isBase ? 'Fase de carregamento — pode haver ganho de 1-2kg de peso hídrico' : undefined,
    },
    {
      emoji: '⚡',
      name: 'Beta-alanina',
      dose: '3.2-6.4g/dia (doses fracionadas de 0.8-1.6g)',
      timing: 'Distribuir ao longo do dia para evitar parestesia',
      active: isBase || isEspecifica || isPolimento,
      note: isBase ? 'Início do carregamento — efeito pleno em 4-8 semanas' : undefined,
    },
    {
      emoji: '☕',
      name: 'Cafeína',
      dose: '3-6 mg/kg',
      timing: isPolimento ? '60min pré-prova' : '60min pré-treinos intensos',
      active: isEspecifica || isPolimento,
      note: isEspecifica ? 'Testar protocolo individual (dose, timing, tolerância GI)' :
             isPolimento ? 'Dose validada — usar protocolo testado na Específica' : undefined,
    },
    {
      emoji: '🥬',
      name: 'Nitrato (Beterraba)',
      dose: '300-600mg nitrato (≈500mL suco beterraba)',
      timing: isPolimento ? '2-3h pré-prova (carregamento 3-5d antes)' : '2-3h pré-treinos de alta intensidade',
      active: isEspecifica || isPolimento,
      note: isPolimento ? 'Carregamento: 3-5 dias consecutivos pré-prova' : undefined,
    },
    {
      emoji: '🧂',
      name: 'Eletrólitos (Na/K)',
      dose: '300-600mg Na/L de fluido',
      timing: 'Durante treinos >60min e na prova',
      active: true,
      note: isPolimento ? 'Ensaiar protocolo de prova com eletrólitos' : undefined,
    },
    {
      emoji: '🩸',
      name: 'Ferro',
      dose: 'Conforme exames — ferritina > 35ng/mL ideal',
      timing: 'Manhã, com vitamina C, longe de chá/café',
      active: isBase || isEspecifica,
      note: isBase ? 'Solicitar hemograma + ferritina no início do ciclo' : undefined,
    },
    {
      emoji: '☀️',
      name: 'Vitamina D',
      dose: '1000-2000 UI/dia (ajustar conforme 25(OH)D)',
      timing: 'Com refeição contendo gordura',
      active: true,
      note: isBase ? 'Dosar 25(OH)D — meta: 40-60 ng/mL' : undefined,
    },
    {
      emoji: '🐟',
      name: 'Ômega-3 (EPA/DHA)',
      dose: '1-2g EPA+DHA/dia',
      timing: 'Com refeições principais',
      active: isTransicao || isBase,
      note: isTransicao ? 'Foco anti-inflamatório e recuperação pós-ciclo' : undefined,
    },
  ];
}

function getPhaseNutrients(phaseName: string): PhaseNutrientInfo {
  const isBase = phaseName.includes('Base');
  const isEspecifica = phaseName.includes('Específica');
  const isPolimento = phaseName.includes('Polimento');
  const isTransicao = phaseName.includes('Transição');

  if (isPolimento) return {
    protein: '1.4-1.6',
    fat: '20-25%',
    hydration: '5-10 mL/kg',
    preTiming: 'CHO 1-4g/kg 3-4h antes + 30-60g 30min antes da prova',
    intraTiming: '60-90g CHO/h (treinar tolerância GI) + Na 500-700mg/h',
    postTiming: '1.0-1.2g CHO/kg/h + 0.3g PTN/kg nas primeiras 2h',
    alerts: [
      { type: 'success', text: 'Supercompensação de glicogênio: CHO 10-12g/kg nos 2-3 dias pré-prova' },
      { type: 'warning', text: 'Evitar fibras e alimentos novos 48h antes da prova' },
      { type: 'info', text: 'Ensaio geral nutricional: testar tudo que será usado na prova (gel, isotônico, cafeína)' },
      { type: 'warning', text: 'Train-Low PROIBIDO — máxima disponibilidade de CHO para qualidade dos treinos' },
      { type: 'info', text: 'Treinar o gut training: adaptar intestino a 60-90g CHO/h para a prova' },
    ],
  };
  if (isEspecifica) return {
    protein: '1.6-2.0',
    fat: '25-30%',
    hydration: '5-8 mL/kg',
    preTiming: 'CHO 1-2g/kg 2-3h antes (variar conforme train-low)',
    intraTiming: '30-60g CHO/h em sessões de alta intensidade',
    postTiming: '0.8g CHO/kg + 0.4g PTN/kg imediato após sessões intensas',
    alerts: [
      { type: 'info', text: 'Train-Low reduzido: aplicar em sessões de baixa prioridade (Prio B/C) para adaptação metabólica' },
      { type: 'warning', text: 'Monitorar sinais de fadiga crônica — ajustar se recuperação estiver comprometida' },
    ],
  };
  if (isTransicao) return {
    protein: '1.2-1.6',
    fat: '25-35%',
    hydration: '4-6 mL/kg',
    preTiming: 'Refeição normal 2-3h antes, sem protocolos rígidos',
    intraTiming: 'Apenas água para sessões leves <60min',
    postTiming: 'Refeição equilibrada — sem urgência de timing',
    alerts: [
      { type: 'success', text: 'Foco em recuperação sistêmica: sono, anti-inflamatórios naturais (Ômega-3, polifenóis)' },
      { type: 'info', text: 'Reavaliar composição corporal e exames laboratoriais antes do próximo ciclo' },
    ],
  };
  // Base
  return {
    protein: '1.6-2.0',
    fat: '25-35%',
    hydration: '5-8 mL/kg',
    preTiming: 'CHO 1-2g/kg 2-3h antes (Train-Low: treino em jejum ou low-CHO)',
    intraTiming: 'Água para sessões <75min; Train-Low: sem CHO intra',
    postTiming: '0.8g CHO/kg + 0.3g PTN/kg (ou Sleep-Low: retardar CHO até manhã seguinte)',
    alerts: [
      { type: 'info', text: 'Train-Low PERMITIDO: aplicar métodos de adaptação metabólica (sleep-low, fasted training, sem CHO intra)' },
      { type: 'warning', text: 'Antioxidantes em alta dose podem bloquear adaptações — evitar suplementação de Vit C/E pós-treino' },
      { type: 'info', text: 'Priorizar alimentos ricos em ferro heme + screening de ferritina/hemoglobina' },
    ],
  };
}

interface Props {
  clientId: string;
  raceDate: string;
  raceName: string;
  startDate: string;
  onStartDateChange: (d: string) => void;
  journeyPhases: any[];
  journeyWeeks: any[];
  allSessions: any[];
  allDynamics: any[];
  suggestPhases: (totalWeeks: number, startDate: string, raceDate?: string) => any[];
  recalcPhaseDates: (phases: any[], startDate: string, raceDate?: string) => any[];
  onSavePhases: (phases: any[]) => void;
  isSavingPhases: boolean;
  onSaveSessions: (weekId: string, sessions: any[]) => void;
  isSavingSessions: boolean;
  onGenerateDynamics: (weekId: string, phase: any, onSuccess?: (dynamics: any[]) => void) => void;
  isGeneratingDynamics: boolean;
  onSaveDynamics: (weekId: string, dynamics: any[]) => void;
  isSavingDynamics: boolean;
}

export function PeriodizationWizard({
  clientId, raceDate, raceName, startDate, onStartDateChange,
  journeyPhases, journeyWeeks, allSessions, allDynamics,
  suggestPhases, recalcPhaseDates, onSavePhases, isSavingPhases,
  onSaveSessions, isSavingSessions,
  onGenerateDynamics, isGeneratingDynamics,
  onSaveDynamics, isSavingDynamics,
}: Props) {
  // Determine wizard step based on data state
  const hasPhases = journeyPhases.length > 0;
  const [activeStep, setActiveStep] = useState(hasPhases ? 1 : 0);
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);
  const [initialCHO, setInitialCHO] = useState('4');
  const [suggestedPhases, setSuggestedPhases] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsDirty, setSessionsDirty] = useState(false);
  const [expandedDayIdx, setExpandedDayIdx] = useState<number | null>(null);
  const [localDynamics, setLocalDynamics] = useState<any[]>([]);

  const totalWeeks = raceDate && startDate
    ? Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1)
    : 0;

  const today = new Date();

  // Current active phase (by date)
  const currentPhase = useMemo(() => {
    return journeyPhases.find(p => {
      if (!p.start_date || !p.end_date) return false;
      return !isBefore(today, parseISO(p.start_date)) && !isAfter(today, parseISO(p.end_date));
    });
  }, [journeyPhases]);

  // Auto-select current phase
  useEffect(() => {
    if (currentPhase && hasPhases) {
      const idx = journeyPhases.findIndex(p => p.id === currentPhase.id);
      if (idx >= 0) setSelectedPhaseIdx(idx);
    }
  }, [currentPhase, hasPhases]);

  // Selected phase and its week
  const selectedPhase = hasPhases ? journeyPhases[selectedPhaseIdx] : null;
  const selectedWeek = selectedPhase
    ? journeyWeeks.find(w => w.journey_phase_id === selectedPhase.id && w.week_in_phase === 1)
    : null;
  const weekSessions = selectedWeek
    ? allSessions.filter(s => s.journey_week_id === selectedWeek.id)
    : [];
  const weekDynamicsFromDB = selectedWeek
    ? allDynamics.filter(d => d.journey_week_id === selectedWeek.id)
    : [];
  const weekDynamics = localDynamics.length > 0 ? localDynamics : weekDynamicsFromDB;

  // Init sessions when phase/week changes — now supports multiple sessions per day
  useEffect(() => {
    if (weekSessions.length > 0) {
      setSessions(weekSessions.map(s => ({ ...s })));
    } else if (selectedWeek) {
      // One default session per day
      setSessions(DAYS.map((_, i) => ({
        journey_week_id: selectedWeek.id,
        day_of_week: i,
        modality: '',
        shift: 'Manhã',
        intensity: 'Moderado',
        duration_minutes: '60',
        priority: 'B',
        metabolic_objective: '',
        is_day_off: false,
      })));
    }
    setSessionsDirty(false);
    setLocalDynamics([]); // Clear local dynamics when phase/week changes
  }, [selectedWeek?.id, weekSessions.length]);

  // Auto-suggest phases
  useEffect(() => {
    if (totalWeeks > 0 && startDate && !hasPhases) {
      const suggested = suggestPhases(totalWeeks, startDate, raceDate);
      setSuggestedPhases(suggested);
    }
  }, [totalWeeks, startDate, hasPhases, raceDate]);

  const updateSession = (sessionIdx: number, field: string, value: string | boolean) => {
    setSessionsDirty(true);
    setSessions(prev => prev.map((s, i) => i === sessionIdx ? { ...s, [field]: value } : s));
  };

  const addSessionToDay = (dayIdx: number) => {
    setSessionsDirty(true);
    if (!selectedWeek) return;
    setSessions(prev => [...prev, {
      journey_week_id: selectedWeek.id,
      day_of_week: dayIdx,
      modality: '',
      shift: 'Tarde',
      intensity: 'Moderado',
      duration_minutes: '60',
      priority: 'B',
      metabolic_objective: '',
      is_day_off: false,
    }]);
  };

  const removeSession = (sessionIdx: number) => {
    setSessionsDirty(true);
    setSessions(prev => prev.filter((_, i) => i !== sessionIdx));
  };

  const toggleDayOff = (dayIdx: number) => {
    setSessionsDirty(true);
    const daySessions = sessions.filter(s => s.day_of_week === dayIdx);
    if (daySessions.length === 1 && daySessions[0].is_day_off) {
      // Turn off day-off
      setSessions(prev => prev.map(s =>
        s.day_of_week === dayIdx ? { ...s, is_day_off: false, modality: '' } : s
      ));
    } else {
      // Set as day off — keep only 1 session for this day
      setSessions(prev => [
        ...prev.filter(s => s.day_of_week !== dayIdx),
        {
          journey_week_id: selectedWeek?.id || '',
          day_of_week: dayIdx,
          modality: 'Day Off',
          shift: 'Manhã',
          intensity: 'Leve',
          priority: 'C',
          metabolic_objective: 'Recuperação',
          is_day_off: true,
        },
      ]);
    }
  };

  const handleSaveSessions = () => {
    if (selectedWeek) {
      onSaveSessions(selectedWeek.id, sessions.map(({ id, ...rest }) => rest));
      setSessionsDirty(false);
    }
  };

  const handleGenerateDynamics = async () => {
    if (!selectedPhase) {
      toast({ title: 'Nenhuma fase selecionada', variant: 'destructive' });
      return;
    }

    // If selectedWeek is null (journeyWeeks not loaded yet), fetch directly from DB
    let weekToUse = selectedWeek;
    if (!weekToUse) {
      const { data: fetchedWeek } = await supabase
        .from('journey_weeks')
        .select('*')
        .eq('journey_phase_id', selectedPhase.id)
        .eq('week_in_phase', 1)
        .maybeSingle();
      weekToUse = fetchedWeek;
    }

    if (!weekToUse) {
      toast({ title: 'Nenhuma semana encontrada', description: 'Configure as fases primeiro.', variant: 'destructive' });
      return;
    }

    if (!hasSomeSessions) {
      toast({ title: 'Cadastre os treinos primeiro', description: 'Vá para a etapa Treinos e salve as sessões.', variant: 'destructive' });
      return;
    }
    // Auto-save sessions if dirty before generating
    if (sessionsDirty) {
      onSaveSessions(weekToUse.id, sessions.map(({ id, ...rest }) => rest));
      setSessionsDirty(false);
      // Small delay to let save propagate
      await new Promise(r => setTimeout(r, 800));
    }
    onGenerateDynamics(weekToUse.id, selectedPhase, (newDynamics) => {
      setLocalDynamics(newDynamics);
    });
  };

  const hasSomeSessions = sessions.some(s => (s.modality && s.modality.trim() !== '') || s.is_day_off);

  // CHO progression based on initialCHO (Base phase reference)
  const getChoRangeForPhase = (phaseName: string, baseChoGkg: number) => {
    const v = baseChoGkg;
    if (phaseName.includes('Base')) return `${Math.max(v - 1, 2)}-${v + 1}`;
    if (phaseName.includes('Específica')) return `${v}-${v + 2}`;
    if (phaseName.includes('Polimento')) return `${v + 2}-${Math.round(v * 2.5)}`;
    if (phaseName.includes('Transição')) return `${Math.max(v - 1, 2)}-${v + 1}`;
    return `${v}-${v + 2}`;
  };

  // Progress calculations
  const weeksToRace = raceDate ? Math.max(differenceInWeeks(parseISO(raceDate), today), 0) : 0;
  const daysToRace = raceDate ? Math.max(differenceInDays(parseISO(raceDate), today), 0) : 0;
  const elapsedWeeks = totalWeeks - weeksToRace;
  const progressPercent = totalWeeks > 0 ? Math.min((elapsedWeeks / totalWeeks) * 100, 100) : 0;

  const STEPS = [
    { label: 'Cadastro', icon: Target },
    { label: 'Treinos', icon: Dumbbell },
    { label: 'Dinâmica', icon: Sparkles },
    { label: 'Visão Geral', icon: Eye },
  ];

  // ===== RENDER =====

  const { theme, setTheme } = useThemeToggle();

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1 p-3 rounded-xl bg-muted/30 border border-border">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === activeStep;
          const isDone = hasPhases && i === 0;
          return (
            <div key={i} className="flex items-center flex-1">
              <button
                onClick={() => {
                  if (i === 0 || hasPhases) setActiveStep(i);
                }}
                disabled={!hasPhases && i > 0}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all w-full ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : isDone
                    ? 'text-emerald-400 hover:bg-emerald-500/10'
                    : 'text-muted-foreground hover:bg-muted/50'
                } ${!hasPhases && i > 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-emerald-500/20' : 'bg-muted'
                }`}>
                  {isDone && !isActive ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                </div>
                <span className="text-xs font-medium hidden sm:block">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mx-0.5" />
              )}
            </div>
          );
        })}
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="ml-2 p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors shrink-0"
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>

      {/* ===== STEP 0: Cadastro Inicial ===== */}
      {activeStep === 0 && (
        <Card className="overflow-hidden">
          <CardContent className="pt-6 space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-foreground">Configurar Periodização</h2>
              <p className="text-sm text-muted-foreground">Defina a prova alvo e o sistema monta toda a progressão</p>
            </div>

            {/* Race Target - Hero */}
            {raceName || raceDate ? (
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-2 border-primary/30 text-center">
                <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="text-xl font-bold text-foreground">{raceName || 'Prova Alvo'}</h3>
                {raceDate && (
                  <>
                    <p className="text-lg font-semibold text-primary mt-1">{format(parseISO(raceDate), 'dd/MM/yyyy')}</p>
                    {totalWeeks > 0 && (
                      <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold text-primary">{totalWeeks} semanas até a prova</span>
                      </div>
                    )}
                  </>
                )}
                {!raceDate && (
                  <p className="text-sm text-muted-foreground mt-2">Defina a prova alvo no perfil do atleta</p>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-2xl border-2 border-dashed border-muted-foreground/30 text-center">
                <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Nenhuma prova alvo definida</p>
                <p className="text-xs text-muted-foreground mt-1">Defina no perfil do atleta para continuar</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Início do Ciclo</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => onStartDateChange(e.target.value)}
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">CHO inicial (g/kg)</label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  step={0.5}
                  value={initialCHO}
                  onChange={e => setInitialCHO(e.target.value)}
                  className="h-10"
                  placeholder="ex: 4"
                />
              </div>
            </div>

            {/* Phase preview */}
            {suggestedPhases.length > 0 && !hasPhases && (() => {
              const suggestedTotal = suggestedPhases.reduce((a, p) => a + (p.duration_weeks || 0), 0);
              const polimentoPhase = suggestedPhases.find(p => p.phase_name.includes('Polimento'));
              const raceDateMatch = raceDate && polimentoPhase?.end_date
                ? polimentoPhase.end_date === raceDate
                : false;
              return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distribuição das fases</p>
                  <Badge variant="outline" className="text-[9px]">
                    {suggestedTotal} semanas total
                  </Badge>
                </div>

                {/* Info: race = end of Polimento */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                  <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>A <strong className="text-foreground">Prova Alvo</strong> deve coincidir com o final da fase <strong className="text-foreground">Polimento</strong>.</span>
                  {raceDate && (
                    raceDateMatch
                      ? <Badge className="text-[8px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-auto shrink-0">✓ Alinhado</Badge>
                      : <Badge className="text-[8px] bg-amber-500/20 text-amber-400 border-amber-500/30 ml-auto shrink-0">Ajuste as semanas</Badge>
                  )}
                </div>
                
                {/* Visual bar */}
                <div className="flex h-10 rounded-xl overflow-hidden border border-border">
                  {suggestedPhases.filter(p => p.duration_weeks > 0).map((p, i) => {
                    const widthPct = suggestedTotal > 0 ? (p.duration_weeks / suggestedTotal) * 100 : 20;
                    const style = getPhaseStyle(p.phase_name);
                    return (
                      <div
                        key={i}
                        className={`flex items-center justify-center ${style.bg} border-r border-border last:border-r-0 transition-all`}
                        style={{ width: `${widthPct}%` }}
                      >
                        <div className="text-center px-1">
                          <p className={`text-[10px] font-bold ${style.text} truncate`}>{p.phase_name}</p>
                          <p className="text-[9px] text-muted-foreground">{p.duration_weeks}s</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Phase cards with editable weeks */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {suggestedPhases.map((p, i) => {
                    const style = getPhaseStyle(p.phase_name);
                    const isZero = p.duration_weeks === 0;
                    return (
                      <div key={i} className={`p-3 rounded-lg border ${style.border} ${style.bg} ${isZero ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <span className={`text-xs font-bold ${style.text}`}>{p.phase_name}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <Input
                            type="number"
                            min={0}
                            value={p.duration_weeks}
                          onChange={e => {
                              const newWeeks = Math.max(parseInt(e.target.value) || 0, 0);
                              const updated = [...suggestedPhases];
                              updated[i] = { ...updated[i], duration_weeks: newWeeks };
                              // Recalculate dates anchoring Polimento end to raceDate
                              const recalculated = recalcPhaseDates(updated, startDate, raceDate);
                              setSuggestedPhases(recalculated);
                            }}
                            className="h-7 text-xs w-14"
                          />
                          <span className="text-[10px] text-muted-foreground">sem</span>
                        </div>
                        {!isZero && p.start_date && (
                          <p className="text-[9px] text-muted-foreground">
                            {format(parseISO(p.start_date), 'dd/MM')} → {format(parseISO(p.end_date), 'dd/MM')}
                          </p>
                        )}
                        {isZero && (
                          <p className="text-[9px] text-muted-foreground italic">Fase ignorada</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={() => {
                    const choVal = parseFloat(initialCHO) || 4;
                    const activePhases = suggestedPhases.filter(p => p.duration_weeks > 0);
                    if (activePhases.length === 0) {
                      toast({ title: 'Defina ao menos uma fase com semanas', variant: 'destructive' });
                      return;
                    }
                    const phasesWithCho = activePhases.map(p => ({
                      ...p,
                      cho_range: getChoRangeForPhase(p.phase_name, choVal) + ' g/kg',
                    }));
                    onSavePhases(phasesWithCho);
                    setTimeout(() => setActiveStep(1), 500);
                  }}
                  disabled={isSavingPhases}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isSavingPhases ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Montar Periodização
                </Button>
              </div>
              );
            })()}

            {/* Already has phases - show summary and allow reconfigure */}
            {hasPhases && (() => {
              const phasesTotal = journeyPhases.reduce((a: number, p: any) => a + (p.duration_weeks || 0), 0);
              return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Periodização configurada</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{phasesTotal} semanas</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => {
                        const choVal = parseFloat(initialCHO) || 4;
                        const suggested = suggestPhases(totalWeeks, startDate, raceDate).map(p => ({
                          ...p,
                          cho_range: getChoRangeForPhase(p.phase_name, choVal) + ' g/kg',
                        }));
                        setSuggestedPhases(suggested);
                        onSavePhases(suggested);
                      }}
                      disabled={isSavingPhases}
                    >
                      <RefreshCw className="h-3 w-3" /> Recalcular
                    </Button>
                  </div>
                </div>

                <div className="flex h-8 rounded-lg overflow-hidden border border-border">
                  {journeyPhases.map((p: any, i: number) => {
                    const widthPct = phasesTotal > 0 ? (p.duration_weeks / phasesTotal) * 100 : 20;
                    const style = getPhaseStyle(p.phase_name);
                    const isCurrent = p.id === currentPhase?.id;
                    return (
                      <div
                        key={p.id || i}
                        className={`flex items-center justify-center ${style.bg} border-r border-border last:border-r-0 ${
                          isCurrent ? 'ring-1 ring-primary ring-inset' : ''
                        }`}
                        style={{ width: `${widthPct}%` }}
                      >
                        <span className={`text-[9px] font-bold ${style.text} truncate px-1`}>{p.phase_name} ({p.duration_weeks}s)</span>
                      </div>
                    );
                  })}
                </div>

                {/* Editable phase weeks for existing phases */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {journeyPhases.map((p: any, i: number) => {
                    const style = getPhaseStyle(p.phase_name);
                    return (
                      <div key={p.id || i} className={`p-2.5 rounded-lg border ${style.border} ${style.bg}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <span className={`text-[10px] font-bold ${style.text}`}>{p.phase_name}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <Input
                            type="number"
                            min={0}
                            value={p.duration_weeks}
                          onChange={e => {
                              const newWeeks = Math.max(parseInt(e.target.value) || 0, 0);
                              const updated = journeyPhases.map((ph: any, idx: number) =>
                                idx === i ? { ...ph, duration_weeks: newWeeks } : { ...ph }
                              );
                              // Recalculate dates anchoring Polimento end to raceDate
                              const recalculated = recalcPhaseDates(updated, startDate, raceDate);
                              const choVal = parseFloat(initialCHO) || 4;
                              const activePhases = recalculated.filter((ph: any) => ph.duration_weeks > 0);
                              if (activePhases.length === 0) {
                                toast({ title: 'Defina ao menos uma fase com semanas', variant: 'destructive' });
                                return;
                              }
                              const phasesWithCho = activePhases.map((ph: any) => ({
                                ...ph,
                                cho_range: getChoRangeForPhase(ph.phase_name, choVal) + ' g/kg',
                              }));
                              onSavePhases(phasesWithCho);
                            }}
                            className="h-7 text-xs w-14"
                          />
                          <span className="text-[10px] text-muted-foreground">sem</span>
                        </div>
                        {p.start_date && p.duration_weeks > 0 && (
                          <p className="text-[9px] text-muted-foreground">
                            {format(parseISO(p.start_date), 'dd/MM')} → {format(parseISO(p.end_date), 'dd/MM')}
                          </p>
                        )}
                        {p.duration_weeks === 0 && (
                          <p className="text-[9px] text-muted-foreground italic">Fase ignorada</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button onClick={() => setActiveStep(1)} className="w-full gap-2" size="lg">
                  <ChevronRight className="h-4 w-4" /> Avançar para Treinos
                </Button>
              </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 1: Treinos da Semana ===== */}
      {activeStep === 1 && hasPhases && (
        <div className="space-y-4">
          {/* Phase selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {journeyPhases.map((p, i) => {
              const style = getPhaseStyle(p.phase_name);
              const isCurrent = p.id === currentPhase?.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPhaseIdx(i)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all shrink-0 ${
                    i === selectedPhaseIdx
                      ? `${style.bg} ${style.border} ${style.text} ring-2 ring-primary/30`
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  <span className="text-sm font-semibold">{p.phase_name}</span>
                  {isCurrent && <Badge className="text-[8px] bg-primary/30 text-primary border-primary/40 ml-1">ATUAL</Badge>}
                </button>
              );
            })}
          </div>

          {/* Phase info */}
          {selectedPhase && (
            <div className={`p-4 rounded-xl border ${getPhaseStyle(selectedPhase.phase_name).border} ${getPhaseStyle(selectedPhase.phase_name).bg}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className={`text-base font-bold ${getPhaseStyle(selectedPhase.phase_name).text}`}>{selectedPhase.phase_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedPhase.objective}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {selectedPhase.start_date ? format(parseISO(selectedPhase.start_date), 'dd/MM') : ''} → {selectedPhase.end_date ? format(parseISO(selectedPhase.end_date), 'dd/MM') : ''}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[9px]">CHO: {selectedPhase.cho_range}</Badge>
                    <Badge variant="outline" className={`text-[9px] ${
                      selectedPhase.train_low_strategy === 'permitido' ? 'text-emerald-400 border-emerald-500/30' :
                      selectedPhase.train_low_strategy === 'reduzido' ? 'text-amber-400 border-amber-500/30' :
                      'text-destructive border-destructive/30'
                    }`}>
                      Train-Low: {selectedPhase.train_low_strategy}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Training grid - Cards instead of table */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Dumbbell className="h-4 w-4 text-primary" />
                  Semana de Treino
                </h4>
                <Button
                  size="sm"
                  onClick={handleSaveSessions}
                  disabled={isSavingSessions || !sessionsDirty}
                  className="gap-1 text-xs"
                >
                  <CheckCircle2 className="h-3 w-3" /> Salvar
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
                {DAYS.map((dayName, dayIdx) => {
                  const daySessions = sessions
                    .map((s, idx) => ({ ...s, _idx: idx }))
                    .filter(s => s.day_of_week === dayIdx);
                  const isDayOff = daySessions.some(s => s.is_day_off);
                  const hasActivity = daySessions.some(s => s.modality && s.modality.trim() !== '');

                  return (
                    <div
                      key={dayIdx}
                      className={`p-3 rounded-xl border transition-all ${
                        isDayOff ? 'border-purple-500/30 bg-purple-500/5' :
                        hasActivity ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold">{DAYS_SHORT[dayIdx]}</p>
                        <button
                          onClick={() => toggleDayOff(dayIdx)}
                          className={`text-[9px] px-1.5 py-0.5 rounded-md border transition-all ${
                            isDayOff
                              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                              : 'text-muted-foreground border-border hover:bg-muted/50'
                          }`}
                        >
                          <Moon className="h-3 w-3 inline mr-0.5" />Off
                        </button>
                      </div>

                      {isDayOff ? (
                        <div className="text-center py-4">
                          <Moon className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                          <p className="text-[10px] text-purple-400 font-medium">Day Off</p>
                          <p className="text-[9px] text-muted-foreground">Recuperação</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {daySessions.map((session, sIdx) => (
                            <div key={session._idx} className={`space-y-1 ${sIdx > 0 ? 'pt-2 border-t border-border/50' : ''}`}>
                              {sIdx > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-[8px] font-bold text-muted-foreground uppercase">Sessão {sIdx + 1}</span>
                                  <button onClick={() => removeSession(session._idx)} className="text-destructive hover:text-destructive/80">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}

                              <Select
                                value={session.modality || ''}
                                onValueChange={v => {
                                  if (v === 'Day Off') {
                                    toggleDayOff(dayIdx);
                                  } else {
                                    updateSession(session._idx, 'modality', v);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Atividade" /></SelectTrigger>
                                <SelectContent>
                                  {MODALITIES.map(m => (
                                    <SelectItem key={m} value={m}>{m === 'Day Off' ? '🌙 Day Off' : m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select value={session.shift} onValueChange={v => updateSession(session._idx, 'shift', v)}>
                                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {SHIFTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                              </Select>

                              <Select value={session.intensity} onValueChange={v => updateSession(session._idx, 'intensity', v)}>
                                <SelectTrigger className={`h-7 text-[10px] ${
                                  session.intensity === 'Intenso' ? 'border-red-500/40 text-red-400' :
                                  session.intensity === 'Moderado' ? 'border-amber-500/40 text-amber-400' :
                                  'border-emerald-500/40 text-emerald-400'
                                }`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {INTENSITIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                                </SelectContent>
                              </Select>

                              <Select value={session.duration_minutes || '60'} onValueChange={v => updateSession(session._idx, 'duration_minutes', v)}>
                                <SelectTrigger className="h-7 text-[10px]">
                                  <Clock className="h-3 w-3 mr-1 opacity-50" />
                                  <SelectValue placeholder="Duração" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DURATIONS.map(d => <SelectItem key={d} value={d}>{d} min</SelectItem>)}
                                </SelectContent>
                              </Select>

                              <Select value={session.priority} onValueChange={v => updateSession(session._idx, 'priority', v)}>
                                <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Prio" /></SelectTrigger>
                                <SelectContent>
                                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>Prio {p}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}

                          {/* Add session button */}
                          <button
                            onClick={() => addSessionToDay(dayIdx)}
                            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-all text-[9px]"
                          >
                            <Plus className="h-3 w-3" /> Treino duplo
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Nav buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveStep(0)} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={() => {
                if (sessionsDirty && selectedWeek) {
                  onSaveSessions(selectedWeek.id, sessions.map(({ id, ...rest }) => rest));
                }
                setActiveStep(2);
              }}
              className="flex-1 gap-2"
              disabled={!hasSomeSessions}
            >
              Gerar Dinâmica Nutricional <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ===== STEP 2: Dinâmica Nutricional ===== */}
      {activeStep === 2 && hasPhases && (
        <div className="space-y-4">
          {/* Phase context */}
          {selectedPhase && (
            <div className={`p-3 rounded-xl border ${getPhaseStyle(selectedPhase.phase_name).border} ${getPhaseStyle(selectedPhase.phase_name).bg} flex items-center justify-between`}>
              <div>
                <span className={`text-sm font-bold ${getPhaseStyle(selectedPhase.phase_name).text}`}>{selectedPhase.phase_name}</span>
                <span className="text-xs text-muted-foreground ml-2">CHO: {selectedPhase.cho_range}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateDynamics}
                disabled={isGeneratingDynamics || !hasSomeSessions}
                className="gap-1 text-xs"
              >
                {isGeneratingDynamics ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {weekDynamics.length > 0 ? 'Regenerar' : 'Gerar'}
              </Button>
            </div>
          )}

          {/* Dynamics display - visual cards */}
          {weekDynamics.length > 0 ? (
            <div className="space-y-2">
              {/* Legend row */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 px-3 py-2 rounded-lg bg-muted/20 border border-border text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">Legenda:</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> High</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Med</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Low</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Rec</span>
              </div>

              {/* Days — stack on mobile, 7-col on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                {[...weekDynamics].sort((a, b) => a.day_of_week - b.day_of_week).map((day) => {
                  const choStyle = CHO_STYLES[day.cho_classification] || { bg: 'bg-muted', text: 'text-muted-foreground', icon: '•' };
                  const session = sessions.find(s => s.day_of_week === day.day_of_week);
                  const isOff = !session?.modality || session.modality === 'Day Off';
                  
                  return (
                    <div key={day.day_of_week} onClick={() => setExpandedDayIdx(day.day_of_week)} className={`rounded-xl border border-border overflow-hidden transition-all hover:shadow-md hover:border-primary/30 cursor-pointer ${isOff ? 'opacity-70' : ''}`}>
                      {/* Day header — horizontal on mobile */}
                      <div className={`px-3 py-2 ${choStyle.bg} flex items-center justify-between border-b border-border/50`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{DAYS_SHORT[day.day_of_week]}</span>
                          <span className="text-sm">{choStyle.icon}</span>
                          {/* Session inline on mobile */}
                          <span className={`sm:hidden text-[10px] font-semibold ${isOff ? 'text-muted-foreground' : 'text-primary'}`}>
                            {isOff ? 'OFF' : `${session.modality}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {day.cho_gkg && (
                            <span className={`text-base font-black ${choStyle.text}`}>{day.cho_gkg}<span className="text-[9px] font-normal opacity-70">g/kg</span></span>
                          )}
                        </div>
                      </div>

                      {/* Session pill — hidden on mobile (shown inline above) */}
                      <div className="hidden sm:block px-2 py-1.5 border-b border-border/30">
                        <div className={`text-center py-0.5 rounded-md text-[9px] font-semibold ${isOff ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                          {isOff ? '🛌 OFF' : `${session.modality} · ${session.shift}`}
                        </div>
                      </div>

                      {/* CHO distribution mini-bar */}
                      {(day.morning_cho_pct || day.afternoon_cho_pct || day.night_cho_pct) && (
                        <div className="px-3 sm:px-2 py-1.5 border-b border-border/30">
                          <div className="flex h-1.5 w-full rounded-full overflow-hidden">
                            <div className="bg-amber-400" style={{ width: `${day.morning_cho_pct || 33}%` }} />
                            <div className="bg-orange-400" style={{ width: `${day.afternoon_cho_pct || 34}%` }} />
                            <div className="bg-indigo-400" style={{ width: `${day.night_cho_pct || 33}%` }} />
                          </div>
                          <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5 font-mono">
                            <span>☀{day.morning_cho_pct}%</span>
                            <span>🌅{day.afternoon_cho_pct}%</span>
                            <span>🌙{day.night_cho_pct}%</span>
                          </div>
                        </div>
                      )}

                      {/* Timing codes */}
                      <div className="px-3 sm:px-2 py-2 flex flex-wrap gap-1 sm:space-y-1 sm:block">
                        {day.pre_training && (
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 rounded px-1.5 py-0.5 leading-none shrink-0">PRÉ</span>
                            <span className="text-[10px] sm:text-[9px] font-semibold text-foreground">{day.pre_training}</span>
                          </div>
                        )}
                        {day.intra_training && (
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black text-orange-500 bg-orange-500/10 rounded px-1.5 py-0.5 leading-none shrink-0">INT</span>
                            <span className="text-[10px] sm:text-[9px] font-semibold text-foreground">{day.intra_training}</span>
                          </div>
                        )}
                        {day.post_training && (
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 rounded px-1.5 py-0.5 leading-none shrink-0">PÓS</span>
                            <span className="text-[10px] sm:text-[9px] font-semibold text-foreground">{day.post_training}</span>
                          </div>
                        )}
                        {day.night_guidance && (
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black text-indigo-400 bg-indigo-500/10 rounded px-1.5 py-0.5 leading-none shrink-0">🌙</span>
                            <span className="text-[10px] sm:text-[9px] font-semibold text-foreground">{day.night_guidance}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-sm font-semibold">Gerar Dinâmica Nutricional</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  A IA vai gerar códigos ultra-curtos de timing nutricional para cada dia da fase <strong>{selectedPhase?.phase_name}</strong>.
                </p>
                <Button
                  onClick={handleGenerateDynamics}
                  disabled={isGeneratingDynamics || !hasSomeSessions}
                  className="mt-4 gap-2"
                >
                  {isGeneratingDynamics ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar dinâmica
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Day detail modal */}
          {expandedDayIdx !== null && weekDynamics.length > 0 && (() => {
            const sortedDynamics = [...weekDynamics].sort((a, b) => a.day_of_week - b.day_of_week);
            const dayData = sortedDynamics.find(d => d.day_of_week === expandedDayIdx);
            if (!dayData) return null;
            const prevDayIdx = (expandedDayIdx + 6) % 7;
            const nextDayIdx = (expandedDayIdx + 1) % 7;
            const prevDay = sortedDynamics.find(d => d.day_of_week === prevDayIdx) || null;
            const nextDay = sortedDynamics.find(d => d.day_of_week === nextDayIdx) || null;
            const currentSession = sessions.find(s => s.day_of_week === expandedDayIdx);
            const prevSession = sessions.find(s => s.day_of_week === prevDayIdx) || null;
            const nextSession = sessions.find(s => s.day_of_week === nextDayIdx) || null;
            return (
              <DayDynamicDetailModal
                day={dayData}
                prevDay={prevDay}
                nextDay={nextDay}
                session={currentSession}
                prevSession={prevSession}
                nextSession={nextSession}
                phaseName={selectedPhase?.phase_name || ''}
                onClose={() => setExpandedDayIdx(null)}
              />
            );
          })()}

          {weekDynamics.length > 0 && (
            <StrategicSummary dynamics={weekDynamics} sessions={sessions} phaseName={selectedPhase?.phase_name || ''} />
          )}

          {/* Nav */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveStep(1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Treinos
            </Button>
            <Button onClick={() => setActiveStep(3)} className="flex-1 gap-2">
              Visão Geral <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: Visão Geral da Periodização ===== */}
      {activeStep === 3 && hasPhases && (
        <div className="space-y-4">
          {/* Progress header */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold">{raceName || 'Prova'}</h3>
                  <p className="text-xs text-muted-foreground">
                    {raceDate ? format(parseISO(raceDate), 'dd/MM/yyyy') : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <PeriodizationExportButton
                    phases={journeyPhases}
                    raceName={raceName}
                    raceDate={raceDate}
                    startDate={startDate}
                    totalWeeks={totalWeeks}
                    allDynamics={allDynamics}
                    journeyWeeks={journeyWeeks}
                  />
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{daysToRace}</p>
                    <p className="text-[10px] text-muted-foreground">dias restantes</p>
                  </div>
                </div>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between mt-1.5">
                <p className="text-[10px] text-muted-foreground">{Math.round(progressPercent)}% concluído</p>
                <p className="text-[10px] text-muted-foreground">{totalWeeks} semanas totais</p>
              </div>
            </CardContent>
          </Card>

          {/* Visual phase bar */}
          <div className="flex h-8 rounded-xl overflow-hidden border border-border">
            {journeyPhases.map((p, i) => {
              const widthPct = totalWeeks > 0 ? (p.duration_weeks / totalWeeks) * 100 : 20;
              const style = getPhaseStyle(p.phase_name);
              const isCurrent = p.id === currentPhase?.id;
              return (
                <div
                  key={p.id || i}
                  className={`flex items-center justify-center ${style.bg} border-r border-border last:border-r-0 transition-all ${
                    isCurrent ? 'ring-1 ring-primary ring-inset' : ''
                  }`}
                  style={{ width: `${widthPct}%` }}
                >
                  <span className={`text-[9px] font-bold ${style.text} truncate px-1`}>{p.phase_name}</span>
                </div>
              );
            })}
          </div>

          {/* Phase-by-phase comprehensive view */}
          {journeyPhases.map((phase, idx) => {
            const style = getPhaseStyle(phase.phase_name);
            const isCurrent = phase.id === currentPhase?.id;
            const isPast = phase.end_date ? isAfter(today, parseISO(phase.end_date)) : false;
            const phaseWeekIds = journeyWeeks.filter(w => w.journey_phase_id === phase.id).map(w => w.id);
            const phaseDynamics = allDynamics.filter(d => phaseWeekIds.includes(d.journey_week_id));
            const phaseSessions = allSessions.filter(s => phaseWeekIds.includes(s.journey_week_id));
            const hasDynamics = phaseDynamics.length > 0;

            const lowCount = phaseDynamics.filter(d => d.cho_classification === 'Low').length;
            const highCount = phaseDynamics.filter(d => d.cho_classification === 'High').length;
            const medCount = phaseDynamics.filter(d => d.cho_classification === 'Medium').length;

            // Evidence-based supplementation per phase (Vitale & Getzin, 2019)
            const phaseSupplements = getPhaseSupplements(phase.phase_name);
            const phaseNutrients = getPhaseNutrients(phase.phase_name);

            return (
              <Collapsible key={phase.id} defaultOpen={isCurrent}>
                <Card
                  className={`overflow-hidden transition-all ${
                    isCurrent ? `ring-2 ring-primary/30 border-primary/30` : isPast ? 'opacity-60' : ''
                  }`}
                >
                  {/* Phase header — clickable */}
                  <CollapsibleTrigger asChild>
                    <button className={`w-full px-5 py-3 ${style.bg} border-b border-border flex items-center justify-between cursor-pointer hover:brightness-110 transition-all group`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${style.dot} shrink-0`} />
                        <div className="text-left">
                          <span className={`text-base font-bold ${style.text}`}>{phase.phase_name}</span>
                          {isCurrent && <Badge className="text-[8px] bg-primary/30 text-primary border-primary/40 ml-2">FASE ATUAL</Badge>}
                          {isPast && <Badge variant="outline" className="text-[8px] ml-2 opacity-60">Concluída</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{phase.duration_weeks} sem</span>
                          <span className="hidden sm:inline">
                            {phase.start_date ? format(parseISO(phase.start_date), 'dd/MM') : '—'}
                            <ArrowRight className="h-3 w-3 inline mx-1" />
                            {phase.end_date ? format(parseISO(phase.end_date), 'dd/MM') : '—'}
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <CardContent className="pt-4 pb-4 space-y-4">
                      {/* Objective */}
                      {phase.objective && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{phase.objective}</p>
                      )}

                      {/* Macronutrient strategy */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-muted/30 border border-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Flame className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Carboidrato</span>
                          </div>
                          <p className="text-sm font-bold">{phase.cho_range || '—'}</p>
                          <p className="text-[9px] text-muted-foreground">g/kg/dia</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border border-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Dumbbell className="h-3.5 w-3.5 text-red-400" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Proteína</span>
                          </div>
                          <p className="text-sm font-bold">{phaseNutrients.protein}</p>
                          <p className="text-[9px] text-muted-foreground">g/kg/dia</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border border-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Droplets className="h-3.5 w-3.5 text-yellow-400" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Gordura</span>
                          </div>
                          <p className="text-sm font-bold">{phaseNutrients.fat}</p>
                          <p className="text-[9px] text-muted-foreground">% do VCT</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border border-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Droplets className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Hidratação</span>
                          </div>
                          <p className="text-sm font-bold">{phaseNutrients.hydration}</p>
                          <p className="text-[9px] text-muted-foreground">mL/kg/h treino</p>
                        </div>
                      </div>

                      {/* Train-Low & CHO distribution */}
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="outline" className={`text-[10px] ${
                          phase.train_low_strategy === 'permitido' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' :
                          phase.train_low_strategy === 'reduzido' ? 'text-amber-400 border-amber-500/30 bg-amber-500/5' :
                          'text-destructive border-destructive/30 bg-destructive/5'
                        }`}>
                          Train-Low: {phase.train_low_strategy}
                        </Badge>
                        {hasDynamics && (
                          <>
                            <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30 bg-blue-500/5">
                              🧊 Low: {lowCount}d
                            </Badge>
                            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/5">
                              ⚡ Med: {medCount}d
                            </Badge>
                            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                              🔋 High: {highCount}d
                            </Badge>
                          </>
                        )}
                        {!hasDynamics && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-6 gap-1 text-muted-foreground"
                            onClick={() => {
                              setSelectedPhaseIdx(idx);
                              setActiveStep(1);
                            }}
                          >
                            <Sparkles className="h-3 w-3" /> Configurar treinos
                          </Button>
                        )}
                      </div>

                      {/* Supplementation protocol */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Pill className="h-4 w-4 text-primary" />
                          <span className="text-xs font-bold">Suplementação Baseada em Evidências</span>
                          <span className="text-[8px] text-muted-foreground italic">(Vitale & Getzin, 2019)</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {phaseSupplements.map((supp, sIdx) => (
                            <div key={sIdx} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${supp.active ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/20 opacity-50'}`}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm ${supp.active ? 'bg-primary/15' : 'bg-muted'}`}>
                                {supp.emoji}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold">{supp.name}</span>
                                  {supp.active ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                                  ) : (
                                    <span className="text-[8px] text-muted-foreground">(não recomendado nesta fase)</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-snug">{supp.dose}</p>
                                {supp.timing && <p className="text-[9px] text-primary/70 mt-0.5">{supp.timing}</p>}
                                {supp.note && <p className="text-[9px] text-amber-400/80 mt-0.5 flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" /> {supp.note}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Nutrient timing guidance */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="text-xs font-bold">Nutrient Timing</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2.5 rounded-lg border border-border bg-muted/20 text-center">
                            <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Pré-treino</p>
                            <p className="text-[10px] leading-snug">{phaseNutrients.preTiming}</p>
                          </div>
                          <div className="p-2.5 rounded-lg border border-border bg-muted/20 text-center">
                            <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Intra-treino</p>
                            <p className="text-[10px] leading-snug">{phaseNutrients.intraTiming}</p>
                          </div>
                          <div className="p-2.5 rounded-lg border border-border bg-muted/20 text-center">
                            <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Pós-treino</p>
                            <p className="text-[10px] leading-snug">{phaseNutrients.postTiming}</p>
                          </div>
                        </div>
                      </div>

                      {/* Phase-specific alerts */}
                      {phaseNutrients.alerts.length > 0 && (
                        <div className="space-y-1.5">
                          {phaseNutrients.alerts.map((alert, aIdx) => (
                            <div key={aIdx} className={`flex items-start gap-2 p-2.5 rounded-lg text-[10px] leading-snug ${
                              alert.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' :
                              alert.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' :
                              'bg-blue-500/10 border border-blue-500/20 text-blue-300'
                            }`}>
                              {alert.type === 'warning' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> :
                               alert.type === 'success' ? <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" /> :
                               <TrendingUp className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                              {alert.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}

          {/* Evidence reference */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border">
            <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
              📚 Protocolo baseado em: <strong>Vitale, K. & Getzin, A. (2019). Nutrition and supplement update for the endurance athlete. Nutrients, 11(6), 1289.</strong>
              <br />Burke et al. (2011); Impey et al. (2018); Jeukendrup (2017); Stellingwerff et al. (2019)
            </p>
          </div>

          {/* Nav */}
          <Button variant="outline" onClick={() => setActiveStep(2)} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Dinâmica
          </Button>
        </div>
      )}
    </div>
  );
}

// Mini strategic summary component
function StrategicSummary({ dynamics, sessions, phaseName }: { dynamics: any[]; sessions: any[]; phaseName: string }) {
  const total = dynamics.length;
  const lowCount = dynamics.filter(d => d.cho_classification === 'Low').length;
  const highCount = dynamics.filter(d => d.cho_classification === 'High').length;
  const medCount = dynamics.filter(d => d.cho_classification === 'Medium').length;
  const recoveryCount = dynamics.filter(d => d.cho_classification === 'Recovery').length;

  const pctLow = total > 0 ? Math.round((lowCount / total) * 100) : 0;
  const pctHigh = total > 0 ? Math.round((highCount / total) * 100) : 0;

  const sleepLowCount = dynamics.filter(d => {
    if (d.cho_classification !== 'Low') return false;
    const nextDay = dynamics.find(n => n.day_of_week === (d.day_of_week + 1) % 7);
    if (!nextDay) return false;
    const nextSession = sessions.find(s => s.day_of_week === nextDay.day_of_week);
    return nextSession?.modality && nextSession.modality.trim() !== '';
  }).length;

  let strategyColor = 'text-emerald-400';
  let strategyLabel = '🟢 Equilibrada';
  if (pctLow > 50) { strategyColor = 'text-amber-400'; strategyLabel = '🟡 Agressiva'; }
  if (pctLow > 65) { strategyColor = 'text-red-400'; strategyLabel = '🔴 Risco metabólico'; }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border flex-wrap">
      <span className={`text-xs font-bold ${strategyColor}`}>{strategyLabel}</span>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="text-blue-400">Low: {lowCount}d ({pctLow}%)</span>
        <span className="text-emerald-400">High: {highCount}d ({pctHigh}%)</span>
        <span className="text-amber-400">Med: {medCount}d</span>
        <span className="text-purple-400">Rec: {recoveryCount}d</span>
        <span className="text-cyan-400">Sleep-Low: {sleepLowCount}x</span>
      </div>
    </div>
  );
}
