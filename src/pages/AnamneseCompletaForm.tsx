// ANAMNESE COMPLETA — wizard do atleta (Fase 2).
// - Etapas curtas (por seção) + tela de revisão + confirmação.
// - Lógica condicional (mostra/oculta perguntas e sub-campos).
// - Autosave de rascunho (status in_progress) e retomada posterior.
// - Prefill a partir do perfil (revisável antes do envio).
// Armazena responses keyed by question.id ({answer, comment}) — compatível com o
// admin e a IA existentes.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Save, Send, Loader2, CheckCircle2, ListChecks } from 'lucide-react';
import { QuestionRenderer } from '@/components/anamnese-completa/QuestionRenderer';
import { validateSimpleMeal } from '@/components/anamnese-completa/SimpleMealField';
import { isQuestionVisible } from '@/lib/anamneseConditions';
import { firstMissing } from '@/lib/anamneseValidation';
import { formatAnyAnswer } from '@/lib/formatAnamneseAnswer';
import type { AnamneseForm, AnamneseQuestion } from '@/hooks/useAnamneseForms';

const DRAFT_DEBOUNCE_MS = 1200;

interface Props {
  form: AnamneseForm;
  questions: AnamneseQuestion[];
  clientId: string;
}

// Valor "vazio" para checagem de obrigatórios (cobre grupos e listas).
function isBlank(v: any): boolean {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.values(v).every(isBlank);
  return false;
}

export default function AnamneseCompletaForm({ form, questions, clientId }: Props) {
  const navigate = useNavigate();
  const sorted = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions]);
  const keyById = useMemo(() => Object.fromEntries(sorted.map((q) => [q.id, q.question_key || q.id])), [sorted]);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [step, setStep] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const answersByKey = useMemo(() => {
    const out: Record<string, any> = {};
    for (const q of sorted) out[q.question_key || q.id] = answers[q.id];
    return out;
  }, [answers, sorted]);

  // Lista de perguntas atualmente visíveis (respeita conditional_logic).
  const visibleQuestions = useMemo(
    () => sorted.filter((q) => isQuestionVisible(q, answersByKey)),
    [sorted, answersByKey],
  );
  const totalSteps = visibleQuestions.length + 1; // +1 = revisão

  // ─────────── carregar rascunho ou prefill ───────────
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: draft } = await supabase
        .from('anamnese_responses' as any)
        .select('id, responses')
        .eq('form_id', form.id).eq('client_id', clientId).eq('status', 'in_progress')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();

      if (!alive) return;
      if (draft) {
        const raw = (draft as any).responses || {};
        const hydrated: Record<string, any> = {};
        for (const [qid, val] of Object.entries<any>(raw)) hydrated[qid] = val && typeof val === 'object' && 'answer' in val ? val.answer : val;
        setAnswers(hydrated);
        setDraftId((draft as any).id);
        setLoading(false);
        return;
      }
      // prefill do perfil
      const { data: profile } = await supabase
        .from('athlete_profiles' as any).select('*').eq('client_id', clientId).maybeSingle();
      const init: Record<string, any> = {};
      for (const q of sorted) {
        const pk = q.config?.prefill_from_profile;
        if (pk && profile && (profile as any)[pk] != null) init[q.id] = (profile as any)[pk];
        // prefill de sub-campos de field_group
        if (q.question_type === 'field_group' && Array.isArray(q.config?.fields)) {
          const grp: Record<string, any> = {};
          for (const f of q.config.fields) {
            const fpk = (f as any).prefill_from_profile;
            if (fpk && profile && (profile as any)[fpk] != null) grp[f.key] = (profile as any)[fpk];
          }
          if (Object.keys(grp).length) init[q.id] = { ...(init[q.id] || {}), ...grp };
        }
      }
      if (alive) { setAnswers(init); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [form.id, clientId, sorted]);

  // ─────────── autosave ───────────
  const persistDraft = useCallback(async (): Promise<string | null> => {
    const responses: Record<string, any> = {};
    for (const q of sorted) responses[q.id] = { answer: answers[q.id] ?? null, comment: null };
    setSaving(true);
    try {
      if (draftId) {
        await supabase.from('anamnese_responses' as any).update({ responses }).eq('id', draftId);
        return draftId;
      }
      const { data, error } = await supabase.from('anamnese_responses' as any)
        .insert({ form_id: form.id, client_id: clientId, responses, status: 'in_progress', started_at: new Date().toISOString(), form_version: form.version ?? 1 })
        .select('id').single();
      if (error) throw error;
      const id = (data as any).id;
      setDraftId(id);
      return id;
    } catch (e: any) {
      console.error('autosave', e);
      return draftId;
    } finally {
      setSaving(false);
      dirty.current = false;
    }
  }, [answers, sorted, draftId, form.id, form.version, clientId]);

  useEffect(() => {
    if (loading) return;
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persistDraft(); }, DRAFT_DEBOUNCE_MS);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [answers, loading, persistDraft]);

  const setAnswer = (qid: string, v: any) => setAnswers((a) => ({ ...a, [qid]: v }));

  // ─────────── validação de obrigatórios ───────────
  const requiredPending = useMemo(() => {
    const pend: { q: AnamneseQuestion; label: string }[] = [];
    for (const q of sorted) {
      if (!isQuestionVisible(q, answersByKey)) continue;
      const miss = firstMissing(q as any, answers[q.id], answersByKey);
      if (miss) pend.push({ q, label: miss });
    }
    return pend;
  }, [sorted, answersByKey, answers]);

  const gotoQuestion = (q: AnamneseQuestion) => {
    const idx = visibleQuestions.findIndex((x) => x.id === q.id);
    if (idx >= 0) setStep(idx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveExit = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await persistDraft();
    toast.success('Progresso salvo. Você pode continuar depois.');
    navigate('/athlete');
  };

  const handleSubmit = async () => {
    if (requiredPending.length) {
      const first = requiredPending[0];
      toast.error(`Falta responder: “${first.label}”.`);
      gotoQuestion(first.q);
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const id = await persistDraft();
    if (!id) { toast.error('Não foi possível salvar antes de enviar. Tente novamente.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('anamnese_responses' as any)
        .update({ status: 'submitted', submitted_at: new Date().toISOString(), form_version: form.version ?? 1 })
        .eq('id', id);
      if (error) throw error;
      // efeitos colaterais (mesma convenção do fluxo atual)
      await supabase.from('clients' as any).update({ athlete_status: 'ready_for_ai_analysis' }).eq('id', clientId);
      await supabase.from('athlete_profiles' as any).upsert(
        { client_id: clientId, anamnese_completed: true, anamnese_submitted_at: new Date().toISOString() },
        { onConflict: 'client_id' },
      );
      supabase.functions.invoke('notify-anamnese-submitted', { body: { clientId, formId: form.id } }).catch(() => {});
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar a anamnese.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="text-xl font-semibold">Anamnese enviada com sucesso.</h1>
        <p className="text-muted-foreground">Suas respostas serão analisadas para a construção de um plano alimentar compatível com sua rotina, seus treinos e seus objetivos.</p>
        <Button onClick={() => navigate('/athlete')}>Voltar ao início</Button>
      </div>
    );
  }

  const isReview = step >= visibleQuestions.length;
  const currentQuestion = !isReview ? visibleQuestions[step] : null;
  const stepProgress = ((Math.min(step, visibleQuestions.length) + 1) / totalSteps) * 100;

  // Se o step atual passou a apontar para uma pergunta que ficou oculta,
  // ajusta o índice para não travar o wizard.
  useEffect(() => {
    if (!isReview && !currentQuestion && visibleQuestions.length > 0) {
      setStep(Math.min(step, visibleQuestions.length));
    }
  }, [isReview, currentQuestion, visibleQuestions.length, step]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">ANAMNESE COMPLETA</h1>
        <p className="text-sm text-muted-foreground">Responda com atenção. As informações serão utilizadas para criar um plano alimentar compatível com sua rotina, seus treinos, seus objetivos, suas preferências e os alimentos que você já consome.</p>
      </div>

      <div className="mb-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Pergunta {Math.min(step + 1, visibleQuestions.length)} de {visibleQuestions.length}
            {currentQuestion && ` · ${currentQuestion.section}`}
          </span>
          {saving ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> salvando…</span> : draftId ? <span>rascunho salvo</span> : null}
        </div>
        <Progress value={stepProgress} />
      </div>

      {!isReview && currentQuestion ? (
        <Card key={currentQuestion.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {currentQuestion.question_text}{currentQuestion.is_required && <span className="text-destructive"> *</span>}
            </CardTitle>
            {(currentQuestion.config?.helper || (currentQuestion as any).helper) && (
              <p className="text-xs text-muted-foreground">
                {currentQuestion.config?.helper || (currentQuestion as any).helper}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <QuestionRenderer
              question={currentQuestion as any}
              value={answers[currentQuestion.id]}
              onChange={(v) => setAnswer(currentQuestion.id, v)}
              answersByKey={answersByKey}
              clientId={clientId}
            />
          </CardContent>
        </Card>
      ) : (
        <ReviewStep sorted={sorted} answers={answers} answersByKey={answersByKey} keyById={keyById}
          pending={requiredPending} onEdit={gotoQuestion} />
      )}

      {/* barra de ações fixa */}
      <div className="safe-fixed-bottom fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => { setStep((s) => s - 1); window.scrollTo({ top: 0 }); }} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleSaveExit}>
            <Save className="h-4 w-4" /> <span className="hidden sm:inline">Salvar e continuar depois</span>
          </Button>
          <div className="ml-auto">
            {!isReview ? (
              <Button onClick={() => {
                // Bloqueia avanço quando a etapa atual tem campos obrigatórios pendentes.
                const q = currentQuestion;
                if (q) {
                  const cfg: any = q.config || {};
                  const ans = answers[q.id];
                  if (q.is_required && q.question_type === 'meal_plan_editor' && cfg.simpleMode) {
                    const defaults: string[] = Array.isArray(cfg.defaultMeals) ? cfg.defaultMeals : [];
                    const arr = Array.isArray(ans) ? ans : [];
                    for (let i = 0; i < defaults.length; i++) {
                      const err = validateSimpleMeal(arr[i], defaults[i]);
                      if (err) { toast.error(err); return; }
                    }
                  } else {
                    // Valida a pergunta E os sub-campos obrigatórios (field_group)
                    // e a completude do telefone/WhatsApp (DDI+DDD+número).
                    const miss = firstMissing(q as any, ans, answersByKey);
                    if (miss) { toast.error(`Responda: “${miss}”.`); return; }
                  }
                }
                setStep((s) => s + 1); window.scrollTo({ top: 0 });
              }} className="gap-1.5">
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar anamnese
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── tela de revisão ───────────
function ReviewStep({ sorted, answers, answersByKey, keyById, pending, onEdit }: {
  sorted: AnamneseQuestion[]; answers: Record<string, any>; answersByKey: Record<string, any>;
  keyById: Record<string, string>; pending: { q: AnamneseQuestion; label: string }[]; onEdit: (q: AnamneseQuestion) => void;
}) {
  const visible = sorted.filter((q) => isQuestionVisible(q, answersByKey));
  const bySection: Record<string, AnamneseQuestion[]> = {};
  for (const q of visible) (bySection[q.section] ||= []).push(q);
  const pendingIds = new Set(pending.map((p) => p.q.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /><h2 className="text-base font-semibold">Revisão antes do envio</h2></div>
      {pending.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium text-amber-700">Faltam campos obrigatórios:</p>
          <ul className="mt-1 space-y-0.5">
            {pending.map((p) => (
              <li key={p.q.id}><button className="text-amber-700 underline" onClick={() => onEdit(p.q)}>{p.label}</button></li>
            ))}
          </ul>
        </div>
      )}
      {Object.entries(bySection).map(([section, qs]) => (
        <Card key={section}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{section}</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEdit(qs[0])}>Editar</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {qs.map((q) => {
              const ans = answers[q.id];
              const text = isBlank(ans) ? '—' : formatAnyAnswer(ans);
              return (
                <div key={q.id} className={`text-sm ${pendingIds.has(q.id) ? 'text-amber-700' : ''}`}>
                  <span className="text-muted-foreground">{q.question_text}: </span>
                  <span className="whitespace-pre-wrap">{text}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
