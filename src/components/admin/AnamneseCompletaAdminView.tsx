// Visão administrativa da ANAMNESE COMPLETA (Fase 3): 12 seções organizadas,
// semana de treino visual, refeições por horário, alertas internos, anexos
// (URLs assinadas), marcar como revisada, notas internas e cópia da estrutura
// normalizada para a IA.
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Copy, CheckCircle2, FileDown, Paperclip, Save, Loader2 } from 'lucide-react';
import { normalizeAnamneseCompleta } from '@/lib/anamneseCompletaNormalize';
import { computeInternalAlerts, type AlertLevel } from '@/lib/anamneseCompletaAlerts';

interface QLike { id: string; question_key?: string | null; }
interface ResponseLike {
  id: string; responses: Record<string, any>; status?: string | null;
  internal_notes?: string | null; internal_alerts?: any; submitted_at?: string;
}

const LEVEL_STYLE: Record<AlertLevel, string> = {
  high: 'bg-red-500/10 text-red-600 border-red-500/30',
  attention: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  info: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
};
const LEVEL_LABEL: Record<AlertLevel, string> = { high: 'Alta atenção', attention: 'Atenção', info: 'Informativo' };

function Row({ label, value }: { label: string; value: any }) {
  const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground sm:col-span-1">{label}</span>
      <span className={`text-sm sm:col-span-2 whitespace-pre-wrap ${empty ? 'text-muted-foreground italic' : ''}`}>
        {empty ? '—' : Array.isArray(value) ? value.join(', ') : String(value)}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export function AnamneseCompletaAdminView({ response, questions, onUpdated }: {
  response: ResponseLike; questions: QLike[]; onUpdated?: () => void;
}) {
  const norm = useMemo(() => normalizeAnamneseCompleta(questions, response.responses), [questions, response.responses]);
  const alerts = useMemo(() => computeInternalAlerts(questions, response.responses), [questions, response.responses]);
  const [notes, setNotes] = useState(response.internal_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const reviewed = response.status === 'reviewed';

  // persiste alertas calculados (best-effort) para consulta/relatório
  useEffect(() => {
    const prev = JSON.stringify(response.internal_alerts || []);
    if (JSON.stringify(alerts) !== prev) {
      supabase.from('anamnese_responses' as any).update({ internal_alerts: alerts }).eq('id', response.id).then(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, response.id]);

  // URLs assinadas dos anexos (bucket privado)
  useEffect(() => {
    const atts = norm.diagnoses_and_exams.attachments || [];
    if (!Array.isArray(atts) || !atts.length) return;
    (async () => {
      const map: Record<string, string> = {};
      for (const att of atts) {
        try {
          const { data } = await supabase.storage.from('athlete-attachments').createSignedUrl(att.path, 3600);
          if (data?.signedUrl) map[att.path] = data.signedUrl;
        } catch { /* ignora */ }
      }
      setSigned(map);
    })();
  }, [norm.diagnoses_and_exams.attachments]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await supabase.from('anamnese_responses' as any).update({ internal_notes: notes }).eq('id', response.id);
      toast.success('Observação interna salva.');
      onUpdated?.();
    } catch (e: any) { toast.error(e?.message || 'Erro ao salvar'); } finally { setSavingNotes(false); }
  };

  const toggleReviewed = async () => {
    setReviewing(true);
    try {
      const next = reviewed ? 'submitted' : 'reviewed';
      await supabase.from('anamnese_responses' as any)
        .update({ status: next, reviewed_at: reviewed ? null : new Date().toISOString() }).eq('id', response.id);
      toast.success(reviewed ? 'Marcada como não revisada.' : 'Anamnese marcada como revisada.');
      onUpdated?.();
    } catch (e: any) { toast.error(e?.message || 'Erro'); } finally { setReviewing(false); }
  };

  const copyNormalized = () => {
    navigator.clipboard.writeText(JSON.stringify({ ...norm, internal_alerts: alerts }, null, 2));
    toast.success('Estrutura normalizada (JSON) copiada.');
  };

  return (
    <div className="space-y-4">
      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={reviewed ? 'default' : 'secondary'} className="gap-1">
          {reviewed ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}{reviewed ? 'Revisada' : (response.status || 'enviada')}
        </Badge>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleReviewed} disabled={reviewing}>
          {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {reviewed ? 'Desmarcar revisão' : 'Marcar como revisada'}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={copyNormalized}>
          <FileDown className="h-3.5 w-3.5" /> Copiar dados estruturados (IA)
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Copy className="h-3.5 w-3.5" /> Imprimir
        </Button>
      </div>

      {/* 11. Alertas (destaque no topo) */}
      {alerts.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas internos ({alerts.length})</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {alerts.map((al, i) => (
              <div key={i} className={`rounded-lg border p-2.5 text-xs ${LEVEL_STYLE[al.level]}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{al.category}</span>
                  <span className="text-[10px] uppercase tracking-wide">{LEVEL_LABEL[al.level]}</span>
                </div>
                <p className="mt-0.5 opacity-90">{al.message}</p>
                <p className="mt-0.5 opacity-70">Origem: {al.question_key} · Resposta: {al.answer}</p>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">Alertas internos ao nutricionista — não são diagnóstico e não são exibidos ao atleta.</p>
          </CardContent>
        </Card>
      )}

      {/* 1. Identificação */}
      <Section title="1. Identificação">
        <Row label="Nome" value={norm.athlete_profile.name} />
        <Row label="Nascimento" value={norm.athlete_profile.birth_date} />
        <Row label="Sexo" value={norm.athlete_profile.sex} />
        <Row label="Peso (kg)" value={norm.athlete_profile.weight_kg} />
        <Row label="Altura (cm)" value={norm.athlete_profile.height_cm} />
        <Row label="Mudança de peso (3m)" value={[norm.weight_history.change, norm.weight_history.planned && `planejada: ${norm.weight_history.planned}`].filter(Boolean).join(' · ')} />
      </Section>

      {/* 2. Objetivos */}
      <Section title="2. Objetivos">
        <Row label="Objetivo prioritário" value={norm.goals.primary} />
        <Row label="Selecionados" value={norm.goals.selected} />
        {norm.goals.other && <Row label="Outro" value={norm.goals.other} />}
      </Section>

      {/* 3. Semana de treinamento (visual por dia) */}
      <Section title="3. Semana de treinamento">
        {norm.weekly_training.length === 0 ? <p className="text-sm text-muted-foreground italic">Não informado.</p> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {norm.weekly_training.map((d) => (
              <div key={d.day} className="rounded-lg border p-2.5">
                <p className="font-semibold text-sm mb-1">{d.day}</p>
                {d.sessions.map((s: any, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {[s.start_time, s.modality, s.session_type, s.duration_minutes && `${s.duration_minutes}min`, s.distance_km && `${s.distance_km}km`, s.rpe && `RPE ${s.rpe}`].filter(Boolean).join(' · ')}
                    {s.notes ? ` — ${s.notes}` : ''}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 4. Prova-alvo */}
      <Section title="4. Prova-alvo">
        {(norm.target_race as any).has_target_race === false ? <p className="text-sm text-muted-foreground italic">Sem prova-alvo.</p> : (
          <>
            <Row label="Prova" value={[(norm.target_race as any).name, (norm.target_race as any).modality, (norm.target_race as any).distance].filter(Boolean).join(' · ')} />
            <Row label="Data / largada" value={[(norm.target_race as any).date, (norm.target_race as any).start_time].filter(Boolean).join(' · ')} />
            <Row label="Prioridade" value={(norm.target_race as any).priority} />
            <Row label="Duração estimada" value={(norm.target_race as any).estimated_duration} />
            <Row label="Já fez carbloading" value={(norm.target_race as any).did_carbloading} />
            <Row label="Desconforto GI em provas" value={[(norm.target_race as any).gi_discomfort, (norm.target_race as any).gi_discomfort_desc].filter(Boolean).join(' — ')} />
          </>
        )}
      </Section>

      {/* 5. Alimentação relacionada aos treinos */}
      <Section title="5. Alimentação relacionada aos treinos">
        <Row label="Pré-treino matinal" value={[norm.morning_pre_training.situation, norm.morning_pre_training.time, norm.morning_pre_training.foods, norm.morning_pre_training.quantities, norm.morning_pre_training.time_before_training].filter(Boolean).join(' · ')} />
        <Row label="Intervalo refeição→treino" value={[norm.meal_to_training_interval.interval, norm.meal_to_training_interval.varies_when].filter(Boolean).join(' · ')} />
        <Row label="Durante treinos longos" value={norm.intra_training.map((p: any) => [p.product, p.brand, p.total_amount, p.per_hour, p.caffeine && `cafeína: ${p.caffeine}`].filter(Boolean).join(' ')).join(' | ')} />
        <Row label="Hidratação / transpiração" value={[norm.hydration_and_sweat.fluids_per_day, norm.hydration_and_sweat.sweat, ...(norm.hydration_and_sweat.signs || [])].filter(Boolean).join(' · ')} />
      </Section>

      {/* 6. Alimentação habitual (por horário/refeição) */}
      <Section title="6. Alimentação habitual">
        {norm.habitual_meals.length === 0 ? <p className="text-sm text-muted-foreground italic">Não informado.</p> : (
          <div className="space-y-2">
            {norm.habitual_meals.map((m: any, i: number) => (
              <div key={i} className="rounded-lg border p-2.5">
                <p className="font-semibold text-sm">{m.meal_name} {m.time && <span className="text-xs text-muted-foreground">· {m.time}</span>} {m.training_relation && <Badge variant="outline" className="ml-1 text-[10px]">{m.training_relation}</Badge>}</p>
                <ul className="mt-1 space-y-0.5">
                  {(m.foods || []).map((f: any, j: number) => (
                    <li key={j} className="text-xs text-muted-foreground">• {[f.food_name, [f.quantity, f.unit].filter(Boolean).join(' '), f.preparation, f.brand].filter(Boolean).join(' — ')}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="pt-2"><Row label="Diferenças entre os dias" value={[...(norm.day_to_day_food_changes.changes || []), norm.day_to_day_food_changes.what_changes].filter(Boolean).join(' · ')} /></div>
      </Section>

      {/* 7. Preferências e restrições */}
      <Section title="7. Preferências e restrições">
        <Row label="Restrições" value={norm.dietary_restrictions.map((r: any) => [r.type, r.food_or_group, r.reason].filter(Boolean).join(' — ')).join(' | ')} />
        <Row label="Gosta / manter" value={norm.food_preferences.preferred} />
        <Row label="Evitar" value={norm.food_preferences.avoid} />
        <Row label="Fome / comportamento" value={[...(norm.hunger_and_eating_behavior.patterns || []), norm.hunger_and_eating_behavior.when].filter(Boolean).join(' · ')} />
      </Section>

      {/* 8. Saúde e sintomas */}
      <Section title="8. Saúde e sintomas">
        <div className="pb-2">
          <p className="text-xs text-muted-foreground mb-1">Sintomas gastrointestinais</p>
          {norm.gastrointestinal_symptoms.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhum relatado.</p> : (
            <ul className="space-y-0.5">
              {norm.gastrointestinal_symptoms.map((s: any, i: number) => (
                <li key={i} className="text-sm">• <strong>{s.symptom}</strong> — {[Array.isArray(s.moments) ? s.moments.join('/') : '', s.frequency, s.intensity].filter(Boolean).join(', ')}</li>
              ))}
            </ul>
          )}
        </div>
        <Row label="Saúde / recuperação" value={[...(norm.health_and_recovery.situations || []), norm.health_and_recovery.description, norm.health_and_recovery.since, norm.health_and_recovery.professional_followup && `acompanhamento: ${norm.health_and_recovery.professional_followup}`].filter(Boolean).join(' · ')} />
        <Row label="Sinais (3 meses)" value={norm.energy_availability_flags} />
        <Row label="Ciclo menstrual" value={[norm.menstrual_health.status, norm.menstrual_health.last_spontaneous].filter(Boolean).join(' · ')} />
        <Row label="Sono" value={[norm.sleep.hours, norm.sleep.quality, ...(norm.sleep.signs || [])].filter(Boolean).join(' · ')} />
        <div className="pt-1">
          <Row label="Diagnósticos" value={norm.diagnoses_and_exams.diagnoses} />
          {norm.diagnoses_and_exams.description && <Row label="Descrição" value={norm.diagnoses_and_exams.description} />}
          {Array.isArray(norm.diagnoses_and_exams.attachments) && norm.diagnoses_and_exams.attachments.length > 0 && (
            <div className="py-1.5">
              <p className="text-xs text-muted-foreground mb-1">Anexos de exames</p>
              <div className="space-y-1">
                {norm.diagnoses_and_exams.attachments.map((att: any, i: number) => (
                  <a key={i} href={signed[att.path] || '#'} target="_blank" rel="noreferrer"
                    className={`flex items-center gap-2 text-xs ${signed[att.path] ? 'text-primary underline' : 'text-muted-foreground'}`}>
                    <Paperclip className="h-3.5 w-3.5" /> {att.name}{!signed[att.path] && ' (gerando link…)'}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 9. Medicamentos e suplementos */}
      <Section title="9. Medicamentos e suplementos">
        <Row label="Medicamentos" value={norm.medications.map((m: any) => [m.name, m.dose, m.time, m.reason].filter(Boolean).join(' — ')).join(' | ')} />
        <Row label="Suplementos" value={norm.supplements.map((s: any) => [s.product, s.brand, s.amount, s.time, s.frequency, s.recommended_by].filter(Boolean).join(' ')).join(' | ')} />
      </Section>

      {/* 10. Frequência alimentar */}
      <Section title="10. Frequência alimentar">
        {Object.keys(norm.food_frequency).length === 0 ? <p className="text-sm italic text-muted-foreground">Não informado.</p> : (
          <div className="grid gap-1 sm:grid-cols-2">
            {Object.entries(norm.food_frequency).map(([grpName, col]) => <Row key={grpName} label={grpName} value={col} />)}
          </div>
        )}
      </Section>

      {/* 12. Observações adicionais */}
      <Section title="11. Observações adicionais">
        <p className="text-sm whitespace-pre-wrap">{norm.additional_notes || <span className="text-muted-foreground italic">—</span>}</p>
      </Section>

      {/* Notas internas do nutricionista */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Observação interna (somente admin)</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-2">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações internas sobre esta anamnese…" />
          <Button size="sm" className="gap-1.5" onClick={saveNotes} disabled={savingNotes}>
            {savingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar observação
          </Button>
        </CardContent>
      </Card>
      <Separator />
    </div>
  );
}
