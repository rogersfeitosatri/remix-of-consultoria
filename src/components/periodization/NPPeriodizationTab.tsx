import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Plus, ChevronDown, ChevronUp, Calendar, Wand2 } from 'lucide-react';
import { useNutritionalPeriodization } from '@/hooks/useNutritionalPeriodization';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addWeeks, format, startOfWeek, differenceInWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clientId: string;
  client?: any;
}

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

export function NPPeriodizationTab({ clientId, client }: Props) {
  const { fetchPeriodizationWeeks, savePeriodizationWeek } = useNutritionalPeriodization(clientId);
  const { data: weeks = [] } = fetchPeriodizationWeeks(clientId);
  const [cycleStart, setCycleStart] = useState('');
  const [numWeeks, setNumWeeks] = useState(12);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [editingWeek, setEditingWeek] = useState<any>(null);

  // Fetch athlete profile for target_race info
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

  // Auto-generate cycle with training phases
  const generateAutoPhases = () => {
    const startDate = client?.start_date;
    const raceDate = athleteProfile?.target_deadline;
    if (!startDate || !raceDate) return;

    const today = new Date();
    const race = new Date(raceDate + 'T12:00:00');
    const totalWeeks = Math.max(differenceInWeeks(race, today), 4);

    // Phase distribution: Taper last 2 weeks, Competition last week overlaps
    // Base: ~40%, Específico: ~35%, Polimento: ~15%, Competição: ~10%
    const taperWeeks = Math.max(Math.round(totalWeeks * 0.10), 1);
    const competitionWeeks = 1;
    const specificWeeks = Math.max(Math.round(totalWeeks * 0.35), 2);
    const baseWeeks = totalWeeks - specificWeeks - taperWeeks - competitionWeeks;

    const phases: { name: string; weeks: number }[] = [
      { name: 'Base / Preparação Geral', weeks: Math.max(baseWeeks, 1) },
      { name: 'Específico / Construção', weeks: specificWeeks },
      { name: 'Polimento / Taper', weeks: taperWeeks },
      { name: 'Competição', weeks: competitionWeeks },
    ];

    const cycleStartDate = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    setCycleStart(cycleStartDate);
    setNumWeeks(totalWeeks);

    let weekCounter = 1;
    const start = startOfWeek(today, { weekStartsOn: 1 });

    for (const phase of phases) {
      for (let i = 0; i < phase.weeks; i++) {
        const weekStart = addWeeks(start, weekCounter - 1);
        const weekEnd = addWeeks(weekStart, 1);
        weekEnd.setDate(weekEnd.getDate() - 1);
        const monthName = format(weekStart, 'MMMM', { locale: ptBR }).toUpperCase();

        // Mark competition week
        const isCompetition = phase.name === 'Competição';

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
        });
        weekCounter++;
      }
    }
  };

  const canAutoGenerate = !!client?.start_date && !!athleteProfile?.target_deadline;

  const toggleWeek = (weekNum: number) => {
    if (expandedWeek === weekNum) {
      setExpandedWeek(null);
      setEditingWeek(null);
    } else {
      setExpandedWeek(weekNum);
      const week = weeks.find((w: any) => w.week_number === weekNum);
      setEditingWeek(week ? { ...week } : null);
    }
  };

  const updateEditing = (key: string, value: any) => {
    setEditingWeek((prev: any) => prev ? { ...prev, [key]: value } : null);
  };

  const saveWeek = () => {
    if (editingWeek) {
      savePeriodizationWeek.mutate(editingWeek);
    }
  };

  // Group weeks by month
  const weeksByMonth: Record<string, any[]> = {};
  weeks.forEach((w: any) => {
    const month = w.month_name || 'SEM MÊS';
    if (!weeksByMonth[month]) weeksByMonth[month] = [];
    weeksByMonth[month].push(w);
  });

  return (
    <div className="space-y-4">
      {/* Generate weeks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Gerar Ciclo de Periodização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Auto-generate button */}
          {canAutoGenerate && weeks.length === 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex-1">
                <p className="text-sm font-medium">Gerar ciclo automaticamente</p>
                <p className="text-xs text-muted-foreground">
                  Baseado na data de hoje até a prova alvo: <strong>{athleteProfile?.target_race}</strong> em {new Date(athleteProfile!.target_deadline + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
              <Button onClick={generateAutoPhases} size="sm" className="gap-1" variant="default">
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

      {/* Weeks list */}
      {Object.entries(weeksByMonth).map(([month, monthWeeks]) => (
        <Card key={month}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{month}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {monthWeeks.map((week: any) => (
              <div key={week.id} className="border border-border rounded-lg">
                <button
                  onClick={() => toggleWeek(week.week_number)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">S{week.week_number}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {week.start_date ? format(new Date(week.start_date + 'T12:00:00'), 'dd/MM') : ''} — {week.end_date ? format(new Date(week.end_date + 'T12:00:00'), 'dd/MM') : ''}
                    </span>
                    {week.phase_name && <Badge className="bg-accent text-accent-foreground text-xs">{week.phase_name}</Badge>}
                    {week.has_competition && <Badge className="bg-destructive/20 text-destructive text-xs">Competição</Badge>}
                    {week.cho_percentage && <Badge variant="outline" className="text-xs">CHO: {week.cho_percentage}%</Badge>}
                  </div>
                  {expandedWeek === week.week_number ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {expandedWeek === week.week_number && editingWeek && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Fase do Treinamento</label>
                        <Input value={editingWeek.phase_name || ''} onChange={e => updateEditing('phase_name', e.target.value)} placeholder="Ex: Base, Específico, Polimento" className="h-7 text-xs" />
                      </div>
                      <div className="flex items-end gap-2">
                        <Checkbox checked={editingWeek.has_competition || false} onCheckedChange={v => updateEditing('has_competition', v)} />
                        <label className="text-xs">Competição</label>
                        {editingWeek.has_competition && (
                          <Input value={editingWeek.competition_name || ''} onChange={e => updateEditing('competition_name', e.target.value)} placeholder="Nome da competição" className="flex-1 h-7 text-xs" />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Planejamento Nutricional</label>
                      <Textarea value={editingWeek.nutritional_plan || ''} onChange={e => updateEditing('nutritional_plan', e.target.value)} rows={2} className="text-xs" />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">% CHO</label>
                        <Input type="number" value={editingWeek.cho_percentage || ''} onChange={e => updateEditing('cho_percentage', Number(e.target.value))} className="h-7 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">% Proteína</label>
                        <Input type="number" value={editingWeek.protein_percentage || ''} onChange={e => updateEditing('protein_percentage', Number(e.target.value))} className="h-7 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">% Lipídeos</label>
                        <Input type="number" value={editingWeek.lipid_percentage || ''} onChange={e => updateEditing('lipid_percentage', Number(e.target.value))} className="h-7 text-xs" />
                      </div>
                    </div>

                    {/* Ergogenic Supplements */}
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

                    {/* Antioxidant Supplements */}
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
                      <label className="text-xs font-medium text-muted-foreground">Ajustes Nutricionais / Suplementos Funcionais</label>
                      <Textarea value={editingWeek.functional_supplements || ''} onChange={e => updateEditing('functional_supplements', e.target.value)} rows={1} className="text-xs" />
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

      {weeks.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma semana gerada. Use o botão acima para criar o ciclo de periodização.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
