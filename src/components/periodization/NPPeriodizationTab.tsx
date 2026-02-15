import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar, Target, Clock, Zap, AlertTriangle, ChevronRight, Plus, Save,
  BookOpen, CheckCircle2, XCircle, Pill, Dumbbell, Utensils, StickyNote,
  Trash2, RefreshCw, Settings2
} from 'lucide-react';
import { usePeriodizationMethod } from '@/hooks/usePeriodizationMethod';
import { useAthletePeriodization } from '@/hooks/useAthletePeriodization';
import { MethodEditor } from './MethodEditor';
import { differenceInDays, differenceInWeeks, format, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  clientId: string;
  client?: any;
  consultationId?: string;
  consultation?: any;
}

const PHASE_BG: Record<string, string> = {
  'Base': 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  'Construção': 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  'Pico': 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
  'Transição': 'bg-purple-500/20 border-purple-500/40 text-purple-400',
};

const getPhaseStyle = (name: string) =>
  Object.entries(PHASE_BG).find(([k]) => name.includes(k))?.[1] || 'bg-muted border-border text-muted-foreground';

const STATUS_COLORS: Record<string, string> = {
  past: 'opacity-50',
  current: 'ring-2 ring-primary scale-[1.02]',
  future: '',
};

export function NPPeriodizationTab({ clientId, client, consultationId, consultation }: Props) {
  const { method, activePhases, loadingMethod, createMethod } = usePeriodizationMethod();
  const {
    athletePeriodization, notes, generateTimeline, savePeriodization, updateBlock, addNote, deleteNote
  } = useAthletePeriodization(clientId);

  const [activeView, setActiveView] = useState<'athlete' | 'method'>('athlete');
  const [startDate, setStartDate] = useState('');
  const [planType, setPlanType] = useState<'monthly' | '6_weeks'>('monthly');
  const [selectedBlockIdx, setSelectedBlockIdx] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [overrideBlockIdx, setOverrideBlockIdx] = useState<number | null>(null);
  const [overridePhaseId, setOverridePhaseId] = useState('');

  // Fetch athlete profile for race_date
  const { data: athleteProfile } = useQuery({
    queryKey: ['athlete-profile-periodization', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_profiles')
        .select('target_race, target_deadline')
        .eq('client_id', clientId)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch pending checkins for badge
  const { data: pendingCheckins = [] } = useQuery({
    queryKey: ['pending-checkins-periodization', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('checkin_dispatches')
        .select('id')
        .eq('client_id', clientId)
        .eq('status', 'sent')
        .limit(5);
      return data || [];
    },
    enabled: !!clientId,
  });

  const raceDate = athleteProfile?.target_deadline || consultation?.target_race_date;
  const raceName = athleteProfile?.target_race || '';

  // Init from athlete periodization or defaults
  useEffect(() => {
    if (athletePeriodization) {
      setStartDate(athletePeriodization.start_date);
      setPlanType(athletePeriodization.plan_adjustment_type as 'monthly' | '6_weeks');
    } else if (client?.start_date) {
      setStartDate(client.start_date);
      if (client.consultation_frequency === '6_weeks') setPlanType('6_weeks');
    }
  }, [athletePeriodization, client]);

  // Timeline blocks
  const blocks = useMemo(() => {
    if (athletePeriodization?.timeline_blocks) {
      // Recalculate statuses
      const today = new Date();
      return (athletePeriodization.timeline_blocks as any[]).map((b: any) => {
        const s = parseISO(b.start_date);
        const e = parseISO(b.end_date);
        let status: 'past' | 'current' | 'future' = 'future';
        if (today > e) status = 'past';
        else if (today >= s && today <= e) status = 'current';
        return { ...b, status };
      });
    }
    return [];
  }, [athletePeriodization]);

  const currentBlock = blocks.find((b: any) => b.status === 'current');
  const currentBlockIdx = currentBlock ? blocks.indexOf(currentBlock) : -1;
  const nextBlock = currentBlockIdx >= 0 && currentBlockIdx < blocks.length - 1 ? blocks[currentBlockIdx + 1] : null;

  // Get phase details from method
  const getPhaseDetails = (phaseId: string) => activePhases.find((p: any) => p.id === phaseId);
  const currentPhase = currentBlock ? getPhaseDetails(currentBlock.phase_id) : null;
  const nextPhase = nextBlock ? getPhaseDetails(nextBlock.phase_id) : null;

  // Notes for current phase
  const currentPhaseNotes = currentPhase
    ? notes.filter((n: any) => n.phase_id === currentPhase.id)
    : [];

  // Cycle info
  const weeksToRace = raceDate ? Math.max(differenceInWeeks(parseISO(raceDate), new Date()), 0) : null;
  const daysToRace = raceDate ? Math.max(differenceInDays(parseISO(raceDate), new Date()), 0) : null;

  // Next checkpoint
  const nextCheckpoint = useMemo(() => {
    const future = blocks.filter((b: any) => b.status === 'current' || b.status === 'future');
    return future.length > 0 ? future[0].adjustment_checkpoint_date : null;
  }, [blocks]);

  const daysToCheckpoint = nextCheckpoint ? differenceInDays(parseISO(nextCheckpoint), new Date()) : null;

  // Generate / Regenerate timeline
  const handleGenerateTimeline = () => {
    if (!raceDate || !startDate || !method) return;
    const newBlocks = generateTimeline(startDate, raceDate, planType, activePhases);
    savePeriodization.mutate({
      start_date: startDate,
      race_date: raceDate,
      plan_adjustment_type: planType,
      method_id: method.id,
      timeline_blocks: newBlocks,
    });
  };

  // Handle phase override
  const handleOverride = () => {
    if (overrideBlockIdx === null || !overridePhaseId) return;
    const phase = activePhases.find((p: any) => p.id === overridePhaseId);
    if (phase) {
      updateBlock.mutate({ blockIndex: overrideBlockIdx, phaseId: overridePhaseId, phaseName: phase.phase_name });
    }
    setOverrideDialog(false);
  };

  // Handle add note
  const handleAddNote = () => {
    if (!noteText.trim() || !currentPhase) return;
    addNote.mutate({ phaseId: currentPhase.id, blockIndex: currentBlockIdx, noteText });
    setNoteText('');
  };

  // Auto-select current block
  useEffect(() => {
    if (currentBlockIdx >= 0 && selectedBlockIdx === null) {
      setSelectedBlockIdx(currentBlockIdx);
    }
  }, [currentBlockIdx]);

  // If no method yet, prompt creation
  if (!loadingMethod && !method) {
    return (
      <div className="space-y-4">
        <MethodEditor />
      </div>
    );
  }

  const selectedBlock = selectedBlockIdx !== null ? blocks[selectedBlockIdx] : null;
  const selectedPhase = selectedBlock ? getPhaseDetails(selectedBlock.phase_id) : null;
  const selectedBlockNotes = selectedBlock && selectedPhase
    ? notes.filter((n: any) => n.phase_id === selectedPhase.id && (n.block_index === null || n.block_index === selectedBlockIdx))
    : [];

  return (
    <div className="space-y-4">
      <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
        <TabsList className="h-8">
          <TabsTrigger value="athlete" className="text-xs gap-1"><Calendar className="h-3 w-3" /> Periodização do Atleta</TabsTrigger>
          <TabsTrigger value="method" className="text-xs gap-1"><Settings2 className="h-3 w-3" /> Manual do Método</TabsTrigger>
        </TabsList>

        <TabsContent value="method" className="mt-4">
          <MethodEditor />
        </TabsContent>

        <TabsContent value="athlete" className="mt-4 space-y-4">
          {/* A) Header do Ciclo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase">Prova Alvo</span>
                </div>
                <p className="text-sm font-bold truncate">{raceName || '—'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {raceDate ? format(parseISO(raceDate), 'dd/MM/yyyy') : 'Não definida'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[10px] text-muted-foreground uppercase">Tempo Restante</span>
                </div>
                <p className="text-xl font-bold text-primary">{weeksToRace ?? '—'}</p>
                <p className="text-[10px] text-muted-foreground">{daysToRace != null ? `${daysToRace} dias (${weeksToRace} sem)` : '—'}</p>
              </CardContent>
            </Card>

            <Card className={currentPhase ? '' : ''}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] text-muted-foreground uppercase">Fase Atual</span>
                </div>
                <p className="text-sm font-bold">{currentBlock?.phase_name_snapshot || 'Não iniciada'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {currentBlock ? `Bloco ${currentBlockIdx + 1} de ${blocks.length}` : '—'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[10px] text-muted-foreground uppercase">Próx. Checkpoint</span>
                </div>
                <p className="text-sm font-bold">
                  {nextCheckpoint ? format(parseISO(nextCheckpoint), 'dd/MM') : '—'}
                </p>
                {daysToCheckpoint != null && daysToCheckpoint < 7 && (
                  <Badge className="text-[9px] bg-destructive/20 text-destructive border-destructive/30 mt-0.5">
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {daysToCheckpoint}d restantes
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Ajustes</span>
                </div>
                <p className="text-sm font-bold">{planType === '6_weeks' ? '6 semanas' : 'Mensal'}</p>
                {pendingCheckins.length > 0 && (
                  <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-amber-500/30 mt-0.5">
                    {pendingCheckins.length} check-in pendente
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Config bar */}
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="flex flex-col sm:flex-row gap-2 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">Início do Ciclo</label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="min-w-[140px]">
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">Periodicidade</label>
                  <Select value={planType} onValueChange={(v: any) => setPlanType(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal (4 sem.)</SelectItem>
                      <SelectItem value="6_weeks">6 semanas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={handleGenerateTimeline}
                  disabled={!raceDate || !startDate || !method}
                  className="gap-1 text-xs h-8"
                >
                  {blocks.length > 0 ? <RefreshCw className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {blocks.length > 0 ? 'Regenerar Timeline' : 'Gerar Timeline'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* B) Timeline Visual (Roadmap) */}
          {blocks.length > 0 && (
            <Card>
              <CardContent className="pt-3 pb-3">
                <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Linha do Tempo</p>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {blocks.map((block: any, i: number) => {
                    const style = getPhaseStyle(block.phase_name_snapshot);
                    const isSelected = selectedBlockIdx === i;
                    return (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setSelectedBlockIdx(i)}
                            className={`flex-1 min-w-[70px] p-2 rounded-lg border transition-all text-center ${style} ${STATUS_COLORS[block.status]} ${isSelected ? 'ring-2 ring-foreground/30' : ''}`}
                          >
                            <p className="text-[10px] font-bold">B{i + 1}</p>
                            <p className="text-[9px] truncate">{block.phase_name_snapshot.split(' ')[0]}</p>
                            <p className="text-[8px] mt-0.5 opacity-70">
                              {format(parseISO(block.start_date), 'dd/MM')} → {format(parseISO(block.end_date), 'dd/MM')}
                            </p>
                            {block.status === 'current' && (
                              <Badge className="text-[7px] bg-primary/30 text-primary border-primary/40 mt-0.5">ATUAL</Badge>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs font-medium">{block.phase_name_snapshot}</p>
                          <p className="text-[10px]">{block.start_date} → {block.end_date}</p>
                          <p className="text-[10px]">Checkpoint: {format(parseISO(block.adjustment_checkpoint_date), 'dd/MM/yyyy')}</p>
                          {block.phase_override && <p className="text-[10px] text-amber-400">⚠️ Fase alterada manualmente</p>}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex gap-3 mt-2 justify-center flex-wrap">
                  {activePhases.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-sm ${getPhaseStyle(p.phase_name).split(' ')[0]}`} />
                      <span className="text-[9px] text-muted-foreground">{p.phase_name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Check-in context badge */}
          {pendingCheckins.length > 0 && currentBlock && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="pt-3 pb-3 flex items-center gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>
                  Você está no checkpoint do <strong>Bloco {currentBlockIdx + 1}</strong> — Fase atual: <strong>{currentBlock.phase_name_snapshot}</strong>
                  {nextBlock && <> — Próxima fase recomendada: <strong>{nextBlock.phase_name_snapshot}</strong></>}
                </span>
              </CardContent>
            </Card>
          )}

          {/* C) Painel da fase selecionada / atual */}
          {selectedPhase && selectedBlock && (
            <Card className={`border-l-4 ${Object.entries(PHASE_BG).find(([k]) => selectedPhase.phase_name.includes(k))?.[1]?.split(' ').find(c => c.startsWith('border-')) || 'border-l-border'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {selectedPhase.phase_name}
                    {selectedBlock.status === 'current' && <Badge className="text-[9px] bg-primary/20 text-primary">FASE ATUAL</Badge>}
                    {selectedBlock.phase_override && <Badge variant="outline" className="text-[9px] text-amber-400">Override</Badge>}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="outline" size="sm" className="text-[10px] h-6 gap-0.5"
                      onClick={() => {
                        setOverrideBlockIdx(selectedBlockIdx);
                        setOverridePhaseId('');
                        setOverrideDialog(true);
                      }}
                    >
                      Forçar fase
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 1) Objetivo */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1">
                    <Target className="h-3 w-3" /> Objetivo da Fase (Método)
                  </p>
                  <p className="text-xs">{selectedPhase.phase_goal}</p>
                </div>

                {/* 2) O que fazer */}
                {Array.isArray(selectedPhase.do_checklist) && selectedPhase.do_checklist.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" /> O que fazer agora
                    </p>
                    <div className="space-y-0.5">
                      {(selectedPhase.do_checklist as string[]).map((item: string, i: number) => (
                        <p key={i} className="text-xs flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5">•</span> {item}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3) Macronutrientes */}
                {Array.isArray(selectedPhase.macro_targets) && selectedPhase.macro_targets.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <Utensils className="h-3 w-3" /> Diretrizes Nutricionais
                    </p>
                    {(selectedPhase.macro_targets as string[]).map((t: string, i: number) => (
                      <p key={i} className="text-xs">• {t}</p>
                    ))}
                  </div>
                )}

                {/* 4) Suplementação */}
                {Array.isArray(selectedPhase.supplementation_daily) && selectedPhase.supplementation_daily.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <Pill className="h-3 w-3" /> Suplementação Base
                    </p>
                    {(selectedPhase.supplementation_daily as string[]).map((s: string, i: number) => (
                      <p key={i} className="text-xs">• {s}</p>
                    ))}
                  </div>
                )}

                {/* 5) Estratégia longão */}
                {selectedPhase.pre_intra_long_run && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <Dumbbell className="h-3 w-3" /> Estratégia Longão / Treino
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {['pre', 'intra', 'post'].map(k => (
                        <div key={k} className="p-2 rounded bg-muted/30 border border-border">
                          <p className="text-[10px] text-muted-foreground font-medium capitalize">
                            {k === 'pre' ? 'Pré' : k === 'intra' ? 'Durante' : 'Pós'}
                          </p>
                          <p className="text-xs mt-1">{(selectedPhase.pre_intra_long_run as any)?.[k] || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6) Nutrição funcional */}
                {Array.isArray(selectedPhase.functional_support) && selectedPhase.functional_support.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Nutrição Funcional</p>
                    <div className="flex flex-wrap gap-1">
                      {(selectedPhase.functional_support as string[]).map((s: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7) O que evitar */}
                {Array.isArray(selectedPhase.avoid_checklist) && selectedPhase.avoid_checklist.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-destructive" /> O que evitar
                    </p>
                    {(selectedPhase.avoid_checklist as string[]).map((a: string, i: number) => (
                      <p key={i} className="text-xs text-destructive/80">• {a}</p>
                    ))}
                  </div>
                )}

                {/* 8) Notas do nutricionista para ESTE atleta */}
                <div className="border-t border-border pt-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1">
                    <StickyNote className="h-3 w-3" /> Notas do Nutricionista (este atleta)
                  </p>
                  {selectedBlockNotes.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {selectedBlockNotes.map((n: any) => (
                        <div key={n.id} className="flex items-start gap-2 p-2 rounded bg-muted/20 border border-border">
                          <p className="text-xs flex-1">{n.note_text}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] text-muted-foreground">{format(parseISO(n.created_at), 'dd/MM')}</span>
                            <Button variant="ghost" size="sm" onClick={() => deleteNote.mutate(n.id)} className="h-5 w-5 p-0 text-destructive">
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Observação específica para este atleta nesta fase..."
                      rows={2}
                      className="text-xs flex-1"
                    />
                    <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()} className="gap-1 text-xs h-auto self-end">
                      <Plus className="h-3 w-3" /> Nota
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* D) Painel Próxima Fase */}
          {nextPhase && currentPhase && nextPhase.id !== currentPhase.id && (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" /> Próxima Fase: {nextPhase.phase_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{nextPhase.phase_goal}</p>

                {/* Comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Macros (Atual)</p>
                    {(Array.isArray(currentPhase.macro_targets) ? currentPhase.macro_targets : []).map((t: string, i: number) => (
                      <p key={i} className="text-[10px]">• {t}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Macros (Próxima)</p>
                    {(Array.isArray(nextPhase.macro_targets) ? nextPhase.macro_targets : []).map((t: string, i: number) => (
                      <p key={i} className="text-[10px] font-semibold">• {t}</p>
                    ))}
                  </div>
                </div>

                {/* Supplement changes */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Mudanças em Suplementos</p>
                  {(() => {
                    const curr = new Set((Array.isArray(currentPhase.supplementation_daily) ? currentPhase.supplementation_daily : []).map((s: string) => s.split(':')[0].trim()));
                    const next = new Set((Array.isArray(nextPhase.supplementation_daily) ? nextPhase.supplementation_daily : []).map((s: string) => s.split(':')[0].trim()));
                    const entering = [...next].filter(s => !curr.has(s));
                    const leaving = [...curr].filter(s => !next.has(s));
                    return (
                      <div className="flex flex-wrap gap-1">
                        {entering.map(s => <Badge key={s} className="text-[9px] bg-emerald-500/20 text-emerald-400">+ {s}</Badge>)}
                        {leaving.map(s => <Badge key={s} className="text-[9px] bg-destructive/20 text-destructive">- {s}</Badge>)}
                        {entering.length === 0 && leaving.length === 0 && <span className="text-[10px] text-muted-foreground">Sem mudanças significativas</span>}
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {blocks.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-sm font-semibold">Nenhuma timeline gerada</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure a data de início e clique em "Gerar Timeline" para criar os blocos de periodização.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Override Dialog */}
          <Dialog open={overrideDialog} onOpenChange={setOverrideDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-sm">Forçar Fase do Bloco {overrideBlockIdx !== null ? overrideBlockIdx + 1 : ''}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Selecione a fase que deseja atribuir a este bloco (apenas para este atleta).</p>
                <Select value={overridePhaseId} onValueChange={setOverridePhaseId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione uma fase" /></SelectTrigger>
                  <SelectContent>
                    {activePhases.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleOverride} disabled={!overridePhaseId} className="w-full gap-1 text-xs">
                  <Save className="h-3 w-3" /> Confirmar Override
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
