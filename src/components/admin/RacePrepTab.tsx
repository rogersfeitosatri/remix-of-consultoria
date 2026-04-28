import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Calendar, Edit, Plus, Activity, AlertTriangle, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useActiveRace, useUpsertActiveRace,
  useGutLogs, useCreateGutLog,
  usePhaseProtocol, useUpsertPhaseProtocol,
  type ActiveRace,
} from '@/hooks/useNutriPeriodiza';
import { useProtocolDefaults, getMergedProtocol } from '@/hooks/useNutriPeriodizaDefaults';
import { useEvolutionSummaries, useGenerateEvolutionSummary } from '@/hooks/useNutriPeriodizaSummary';
import { NpCheckinPanel } from '@/components/admin/NpCheckinPanel';
import { NpAthleteSummaryDialog } from '@/components/admin/NpAthleteSummaryDialog';
import {
  calculateWeeksToRace, calculatePhase, categorizeDistance,
  PHASE_META, DISTANCE_LABEL,
  suggestProgression, giScoreColorClass,
  type RacePhase,
} from '@/lib/nutriperiodiza';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';

interface Props {
  clientId: string;
  userId: string;
}

const CARBO_CHECKLIST_ITEMS = [
  { key: 'protocol_defined', label: 'Protocolo de carbo-loading definido com o atleta' },
  { key: 'low_residue', label: 'Alimentos de baixo resíduo orientados' },
  { key: 'pre_race_meal', label: 'Refeição pré-prova confirmada' },
  { key: 'gels_isotonics', label: 'Géis/isotônicos da prova confirmados' },
  { key: 'hydration', label: 'Protocolo de hidratação revisado' },
];

export function RacePrepTab({ clientId, userId }: Props) {
  const { data: race, isLoading: raceLoading } = useActiveRace(clientId);
  const { data: logs = [] } = useGutLogs(clientId);
  const { data: protocol } = usePhaseProtocol(clientId);
  const upsertRace = useUpsertActiveRace(clientId, userId);
  const upsertProtocol = useUpsertPhaseProtocol(clientId, userId);
  const createLog = useCreateGutLog(clientId, userId);
  const { data: summaries = [] } = useEvolutionSummaries(clientId);
  const generateSummary = useGenerateEvolutionSummary(clientId);

  const [raceDialogOpen, setRaceDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);

  const weeks = useMemo(() => calculateWeeksToRace(race?.race_date), [race?.race_date]);
  const autoPhase = useMemo(() => calculatePhase(weeks), [weeks]);
  const distance = useMemo(() => categorizeDistance(race?.race_distance_km), [race?.race_distance_km]);
  const overridePhase = (protocol?.phase_override as RacePhase | null) || null;
  const currentPhase: RacePhase | null = overridePhase || autoPhase;
  const phaseMeta = currentPhase ? PHASE_META[currentPhase] : null;
  const { data: defaultsRows = [] } = useProtocolDefaults(userId);
  const protocolView = currentPhase ? getMergedProtocol(defaultsRows, currentPhase, distance) : null;
  const suggestion = useMemo(() => suggestProgression(logs as any, currentPhase), [logs, currentPhase]);
  const lastLog = logs[0];

  const showCarboPanel = weeks != null && weeks <= 3 && (race?.race_distance_km ?? 0) >= 21.1;
  const checklist = (protocol?.carboloading_checklist || {}) as Record<string, boolean>;

  if (raceLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  // Estado vazio
  if (!race) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <div>
              <p className="font-semibold mb-1">Nenhuma prova-alvo cadastrada</p>
              <p className="text-sm text-muted-foreground">
                Cadastre a prova-alvo para ativar o módulo de Preparação de Prova.
              </p>
            </div>
            <Button onClick={() => setRaceDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Cadastrar prova
            </Button>
          </CardContent>
        </Card>
        <RaceDialog
          open={raceDialogOpen}
          onOpenChange={setRaceDialogOpen}
          initial={null}
          onSave={(payload) => upsertRace.mutate(payload, { onSuccess: () => setRaceDialogOpen(false) })}
          loading={upsertRace.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 3.1 — Header da prova */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Prova-alvo</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" asChild>
                <Link to="/nutriperiodiza/protocols">
                  <SettingsIcon className="h-3 w-3 mr-1" /> Editor de Protocolos
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRaceDialogOpen(true)}>
                <Edit className="h-3 w-3 mr-1" /> Editar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-lg">{race.race_name || 'Prova sem nome'}</h3>
            {distance && <Badge variant="secondary">{DISTANCE_LABEL[distance]}</Badge>}
            <Badge variant="outline">{race.race_distance_km} km</Badge>
            {race.race_type && <Badge variant="outline" className="capitalize">{race.race_type}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {race.race_date && format(parseISO(race.race_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            {weeks != null && (
              <span className="font-medium text-foreground">
                {weeks > 0 ? `${weeks} semana${weeks === 1 ? '' : 's'} até a prova` : weeks === 0 ? 'É essa semana!' : 'Prova realizada'}
              </span>
            )}
            {race.target_time_minutes && (
              <span>Tempo-alvo: {Math.floor(race.target_time_minutes / 60)}h{String(race.target_time_minutes % 60).padStart(2, '0')}</span>
            )}
          </div>
          {race.notes && <p className="text-sm text-muted-foreground italic">{race.notes}</p>}
        </CardContent>
      </Card>

      {/* 3.2 — Fase atual */}
      {phaseMeta && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Fase atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl">{phaseMeta.emoji}</span>
              <Badge className={phaseMeta.colorClass + ' text-base px-3 py-1'}>
                {phaseMeta.label}
              </Badge>
              {overridePhase && <Badge variant="outline">Manual</Badge>}
              {weeks != null && weeks > 0 && (
                <span className="text-sm text-muted-foreground">{weeks} semanas restantes</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{phaseMeta.description}</p>
            <PhaseOverrideControl
              currentOverride={overridePhase}
              currentReason={protocol?.override_reason || ''}
              onSave={(phase, reason) =>
                upsertProtocol.mutate({
                  phase_override: phase,
                  override_reason: reason,
                  carboloading_checklist: checklist,
                })
              }
            />
          </CardContent>
        </Card>
      )}

      {/* 3.3 — Protocolo da fase */}
      {protocolView && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Protocolo nutricional da fase</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <ProtocolItem label="CHO diário" value={protocolView.cho_daily_range} />
            <ProtocolItem label="Gut training" value={protocolView.gut_training} />
            <ProtocolItem label="Pré-treino" value={protocolView.pre_training} />
            <ProtocolItem label="Intra-treino" value={protocolView.intra_training} />
            <ProtocolItem label="Carbo-loading" value={protocolView.carboloading} fullWidth />
          </CardContent>
        </Card>
      )}

      {/* 3.5 — Painel carbo-loading (≤3 sem + meia ou maior) */}
      {showCarboPanel && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Carbo-loading — {weeks} {weeks === 1 ? 'semana' : 'semanas'} para a prova
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{protocolView?.carboloading}</p>
            <div className="space-y-2">
              {CARBO_CHECKLIST_ITEMS.map((item) => (
                <label key={item.key} className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={!!checklist[item.key]}
                    onCheckedChange={(v) =>
                      upsertProtocol.mutate({
                        phase_override: overridePhase,
                        override_reason: protocol?.override_reason || null,
                        carboloading_checklist: { ...checklist, [item.key]: !!v },
                      })
                    }
                  />
                  <span className={`text-sm ${checklist[item.key] ? 'line-through text-muted-foreground' : ''}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3.4 — Treinamento intestinal */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Treinamento intestinal</CardTitle>
          <Button size="sm" onClick={() => setLogDialogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Novo registro
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status atual */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatusBox
              label="Taxa atual"
              value={lastLog?.current_cho_rate_g_h ? `${lastLog.current_cho_rate_g_h} g/h` : '—'}
            />
            <StatusBox
              label="GI Score"
              value={lastLog?.gi_score_global != null ? `${lastLog.gi_score_global}/10` : '—'}
              valueClass={giScoreColorClass(lastLog?.gi_score_global)}
            />
            <StatusBox
              label="Última decisão"
              value={lastLog?.decision ? decisionLabel(lastLog.decision) : '—'}
            />
            <StatusBox
              label="Sugestão"
              value={
                suggestion.next_cho_rate != null
                  ? `${decisionLabel(suggestion.decision)} → ${suggestion.next_cho_rate} g/h`
                  : '—'
              }
              hint={suggestion.reason}
            />
          </div>

          {/* Histórico */}
          {logs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">Sem registros ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>GI Score</TableHead>
                    <TableHead>Decisão</TableHead>
                    <TableHead>Próxima meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{format(parseISO(log.checkin_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{log.current_cho_rate_g_h ?? '—'} g/h</TableCell>
                      <TableCell className={giScoreColorClass(log.gi_score_global)}>
                        {log.gi_score_global ?? '—'}/10
                      </TableCell>
                      <TableCell>{log.decision ? decisionLabel(log.decision) : '—'}</TableCell>
                      <TableCell>{log.next_cho_rate_g_h ?? '—'} g/h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo de Evolução por IA */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Resumo de Evolução (IA)</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => generateSummary.mutate()}
            disabled={generateSummary.isPending || logs.length === 0}
          >
            {generateSummary.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Gerar resumo</>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Registre ao menos um log de gut training para que a IA possa gerar o resumo.
            </p>
          )}
          {summaries.length === 0 && logs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum resumo gerado ainda. Clique em "Gerar resumo" para criar uma análise da evolução.
            </p>
          )}
          {summaries.map((s) => (
            <div key={s.id} className="border rounded-md p-4 bg-muted/20 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{format(parseISO(s.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</Badge>
                {s.phase && <Badge variant="secondary">Fase: {PHASE_META[s.phase as RacePhase]?.label ?? s.phase}</Badge>}
                {s.weeks_to_race != null && <Badge variant="secondary">{s.weeks_to_race}w até a prova</Badge>}
                <Badge variant="outline">{s.logs_analyzed} logs</Badge>
                <span>· {s.model}</span>
              </div>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {s.summary_markdown}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <RaceDialog
        open={raceDialogOpen}
        onOpenChange={setRaceDialogOpen}
        initial={race}
        onSave={(payload) =>
          upsertRace.mutate({ ...payload, id: race.id }, { onSuccess: () => setRaceDialogOpen(false) })
        }
        loading={upsertRace.isPending}
      />

      <GutLogDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        suggestion={suggestion}
        onSave={(payload) =>
          createLog.mutate(payload, { onSuccess: () => setLogDialogOpen(false) })
        }
        loading={createLog.isPending}
      />
    </div>
  );
}

function ProtocolItem({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={`p-3 rounded-md bg-muted/30 ${fullWidth ? 'md:col-span-2' : ''}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function StatusBox({ label, value, valueClass, hint }: { label: string; value: string; valueClass?: string; hint?: string }) {
  return (
    <div className="p-3 rounded-md bg-muted/30">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold ${valueClass || ''}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function decisionLabel(d: string): string {
  if (d === 'advance') return 'Avançou';
  if (d === 'maintain') return 'Manteve';
  if (d === 'regress') return 'Regrediu';
  return d;
}

function PhaseOverrideControl({
  currentOverride, currentReason, onSave,
}: {
  currentOverride: RacePhase | null;
  currentReason: string;
  onSave: (phase: RacePhase | null, reason: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<string>(currentOverride || 'auto');
  const [reason, setReason] = useState(currentReason);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          {currentOverride ? 'Editar override de fase' : 'Sobrescrever fase manualmente'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sobrescrever fase</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Fase</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (calculado)</SelectItem>
                {(['base','build','specific','peak','taper','race'] as RacePhase[]).map(p => (
                  <SelectItem key={p} value={p}>{PHASE_META[p].emoji} {PHASE_META[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Justificativa</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => {
            onSave(phase === 'auto' ? null : phase as RacePhase, phase === 'auto' ? null : reason);
            setOpen(false);
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RaceDialog({
  open, onOpenChange, initial, onSave, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ActiveRace | null;
  onSave: (payload: Partial<ActiveRace>) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.race_name || '');
  const [date, setDate] = useState(initial?.race_date || '');
  const [km, setKm] = useState(initial?.race_distance_km?.toString() || '');
  const [type, setType] = useState(initial?.race_type || 'road');
  const [target, setTarget] = useState(initial?.target_time_minutes?.toString() || '');
  const [notes, setNotes] = useState(initial?.notes || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar prova' : 'Cadastrar prova'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Maratona do Rio" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data*</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div>
              <Label>Distância (km)*</Label>
              <Input type="number" step="0.1" value={km} onChange={e => setKm(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="road">Estrada</SelectItem>
                  <SelectItem value="trail">Trilha</SelectItem>
                  <SelectItem value="track">Pista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tempo-alvo (minutos)</Label>
              <Input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="ex: 240" />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={loading || !date || !km}
            onClick={() => onSave({
              race_name: name || null,
              race_date: date,
              race_distance_km: km ? Number(km) : null,
              race_type: type,
              target_time_minutes: target ? Number(target) : null,
              notes: notes || null,
            })}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GutLogDialog({
  open, onOpenChange, suggestion, onSave, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  suggestion: { decision: 'advance' | 'maintain' | 'regress'; next_cho_rate: number | null; reason: string };
  onSave: (payload: any) => void;
  loading: boolean;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cho, setCho] = useState('');
  const [source, setSource] = useState('');
  const [adherence, setAdherence] = useState('');
  const [nausea, setNausea] = useState('0');
  const [bloating, setBloating] = useState('0');
  const [cramps, setCramps] = useState('0');
  const [diarrhea, setDiarrhea] = useState('0');
  const [decision, setDecision] = useState<string>('');
  const [nextRate, setNextRate] = useState('');
  const [notes, setNotes] = useState('');
  const [athleteNotes, setAthleteNotes] = useState('');

  const applySuggestion = () => {
    setDecision(suggestion.decision);
    setNextRate(suggestion.next_cho_rate?.toString() || '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo registro de gut training</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Aderência (%)</Label>
              <Input type="number" min="0" max="100" value={adherence} onChange={e => setAdherence(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Taxa CHO praticada (g/h)</Label>
              <Input type="number" step="0.1" value={cho} onChange={e => setCho(e.target.value)} />
            </div>
            <div>
              <Label>Fonte</Label>
              <Input value={source} onChange={e => setSource(e.target.value)} placeholder="Ex: gel SiS + isotônico" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Sintomas gastrointestinais (0–10)</Label>
            <div className="grid grid-cols-2 gap-3">
              <SymptomInput label="Náusea" value={nausea} onChange={setNausea} />
              <SymptomInput label="Distensão" value={bloating} onChange={setBloating} />
              <SymptomInput label="Cólicas" value={cramps} onChange={setCramps} />
              <SymptomInput label="Diarreia" value={diarrhea} onChange={setDiarrhea} />
            </div>
          </div>

          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Sugestão do sistema
              </p>
              <Button size="sm" variant="outline" type="button" onClick={applySuggestion}>Usar sugestão</Button>
            </div>
            <p className="text-sm">
              <strong>{decisionLabel(suggestion.decision)}</strong>
              {suggestion.next_cho_rate != null && ` → ${suggestion.next_cho_rate} g/h`}
            </p>
            <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Decisão</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="advance">Avançar</SelectItem>
                  <SelectItem value="maintain">Manter</SelectItem>
                  <SelectItem value="regress">Regredir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Próxima meta (g/h)</Label>
              <Input type="number" step="0.1" value={nextRate} onChange={e => setNextRate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Observações do nutricionista</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Relato do atleta</Label>
            <Textarea value={athleteNotes} onChange={e => setAthleteNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={loading}
            onClick={() => onSave({
              checkin_date: date,
              current_cho_rate_g_h: cho ? Number(cho) : null,
              cho_source: source || null,
              adherence_pct: adherence ? Number(adherence) : null,
              gi_nausea: Number(nausea) || 0,
              gi_bloating: Number(bloating) || 0,
              gi_cramps: Number(cramps) || 0,
              gi_diarrhea: Number(diarrhea) || 0,
              decision: decision || null,
              next_cho_rate_g_h: nextRate ? Number(nextRate) : null,
              nutritionist_notes: notes || null,
              athlete_notes: athleteNotes || null,
            })}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SymptomInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.5" min="0" max="10" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
