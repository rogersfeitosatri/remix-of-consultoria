import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Target, ChevronRight, ChevronLeft, Sparkles, Loader2,
  Calendar, Dumbbell, Zap, CheckCircle2, Clock, ArrowRight,
  CalendarDays, RefreshCw, Eye, Plus, Trash2, Moon
} from 'lucide-react';
import { differenceInWeeks, parseISO, format, addWeeks, isAfter, isBefore, differenceInDays } from 'date-fns';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const SHIFTS = ['Manhã', 'Tarde', 'Noite'];
const INTENSITIES = ['Leve', 'Moderado', 'Intenso'];
const PRIORITIES = ['A', 'B', 'C'];
const MODALITIES = ['Corrida', 'Natação', 'Ciclismo', 'Força', 'Day Off'];

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'Base': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  'Específica': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  'Competitiva': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  'Pico': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
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
  suggestPhases: (totalWeeks: number, startDate: string) => any[];
  onSavePhases: (phases: any[]) => void;
  isSavingPhases: boolean;
  onSaveSessions: (weekId: string, sessions: any[]) => void;
  isSavingSessions: boolean;
  onGenerateDynamics: (weekId: string, phase: any) => void;
  isGeneratingDynamics: boolean;
  onSaveDynamics: (weekId: string, dynamics: any[]) => void;
  isSavingDynamics: boolean;
}

export function PeriodizationWizard({
  clientId, raceDate, raceName, startDate, onStartDateChange,
  journeyPhases, journeyWeeks, allSessions, allDynamics,
  suggestPhases, onSavePhases, isSavingPhases,
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
  const weekDynamics = selectedWeek
    ? allDynamics.filter(d => d.journey_week_id === selectedWeek.id)
    : [];

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
        priority: 'B',
        metabolic_objective: '',
        is_day_off: false,
      })));
    }
    setSessionsDirty(false);
  }, [selectedWeek?.id, weekSessions.length]);

  // Auto-suggest phases
  useEffect(() => {
    if (totalWeeks > 0 && startDate && !hasPhases) {
      const suggested = suggestPhases(totalWeeks, startDate);
      setSuggestedPhases(suggested);
    }
  }, [totalWeeks, startDate, hasPhases]);

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

  const handleGenerateDynamics = () => {
    if (selectedWeek && selectedPhase) {
      onGenerateDynamics(selectedWeek.id, selectedPhase);
    }
  };

  const hasSomeSessions = sessions.some(s => (s.modality && s.modality.trim() !== '') || s.is_day_off);

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
            {suggestedPhases.length > 0 && !hasPhases && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Distribuição sugerida das fases</p>
                
                {/* Visual bar */}
                <div className="flex h-10 rounded-xl overflow-hidden border border-border">
                  {suggestedPhases.map((p, i) => {
                    const widthPct = totalWeeks > 0 ? (p.duration_weeks / totalWeeks) * 100 : 20;
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

                {/* Phase cards */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {suggestedPhases.map((p, i) => {
                    const style = getPhaseStyle(p.phase_name);
                    return (
                      <div key={i} className={`p-3 rounded-lg border ${style.border} ${style.bg}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <span className={`text-xs font-bold ${style.text}`}>{p.phase_name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{p.duration_weeks} semanas</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {format(parseISO(p.start_date), 'dd/MM')} → {format(parseISO(p.end_date), 'dd/MM')}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">{p.objective}</p>
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={() => {
                    onSavePhases(suggestedPhases);
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
            )}

            {/* Already has phases - show summary and allow reconfigure */}
            {hasPhases && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Periodização configurada</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => {
                      const suggested = suggestPhases(totalWeeks, startDate);
                      setSuggestedPhases(suggested);
                      onSavePhases(suggested);
                    }}
                    disabled={isSavingPhases}
                  >
                    <RefreshCw className="h-3 w-3" /> Recalcular
                  </Button>
                </div>

                <div className="flex h-8 rounded-lg overflow-hidden border border-border">
                  {journeyPhases.map((p, i) => {
                    const widthPct = totalWeeks > 0 ? (p.duration_weeks / totalWeeks) * 100 : 20;
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
                        <span className={`text-[9px] font-bold ${style.text} truncate px-1`}>{p.phase_name}</span>
                      </div>
                    );
                  })}
                </div>

                <Button onClick={() => setActiveStep(1)} className="w-full gap-2" size="lg">
                  <ChevronRight className="h-4 w-4" /> Avançar para Treinos
                </Button>
              </div>
            )}
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
                {weekDynamics.length > 0 ? 'Regenerar' : 'Gerar com IA'}
              </Button>
            </div>
          )}

          {/* Dynamics display - visual cards */}
          {weekDynamics.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {[...weekDynamics].sort((a, b) => a.day_of_week - b.day_of_week).map((day) => {
                const choStyle = CHO_STYLES[day.cho_classification] || { bg: 'bg-muted', text: 'text-muted-foreground', icon: '•' };
                const session = sessions.find(s => s.day_of_week === day.day_of_week);
                return (
                  <div key={day.day_of_week} className={`rounded-xl border border-border overflow-hidden`}>
                    {/* Day header */}
                    <div className={`px-3 py-2 ${choStyle.bg} flex items-center justify-between`}>
                      <span className="text-xs font-bold">{DAYS_SHORT[day.day_of_week]}</span>
                      <span className={`text-xs font-bold ${choStyle.text}`}>
                        {choStyle.icon} {day.cho_classification}
                      </span>
                    </div>
                    
                    {/* Session info */}
                    {session?.modality && (
                      <div className="px-3 py-1.5 border-b border-border bg-muted/20">
                        <p className="text-[10px] text-muted-foreground">{session.modality}</p>
                        <p className="text-[9px] text-muted-foreground">{session.shift} • {session.intensity} • Prio {session.priority}</p>
                      </div>
                    )}

                    {/* Nutritional guidance */}
                    <div className="px-3 py-2 space-y-1.5">
                      {day.pre_training && (
                        <div>
                          <p className="text-[8px] font-semibold text-muted-foreground uppercase">Pré</p>
                          <p className="text-[10px] leading-tight">{day.pre_training}</p>
                        </div>
                      )}
                      {day.intra_training && (
                        <div>
                          <p className="text-[8px] font-semibold text-muted-foreground uppercase">Intra</p>
                          <p className="text-[10px] leading-tight">{day.intra_training}</p>
                        </div>
                      )}
                      {day.post_training && (
                        <div>
                          <p className="text-[8px] font-semibold text-muted-foreground uppercase">Pós</p>
                          <p className="text-[10px] leading-tight">{day.post_training}</p>
                        </div>
                      )}
                      {day.night_guidance && (
                        <div>
                          <p className="text-[8px] font-semibold text-muted-foreground uppercase">Noite</p>
                          <p className="text-[10px] leading-tight">{day.night_guidance}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-sm font-semibold">Gerar Dinâmica Nutricional</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  A IA vai analisar os estímulos de treino e gerar estratégias de periodização nutricional baseadas em evidências
                  (Burke, Impey, train-low, sleep-low) específicas para a fase <strong>{selectedPhase?.phase_name}</strong>.
                </p>
                <Button
                  onClick={handleGenerateDynamics}
                  disabled={isGeneratingDynamics || !hasSomeSessions}
                  className="mt-4 gap-2"
                >
                  {isGeneratingDynamics ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar Dinâmica com IA
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Strategic summary */}
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

      {/* ===== STEP 3: Visão Geral ===== */}
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
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{weeksToRace}</p>
                  <p className="text-[10px] text-muted-foreground">semanas restantes</p>
                </div>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">{Math.round(progressPercent)}% do ciclo concluído</p>
            </CardContent>
          </Card>

          {/* Phase timeline */}
          <div className="space-y-3">
            {journeyPhases.map((phase, idx) => {
              const style = getPhaseStyle(phase.phase_name);
              const isCurrent = phase.id === currentPhase?.id;
              const isPast = phase.end_date ? isAfter(today, parseISO(phase.end_date)) : false;
              const phaseWeekIds = journeyWeeks.filter(w => w.journey_phase_id === phase.id).map(w => w.id);
              const phaseDynamics = allDynamics.filter(d => phaseWeekIds.includes(d.journey_week_id));
              const phaseSessions = allSessions.filter(s => phaseWeekIds.includes(s.journey_week_id));
              
              const lowCount = phaseDynamics.filter(d => d.cho_classification === 'Low').length;
              const highCount = phaseDynamics.filter(d => d.cho_classification === 'High').length;
              const hasDynamics = phaseDynamics.length > 0;

              return (
                <div
                  key={phase.id}
                  className={`relative rounded-xl border overflow-hidden transition-all ${
                    isCurrent ? `${style.border} ring-2 ring-primary/30` : isPast ? 'border-border opacity-60' : 'border-border'
                  }`}
                >
                  {/* Phase header */}
                  <div className={`px-4 py-3 ${style.bg} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${style.dot}`} />
                      <div>
                        <span className={`text-sm font-bold ${style.text}`}>{phase.phase_name}</span>
                        {isCurrent && <Badge className="text-[8px] bg-primary/30 text-primary border-primary/40 ml-2">ATUAL</Badge>}
                        {isPast && <Badge variant="outline" className="text-[8px] ml-2 opacity-60">Concluída</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{phase.duration_weeks}s</span>
                      <span>{phase.start_date ? format(parseISO(phase.start_date), 'dd/MM') : '—'}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{phase.end_date ? format(parseISO(phase.end_date), 'dd/MM') : '—'}</span>
                    </div>
                  </div>

                  {/* Phase details */}
                  <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
                    <Badge variant="outline" className="text-[9px]">CHO: {phase.cho_range}</Badge>
                    <Badge variant="outline" className={`text-[9px] ${
                      phase.train_low_strategy === 'permitido' ? 'text-emerald-400 border-emerald-500/30' :
                      phase.train_low_strategy === 'reduzido' ? 'text-amber-400 border-amber-500/30' :
                      'text-destructive border-destructive/30'
                    }`}>
                      Train-Low: {phase.train_low_strategy}
                    </Badge>
                    {hasDynamics && (
                      <>
                        <Badge variant="outline" className="text-[9px] text-blue-400 border-blue-500/30">Low: {lowCount}</Badge>
                        <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">High: {highCount}</Badge>
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

                  {/* Objective */}
                  {phase.objective && (
                    <div className="px-4 pb-3">
                      <p className="text-[10px] text-muted-foreground">{phase.objective}</p>
                    </div>
                  )}
                </div>
              );
            })}
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
