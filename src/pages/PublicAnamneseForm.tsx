import { useState, useEffect, useCallback, useMemo } from 'react';
import logoRF from '@/assets/logo-rf.jpg';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PersonStanding, Send, CheckCircle2, Pencil, Info, Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isWizardAnamneseForm } from '@/lib/enduranceAnamneseQuestions';
import { isAnamneseCompletaForm } from '@/lib/anamneseCompletaQuestions';
import { isQuestionVisible } from '@/lib/anamneseConditions';
import { QuestionRenderer } from '@/components/anamnese-completa/QuestionRenderer';
import { validateSimpleMeal } from '@/components/anamnese-completa/SimpleMealField';
import { usePublicZnPlans } from '@/hooks/usePublicZnPlans';
import { firstMissing, isPhoneLike } from '@/lib/anamneseValidation';
import { PhoneDddInput } from '@/components/ui/phone-ddd-input';

interface Question {
  id: string;
  question_key?: string | null;
  section: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  scale_min: number;
  scale_max: number;
  is_required: boolean;
  order_index: number;
  has_comment_field: boolean;
  comment_field_label: string | null;
  comment_field_required: boolean;
  config?: Record<string, any> | null;
  conditional_logic?: { show_if?: any } | null;
}

interface Form {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  single_question_wizard?: boolean;
}

// A prova alvo já é perguntada na seção de Objetivos, então a pergunta de
// "Principais Competições / Eventos Alvo" na seção de treinos é redundante e fica oculta.
function isHiddenQuestion(q: Question): boolean {
  const t = (q.question_text || '').toLowerCase();
  return (
    t.includes('principais competições') ||
    t.includes('principais competicoes') ||
    t.includes('eventos alvo') ||
    ((t.includes('competição') || t.includes('competicao') || t.includes('competições') || t.includes('competicoes')) &&
      t.includes('alvo'))
  );
}

const PLAN_PARAM_MAP: Record<string, 'monthly' | 'semiannual' | 'annual'> = {
  mensal: 'monthly',
  monthly: 'monthly',
  semestral: 'semiannual',
  semiannual: 'semiannual',
  anual: 'annual',
  annual: 'annual',
};

const PLAN_INFO_FALLBACK: Record<'monthly' | 'semiannual' | 'annual', { label: string; price: string; sub: string }> = {
  monthly:    { label: 'Mensal',    price: 'R$ 69,90/mês',      sub: 'Cartão de crédito' },
  semiannual: { label: 'Semestral', price: 'R$ 299,00/semestre', sub: 'Cartão de crédito · à vista ou até 6x' },
  annual:     { label: 'Anual',     price: 'R$ 419,90/ano',      sub: 'Cartão de crédito · à vista ou até 12x' },
};

function isBlankAnswer(value: any): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0 || value.every(isBlankAnswer);
  if (typeof value === 'object') return Object.keys(value).length === 0 || Object.values(value).every(isBlankAnswer);
  return false;
}

export default function PublicAnamneseForm() {
  const { formId } = useParams<{ formId: string }>();

  // ZN Assessoria mode: ?zn=1&plano=mensal|semestral|anual
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const znMode = searchParams.get('zn') === '1';
  // Preços vêm da configuração (zn_plans); fallback local enquanto carrega.
  const { info: znPlanInfo } = usePublicZnPlans();
  const PLAN_INFO = {
    monthly: znPlanInfo('monthly', PLAN_INFO_FALLBACK.monthly),
    semiannual: znPlanInfo('semiannual', PLAN_INFO_FALLBACK.semiannual),
    annual: znPlanInfo('annual', PLAN_INFO_FALLBACK.annual),
  } as Record<'monthly' | 'semiannual' | 'annual', { label: string; price: string; sub: string }>;
  const planFromUrl = PLAN_PARAM_MAP[(searchParams.get('plano') || '').toLowerCase()] || '';
  const [znPlan, setZnPlan] = useState<'' | 'monthly' | 'semiannual' | 'annual'>(planFromUrl as any);
  const [znCpf, setZnCpf] = useState('');
  const [znCoupon, setZnCoupon] = useState((searchParams.get('cupom') || searchParams.get('ref') || '').trim());
  const [couponInfo, setCouponInfo] = useState<any>(null); // resultado da validação
  const [couponChecking, setCouponChecking] = useState(false);

  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [previousLoaded, setPreviousLoaded] = useState(false);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());

  const [athleteName, setAthleteName] = useState('');
  const [athleteEmail, setAthleteEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const isCompleta = isAnamneseCompletaForm(form);
  const answersByKey = useMemo(() => {
    const out: Record<string, any> = {};
    questions.forEach((q) => {
      out[q.question_key || q.id] = answers[q.id];
    });
    return out;
  }, [questions, answers]);
  const visibleQuestions = useMemo(
    () => isCompleta ? questions.filter((q) => isQuestionVisible(q as any, answersByKey)) : questions,
    [isCompleta, questions, answersByKey]
  );

  useEffect(() => {
    const fetchForm = async () => {
      if (!formId) return;

      try {
        const { data: formData, error: formError } = await supabase
          .from('anamnese_forms')
          .select('*')
          .eq('id', formId)
          .eq('is_active', true)
          .single();

        if (formError) throw formError;
        setForm(formData);

        const { data: questionsData, error: questionsError } = await supabase
          .from('anamnese_questions')
          .select('*')
          .eq('form_id', formId)
          .order('order_index', { ascending: true });

        if (questionsError) throw questionsError;
        const typedQuestions = (questionsData as Question[]).filter((q) => !isHiddenQuestion(q));
        setQuestions(typedQuestions);

        // Initialize answers and comments
        initializeEmptyAnswers(typedQuestions);
      } catch (error) {
        console.error('Error fetching form:', error);
        toast.error('Formulário não encontrado ou inativo');
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId]);

  const initializeEmptyAnswers = (qs: Question[]) => {
    const initialAnswers: Record<string, any> = {};
    const initialComments: Record<string, string> = {};
    qs.forEach((q) => {
      const type = resolveQuestionType(q);
      if (q.question_type === 'checkbox' || q.question_type === 'multiselect' || q.question_type === 'chips' || q.question_type === 'file_upload' || q.question_type === 'structured_list') {
        initialAnswers[q.id] = [];
      } else if (q.question_type === 'scale') {
        initialAnswers[q.id] = Math.floor((q.scale_min + q.scale_max) / 2);
      } else if (q.question_type === 'field_group' || q.question_type === 'symptom_grid' || q.question_type === 'frequency_grid') {
        initialAnswers[q.id] = {};
      } else if (type === 'meal_items') {
        initialAnswers[q.id] = { horario: '', itens: [['']], bebidas: '' };
      } else if (type === 'training_week') {
        const emptyDay = () => [{ modalidade: '', turno: '', intensidade: '', longao: false }];
        initialAnswers[q.id] = {
          Segunda: emptyDay(),
          Terça: emptyDay(),
          Quarta: emptyDay(),
          Quinta: emptyDay(),
          Sexta: emptyDay(),
          Sábado: emptyDay(),
          Domingo: emptyDay(),
        };
      } else if (q.question_type === 'symptom_scale') {
        const syms: string[] = Array.isArray(q.options) ? (q.options as string[]) : [];
        initialAnswers[q.id] = syms.reduce((acc, s) => { acc[s] = 0; return acc; }, {} as Record<string, number>);
      } else {
        initialAnswers[q.id] = '';
      }
      if (q.has_comment_field) {
        initialComments[q.id] = '';
      }
    });
    setAnswers(initialAnswers);
    setComments(initialComments);
  };

  // Load previous responses when email loses focus
  const handleEmailBlur = useCallback(async () => {
    if (!formId || !athleteEmail.trim() || previousLoaded) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(athleteEmail)) return;

    setLoadingPrevious(true);
    try {
      const { data, error } = await supabase.functions.invoke('load-anamnese-responses', {
        body: { form_id: formId, email: athleteEmail.trim() },
      });

      if (error) throw error;

      if (data?.found && data.response) {
        const prev = data.response;
        // Pre-fill name if available
        if (prev.respondent_name && !athleteName.trim()) {
          setAthleteName(prev.respondent_name);
        }

        // Merge previous responses non-destructively:
        // only fill fields the user hasn't typed/selected yet — never overwrite in-progress input.
        const prevResponses = (prev.responses || {}) as Record<string, any>;
        const isEmptyAnswer = (v: any) => {
          if (v === undefined || v === null) return true;
          if (Array.isArray(v)) return v.length === 0;
          if (typeof v === 'string') return v.trim() === '';
          return false;
        };

        setAnswers((current) => {
          const next = { ...current };
          questions.forEach((q) => {
            const prevResponse = prevResponses[q.id];
            if (prevResponse === undefined) return;
            const value =
              typeof prevResponse === 'object' && prevResponse?.answer !== undefined
                ? prevResponse.answer
                : prevResponse;
            // Only fill if user hasn't answered yet (and skip 'scale', which has a default mid value).
            if (q.question_type !== 'scale' && isEmptyAnswer(next[q.id])) {
              next[q.id] = value;
            }
          });
          return next;
        });

        setComments((current) => {
          const next = { ...current };
          questions.forEach((q) => {
            if (!q.has_comment_field) return;
            const prevResponse = prevResponses[q.id];
            const prevComment =
              typeof prevResponse === 'object' && prevResponse?.comment ? prevResponse.comment : null;
            if (prevComment && (!next[q.id] || !next[q.id].trim())) {
              next[q.id] = prevComment;
            }
          });
          return next;
        });

        setIsEditMode(true);
        setPreviousLoaded(true);
        toast.info('Respostas anteriores carregadas nos campos ainda em branco. Revise e envie.');
      }
    } catch (error) {
      console.error('Error loading previous responses:', error);
    } finally {
      setLoadingPrevious(false);
    }
  }, [formId, athleteEmail, athleteName, questions, previousLoaded]);

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setMissingIds(prev => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  };

  const handleCommentChange = (questionId: string, value: string) => {
    setComments(prev => ({ ...prev, [questionId]: value }));
  };

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      const updated = checked
        ? [...current, option]
        : current.filter((o: string) => o !== option);
      return { ...prev, [questionId]: updated };
    });
    setMissingIds(prev => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // No modo wizard não há tela de identificação: nome e e-mail vêm das
    // perguntas de Dados Pessoais.
    const wizard = isWizardAnamneseForm(form);
    // No wizard: nome/e-mail vêm das perguntas de Dados Pessoais. Se a pergunta
    // não existir no formulário, usamos fallbacks para não bloquear o envio.
    let effectiveName = wizard
      ? (findAnswerByText(/nome\s*completo/i) || findAnswerByText(/^nome/i) || findAnswerByText(/nome/i)).trim()
      : athleteName.trim();
    let effectiveEmail = wizard
      ? (findAnswerByText(/e-?mail/i) || findEmailAnywhere()).trim()
      : athleteEmail.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!effectiveEmail || !emailRegex.test(effectiveEmail)) {
      // Última tentativa: varre qualquer resposta de texto por um e-mail válido
      const fallback = findEmailAnywhere();
      if (fallback && emailRegex.test(fallback)) {
        effectiveEmail = fallback;
      } else {
        toast.error('Informe um e-mail válido no formulário');
        return;
      }
    }
    if (!effectiveName) {
      // Sem pergunta de nome: usa o prefixo do e-mail como identificação inicial.
      effectiveName = effectiveEmail.split('@')[0].replace(/[._-]+/g, ' ').trim() || 'Atleta';
    }

    if (!termsAccepted) {
      toast.error('Você precisa aceitar os Termos e Condições para enviar a anamnese');
      return;
    }

    const missing = new Set<string>();
    const missingLabels: string[] = [];
    for (const question of visibleQuestions) {
      let missLabel: string | null = firstMissing(question as any, answers[question.id], answersByKey);
      if (!missLabel && question.has_comment_field && question.comment_field_required) {
        const comment = comments[question.id];
        if (!comment || !comment.trim()) missLabel = question.comment_field_label || question.question_text;
      }
      if (missLabel) {
        missing.add(question.id);
        missingLabels.push(String(missLabel).replace(/[:?.\s]+$/, ''));
      }
    }

    if (missing.size > 0) {
      setMissingIds(missing);
      const firstId = Array.from(missing)[0];
      const el = document.getElementById(`q-${firstId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const preview = missingLabels.slice(0, 3).join(', ');
      const extra = missingLabels.length > 3 ? ` (+${missingLabels.length - 3})` : '';
      toast.error(
        missing.size === 1
          ? `Responda: ${preview}`
          : `${missing.size} perguntas pendentes: ${preview}${extra}`
      );
      return;
    }

    setMissingIds(new Set());

    setSubmitting(true);

    try {
      const responsesWithComments: Record<string, any> = {};
      questions.forEach((q) => {
        responsesWithComments[q.id] = {
          answer: answers[q.id],
          comment: q.has_comment_field ? comments[q.id] || null : null,
        };
      });

      if (znMode) {
        // Fluxo ZN Assessoria: valida plano + CPF, envia via zn-anamnese-submit
        // e redireciona para o link de pagamento Asaas.
        if (!znPlan) {
          toast.error('Selecione o plano da ZN Assessoria antes de enviar');
          setSubmitting(false);
          return;
        }
        const cpfDigits = znCpf.replace(/\D/g, '');
        if (cpfDigits.length !== 11) {
          toast.error('Informe um CPF válido (11 dígitos)');
          setSubmitting(false);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke('zn-anamnese-submit', {
          body: {
            form_id: formId,
            respondent_name: effectiveName,
            respondent_email: effectiveEmail.toLowerCase(),
            responses: responsesWithComments,
            plan_choice: znPlan,
            cpf: cpfDigits,
            phone: (findAnswerByText(/telefone|whatsapp/i) || '').replace(/\D/g, '') || null,
            coupon_code: couponInfo?.valid ? (couponInfo.code || znCoupon.trim()) : (znCoupon.trim() || null),
          },
        });

        if (fnError) throw fnError;
        if ((data as any)?.error === 'already_active') {
          toast.error((data as any).message || 'Já existe uma assinatura ativa para este e-mail.');
          setSubmitting(false);
          return;
        }
        if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);

        const paymentLink = (data as any)?.payment_link as string | null;
        if (paymentLink) {
          toast.success('Anamnese enviada! Redirecionando para o pagamento...');
          window.location.href = paymentLink;
          return;
        }
        // Sem link: apenas mostra tela de sucesso
        setSubmitted(true);
        toast.success('Anamnese enviada! Em breve você receberá o link de pagamento.');
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('process-anamnese-submission', {
        body: {
          form_id: formId,
          respondent_name: effectiveName,
          respondent_email: effectiveEmail.toLowerCase(),
          responses: responsesWithComments,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
      toast.success(isEditMode ? 'Respostas atualizadas com sucesso!' : 'Anamnese enviada com sucesso!');
    } catch (error: any) {
      console.error('Error submitting form:', error);
      const msg = error?.message || 'Erro ao enviar formulário. Tente novamente.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAgain = () => {
    setSubmitted(false);
    setIsEditMode(true);
  };

  // Resolve effective question type — falls back to text-pattern detection when
  // the DB still stores the old 'textarea'/'long_text' type for meal/training questions.
  const resolveQuestionType = (q: Question): string => {
    if (q.question_type === 'meal_items') return 'meal_items';
    if (q.question_type === 'training_week') return 'training_week';
    // Detect meal questions by section or question text
    const sectionLower = (q.section || '').toLowerCase();
    const textLower = (q.question_text || '').toLowerCase();
    const isMealSection =
      sectionLower.includes('come habitualmente') ||
      sectionLower.includes('rotina alimentar') ||
      sectionLower.includes('alimenta');
    const isMealQuestion =
      textLower.includes('horário e o que come') ||
      textLower.includes('horario e o que come') ||
      textLower.includes('café da manhã') ||
      textLower.includes('cafe da manha') ||
      textLower.includes('almoço') ||
      textLower.includes('almoco') ||
      textLower.includes('jantar') ||
      textLower.includes('lanche') ||
      textLower.includes('ceia');
    // Perguntas sobre alimentação DURANTE o treino/competição/prova são texto livre,
    // não o bloco estruturado de refeição habitual.
    const isDuringActivity =
      textLower.includes('durante') &&
      (textLower.includes('treino') || textLower.includes('competi') || textLower.includes('prova') || textLower.includes('atividade'));
    if (!isDuringActivity && (isMealSection || isMealQuestion) && (q.question_type === 'textarea' || q.question_type === 'long_text' || q.question_type === 'text')) {
      return 'meal_items';
    }
    // Detect training week by the specific frequency/modalities question (NOT the whole section)
    const isTrainingQuestion =
      textLower.includes('frequência semanal') ||
      textLower.includes('frequencia semanal') ||
      textLower.includes('modalidades por dia') ||
      textLower.includes('rotina de treino') ||
      textLower.includes('treino semanal') ||
      textLower.includes('semana de treino') ||
      (textLower.includes('modalidade') && textLower.includes('dia'));
    if (isTrainingQuestion && (q.question_type === 'textarea' || q.question_type === 'long_text' || q.question_type === 'text')) {
      return 'training_week';
    }
    return q.question_type;
  };

  // Group questions by section while preserving order_index order
  const orderedSections: string[] = [];
  const questionsBySection = visibleQuestions.reduce((acc, q) => {
    if (!acc[q.section]) {
      acc[q.section] = [];
      orderedSections.push(q.section);
    }
    acc[q.section].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

  // ── Modo wizard (1 pergunta por tela) ──────────────────────────────────────────
  const isWizard = isWizardAnamneseForm(form) || isCompleta;
  type WizStep =
    | { kind: 'plan' }
    | { kind: 'question'; question: Question; day?: string; mealIndex?: number; mealName?: string };
  const questionSteps: WizStep[] = isWizard
    ? visibleQuestions.flatMap<WizStep>((q) => {
        if (!isCompleta && resolveQuestionType(q) === 'training_week') {
          return DIAS_SEMANA.map((dia) => ({ kind: 'question', question: q, day: dia as string }));
        }
        // ANAMNESE COMPLETA: quebra o meal_plan_editor em 1 tela por refeição.
        if (isCompleta && q.question_type === 'meal_plan_editor') {
          const defaults: string[] = Array.isArray(q.config?.defaultMeals) ? q.config!.defaultMeals : [];
          if (defaults.length > 0) {
            return defaults.map((name, i) => ({
              kind: 'question' as const,
              question: q,
              mealIndex: i,
              mealName: name,
            }));
          }
        }
        return [{ kind: 'question', question: q }];
      })
    : [];
  // No modo ZN o plano/CPF ganha uma tela dedicada como 1º passo, para que as
  // perguntas seguintes apareçam sozinhas (com o plano minimizado no topo).
  const wizardSteps: WizStep[] = isWizard
    ? (znMode ? [{ kind: 'plan' } as WizStep, ...questionSteps] : questionSteps)
    : [];

  // No modo wizard não há tela de identificação: nome e e-mail vêm das
  // perguntas de "Dados Pessoais". Localiza essas perguntas para o envio.
  const findAnswerByText = (regex: RegExp): string => {
    const q = questions.find((qq) => regex.test(qq.question_text || ''));
    const val = q ? answers[q.id] : '';
    return typeof val === 'string' ? val : '';
  };
  // Fallback robusto: procura em todas as respostas texto uma string que se
  // pareça com e-mail (útil caso a pergunta não seja localizada pelo rótulo).
  const findEmailAnywhere = (): string => {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const v of Object.values(answers)) {
      if (typeof v === 'string' && emailRe.test(v.trim())) return v.trim();
    }
    return '';
  };
  const currentWizStep = wizardSteps[currentStepIndex];
  const wizProgress = wizardSteps.length > 0 ? ((currentStepIndex + 1) / wizardSteps.length) * 100 : 0;
  const isLastWizStep = currentStepIndex === wizardSteps.length - 1;

  useEffect(() => {
    if (wizardSteps.length > 0 && currentStepIndex >= wizardSteps.length) {
      setCurrentStepIndex(wizardSteps.length - 1);
    }
  }, [wizardSteps.length, currentStepIndex]);

  // Renderiza o widget de entrada de uma pergunta (usado no modo wizard).
  const renderWidget = (question: Question, dayOverride?: string, mealIndex?: number) => {
    if (isCompleta) {
      // Quando o wizard foca em uma refeição específica, injeta focusMealIndex
      // via config para o MealPlanEditorField mostrar somente aquela.
      const questionForRender =
        mealIndex !== undefined && question.question_type === 'meal_plan_editor'
          ? { ...question, config: { ...(question.config || {}), focusMealIndex: mealIndex } }
          : question;
      return (
        <QuestionRenderer
          question={questionForRender as any}
          value={answers[question.id]}
          onChange={(v) => handleAnswerChange(question.id, v)}
          answersByKey={answersByKey}
          clientId={null}
        />
      );
    }

    // WhatsApp/telefone: DDI + DDD + número.
    if (isPhoneLike(question.question_text, question.question_type, (question as any).question_key)) {
      return <PhoneDddInput value={typeof answers[question.id] === 'string' ? answers[question.id] : ''} onChange={(v) => handleAnswerChange(question.id, v)} />;
    }
    const qType = resolveQuestionType(question);
    switch (qType) {
      case 'info': {
        const body = (question as any).config?.body || '';
        return (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {body || 'Leia as orientações e clique em Vamos lá para continuar.'}
          </div>
        );
      }
      case 'short_text':
      case 'text':
        return (
          <Input value={answers[question.id] || ''} onChange={(e) => handleAnswerChange(question.id, e.target.value)} placeholder="Sua resposta..." />
        );
      case 'long_text':
      case 'textarea':
        return (
          <Textarea value={answers[question.id] || ''} onChange={(e) => handleAnswerChange(question.id, e.target.value)} placeholder="Sua resposta..." rows={4} />
        );
      case 'number':
        return (
          <Input type="number" value={answers[question.id] || ''} onChange={(e) => handleAnswerChange(question.id, e.target.value)} placeholder="Digite um número..." />
        );
      case 'date':
        return (
          <Input type="date" value={answers[question.id] || ''} onChange={(e) => handleAnswerChange(question.id, e.target.value)} />
        );
      case 'boolean':
        return (
          <RadioGroup value={answers[question.id] || ''} onValueChange={(v) => handleAnswerChange(question.id, v)}>
            {['Sim', 'Não'].map((option, i) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'select':
      case 'multiple_choice':
        return question.options ? (
          <RadioGroup value={answers[question.id] || ''} onValueChange={(v) => handleAnswerChange(question.id, v)}>
            {(question.options as string[]).map((o) => (o ?? '').trim()).filter(Boolean).map((option, i) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">{option}</Label>
              </div>
            ))}
          </RadioGroup>
        ) : null;
      case 'multiselect':
      case 'checkbox':
        return question.options ? (
          <div className="space-y-2">
            {(question.options as string[]).map((o) => (o ?? '').trim()).filter(Boolean).map((option, i) => (
              <div key={i} className="flex items-center space-x-2">
                <Checkbox id={`${question.id}-${i}`} checked={(answers[question.id] || []).includes(option)} onCheckedChange={(c) => handleCheckboxChange(question.id, option, c as boolean)} />
                <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">{option}</Label>
              </div>
            ))}
          </div>
        ) : null;
      case 'scale':
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{question.scale_min}</span>
              <span className="font-medium text-foreground">{answers[question.id]}</span>
              <span>{question.scale_max}</span>
            </div>
            <Slider value={[answers[question.id] ?? question.scale_min]} onValueChange={([v]) => handleAnswerChange(question.id, v)} min={question.scale_min} max={question.scale_max} step={1} className="w-full" />
          </div>
        );
      case 'meal_items':
        return (
          <MealItemsRenderer value={answers[question.id] || { horario: '', itens: [['']], bebidas: '' }} onChange={(v) => handleAnswerChange(question.id, v)} />
        );
      case 'training_week':
        return (
          <TrainingDayRenderer dia={dayOverride || DIAS_SEMANA[0]} value={answers[question.id] || {}} onChange={(v) => handleAnswerChange(question.id, v)} />
        );
      case 'symptom_scale':
        return (
          <SymptomScaleRenderer symptoms={Array.isArray(question.options) ? (question.options as string[]) : []} value={answers[question.id] || {}} onChange={(v) => handleAnswerChange(question.id, v)} />
        );
      default:
        return (
          <Input value={answers[question.id] || ''} onChange={(e) => handleAnswerChange(question.id, e.target.value)} placeholder="Sua resposta..." />
        );
    }
  };

  const validateWizQuestion = (question: Question): boolean => {
    const miss = firstMissing(question as any, answers[question.id], answersByKey);
    if (miss) {
      toast.error(`Responda: ${String(miss).replace(/[:?.\s]+$/, '')}`);
      return false;
    }
    if (question.has_comment_field && question.comment_field_required) {
      const comment = comments[question.id];
      if (!comment || !comment.trim()) {
        toast.error(`Preencha: ${question.comment_field_label}`);
        return false;
      }
    }
    return true;
  };

  const validateWizStep = (step: WizStep): boolean => {
    if (!step || step.kind !== 'question') return true;
    // training_week ocupa vários passos: só valida no último dia.
    const isLastDay = step.day === undefined || step.day === DIAS_SEMANA[DIAS_SEMANA.length - 1];
    // meal_plan_editor também é dividido em várias telas (uma por refeição).
    if (step.mealIndex !== undefined) {
      const cfg = step.question.config || {};
      const defaults: string[] = Array.isArray(cfg.defaultMeals) ? cfg.defaultMeals : [];
      const mealName = defaults[step.mealIndex] || step.mealName || 'refeição';
      // No modo simples validamos a refeição CORRENTE em cada passo (obrigatório).
      if (cfg.simpleMode && step.question.is_required) {
        const arr = answers[step.question.id];
        const meal = Array.isArray(arr) ? arr[step.mealIndex] : null;
        const err = validateSimpleMeal(meal, mealName);
        if (err) { toast.error(err); return false; }
        return true;
      }
      // Modo antigo: valida apenas no último passo do bloco.
      const isLastMeal = defaults.length === 0 || step.mealIndex === defaults.length - 1;
      if (isLastMeal) return validateWizQuestion(step.question);
      return true;
    }
    if (isLastDay) return validateWizQuestion(step.question);
    return true;
  };

  const validateCoupon = async () => {
    const code = znCoupon.trim();
    if (!code) { setCouponInfo(null); return; }
    if (!znPlan) { toast.error('Selecione o plano antes de aplicar o cupom'); return; }
    setCouponChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('zn-validate-coupon', {
        body: { code, plan_choice: znPlan },
      });
      if (error) throw error;
      setCouponInfo(data);
      if ((data as any)?.valid) toast.success((data as any).message || 'Cupom aplicado!');
      else toast.error((data as any)?.message || 'Cupom inválido');
    } catch (e: any) {
      setCouponInfo({ valid: false, message: 'Erro ao validar cupom' });
      toast.error('Erro ao validar cupom');
    } finally {
      setCouponChecking(false);
    }
  };

  const handleWizNext = () => {
    if (currentWizStep?.kind === 'plan') {
      if (!znPlan) {
        toast.error('Selecione o plano da ZN Assessoria para continuar');
        return;
      }
      if (znCpf.replace(/\D/g, '').length !== 11) {
        toast.error('Informe um CPF válido (11 dígitos)');
        return;
      }
      if (currentStepIndex < wizardSteps.length - 1) {
        setCurrentStepIndex((p) => p + 1);
        window.scrollTo(0, 0);
      }
      return;
    }
    if (!validateWizStep(currentWizStep)) return;
    if (currentStepIndex < wizardSteps.length - 1) {
      setCurrentStepIndex((p) => p + 1);
      window.scrollTo(0, 0);
    }
  };
  const handleWizPrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((p) => p - 1);
      window.scrollTo(0, 0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <PersonStanding className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Formulário não encontrado</h1>
        <p className="text-muted-foreground text-center">
          Este formulário pode estar inativo ou não existe mais.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-full bg-green-500/10 p-4 w-fit mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {isEditMode ? 'Respostas Atualizadas!' : 'Anamnese Enviada!'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {isEditMode
              ? 'Suas respostas foram atualizadas com sucesso. Seu assessor será notificado das alterações.'
              : 'Suas respostas foram registradas com sucesso. Seu assessor receberá uma notificação.'}
          </p>
          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={handleEditAgain} className="gap-2">
              <Pencil className="h-4 w-4" />
              Editar respostas
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.close()}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Renderização em modo wizard (1 pergunta por tela) ──────────────────────────
  if (isWizard && wizardSteps.length > 0) {
    const step = currentWizStep;
    return (
      <div className="min-h-screen bg-background py-8 px-4 pb-28">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <img src={logoRF} alt="Rogers Feitosa" className="h-12 w-12 rounded-xl object-cover" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Rogers Feitosa</h1>
              <p className="text-sm text-muted-foreground">Nutrição & Treinamento</p>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-bold text-foreground">{form.title}</h2>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Etapa {currentStepIndex + 1} de {wizardSteps.length}</span>
              <span>{Math.round(wizProgress)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${wizProgress}%` }} />
            </div>
          </div>

          {isEditMode && (
            <Alert className="mb-6 border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Suas respostas anteriores foram carregadas. Edite o que precisar e envie no final.
              </AlertDescription>
            </Alert>
          )}

          {/* Tela dedicada de plano + CPF (1º passo no modo ZN) */}
          {znMode && step.kind === 'plan' && (
            <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
              <CardHeader>
                <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-1">
                  ZN Assessoria Nutricional
                </p>
                <CardTitle className="text-lg">Seu plano e CPF</CardTitle>
                <CardDescription>
                  Ao final da anamnese você será direcionado para o pagamento seguro via Asaas (cartão de crédito, à vista ou parcelado).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm after:content-['*'] after:ml-0.5 after:text-red-500">Plano escolhido</Label>
                  <RadioGroup
                    value={znPlan}
                    onValueChange={(v) => setZnPlan(v as any)}
                    className="mt-2 grid gap-2"
                  >
                    {(['monthly', 'semiannual', 'annual'] as const).map((code) => (
                      <label
                        key={code}
                        htmlFor={`zn-plan-${code}`}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition',
                          znPlan === code ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:border-amber-500/50'
                        )}
                      >
                        <RadioGroupItem id={`zn-plan-${code}`} value={code} />
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{PLAN_INFO[code].label}</div>
                          <div className="text-xs text-muted-foreground">{PLAN_INFO[code].sub}</div>
                        </div>
                        <div className="text-sm font-bold text-amber-600">{PLAN_INFO[code].price}</div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div>
                  <Label htmlFor="zn-cpf-top" className="text-sm after:content-['*'] after:ml-0.5 after:text-red-500">
                    CPF (para emissão da cobrança)
                  </Label>
                  <Input
                    id="zn-cpf-top"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={znCpf}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                      const masked = digits
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d)/, '$1-$2');
                      setZnCpf(masked);
                    }}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="zn-coupon" className="text-sm">Cupom de desconto (opcional)</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="zn-coupon"
                      placeholder="Ex.: ANA20"
                      value={znCoupon}
                      onChange={(e) => { setZnCoupon(e.target.value.toUpperCase()); setCouponInfo(null); }}
                      className="uppercase"
                    />
                    <Button type="button" variant="outline" onClick={validateCoupon} disabled={couponChecking || !znCoupon.trim()}>
                      {couponChecking ? '...' : 'Aplicar'}
                    </Button>
                  </div>
                  {couponInfo && (
                    <p className={cn('text-xs mt-1', couponInfo.valid ? 'text-green-600' : 'text-destructive')}>
                      {couponInfo.valid ? `✓ ${couponInfo.label}` : couponInfo.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Faixa minimizada do plano nas telas de pergunta */}
          {znMode && step.kind === 'question' && znPlan && (
            <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      Plano {PLAN_INFO[znPlan as 'monthly'].label} · {PLAN_INFO[znPlan as 'monthly'].price}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">CPF {znCpf || '—'}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStepIndex(0)}
                    className="text-amber-700 hover:text-amber-800 gap-1"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Alterar
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}

          {step.kind === 'question' && (
            <Card className="mb-6" key={`${step.question.id}-${step.day || ''}-${step.mealIndex ?? ''}`}>
              <CardHeader>
                <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                  {step.question.section?.replace(/_/g, ' ')}
                  {step.day ? ` — ${step.day}` : ''}
                  {step.mealName ? ` — ${step.mealName}` : ''}
                </p>
                <CardTitle className={cn('text-lg', step.question.is_required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
                  {step.mealName ? step.mealName : step.question.question_text}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderWidget(step.question, step.day, step.mealIndex)}
                {step.question.has_comment_field && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <Label htmlFor={`wiz-comment-${step.question.id}`} className={cn('text-sm text-muted-foreground', step.question.comment_field_required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
                      {step.question.comment_field_label || 'Comentário'}
                    </Label>
                    <Textarea id={`wiz-comment-${step.question.id}`} value={comments[step.question.id] || ''} onChange={(e) => handleCommentChange(step.question.id, e.target.value)} placeholder="Seu comentário..." rows={2} className="mt-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isLastWizStep && (
            <Card className="mb-6 border-primary/30">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox id="wiz-terms" checked={termsAccepted} onCheckedChange={(c) => setTermsAccepted(c as boolean)} className="mt-1" />
                  <Label htmlFor="wiz-terms" className="font-normal cursor-pointer leading-relaxed">
                    Li e aceito os{' '}
                    <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">Termos e Condições de Serviço</a>{' '}
                    do acompanhamento nutricional. <span className="text-red-500">*</span>
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            {currentStepIndex > 0 && (
              <Button type="button" variant="outline" onClick={handleWizPrevious} className="flex-1">Anterior</Button>
            )}
            {!isLastWizStep ? (
              <Button type="button" onClick={handleWizNext} className="flex-1">Próximo</Button>
            ) : (
              <Button type="button" onClick={(e) => handleSubmit(e as any)} disabled={submitting || !termsAccepted} className="flex-1 gap-2">
                {submitting ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />{isEditMode ? 'Atualizando...' : 'Enviando...'}</>
                ) : (
                  <><Send className="h-4 w-4" />{isEditMode ? 'Atualizar Anamnese' : 'Enviar Anamnese'}</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <img src={logoRF} alt="Rogers Feitosa" className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Rogers Feitosa</h1>
            <p className="text-sm text-muted-foreground">Nutrição & Treinamento</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Form Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{form.title}</CardTitle>
              {form.description && (
                <CardDescription>{form.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu Nome *</Label>
                <Input
                  id="name"
                  value={athleteName}
                  onChange={(e) => setAthleteName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Seu Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={athleteEmail}
                  onChange={(e) => setAthleteEmail(e.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder="Use o email cadastrado pelo seu assessor"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Informe seu melhor email para contato
                </p>
                {loadingPrevious && (
                  <p className="text-xs text-primary animate-pulse">Verificando respostas anteriores...</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Edit mode banner */}
          {isEditMode && (
            <Alert className="mb-6 border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Suas respostas anteriores foram carregadas. Edite o que precisar e clique em <strong>"Atualizar Anamnese"</strong> para salvar.
              </AlertDescription>
            </Alert>
          )}

          {/* Questions by Section */}
          {orderedSections.map((section) => (
            <Card key={section} className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg capitalize">{section.replace(/_/g, ' ')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {questionsBySection[section].map((question, index) => {
                  const qType = resolveQuestionType(question);
                  const isMissing = missingIds.has(question.id);
                  return (
                  <div
                    key={question.id}
                    id={`q-${question.id}`}
                    className={cn(
                      "space-y-4 rounded-md transition-colors",
                      isMissing && "ring-2 ring-destructive/60 bg-destructive/5 p-3 -m-3"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground font-medium">{index + 1}.</span>
                      <div className="flex-1">
                        <Label className={cn(question.is_required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
                          {question.question_text}
                        </Label>
                        {isMissing && (
                          <p className="text-xs text-destructive mt-1">Esta pergunta é obrigatória.</p>
                        )}
                      </div>
                    </div>

                    {isPhoneLike(question.question_text, question.question_type, question.question_key) ? (
                      <PhoneDddInput
                        value={typeof answers[question.id] === 'string' ? answers[question.id] : ''}
                        onChange={(v) => handleAnswerChange(question.id, v)}
                      />
                    ) : (qType === 'short_text' || qType === 'text') && (
                      <Input
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Sua resposta..."
                      />
                    )}

                    {(qType === 'long_text' || qType === 'textarea') && (
                      <Textarea
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Sua resposta..."
                        rows={4}
                      />
                    )}

                    {qType === 'select' && question.options && (
                      <RadioGroup
                        value={answers[question.id] || undefined}
                        onValueChange={(value) => handleAnswerChange(question.id, value)}
                      >
                        {(question.options as string[])
                          .map((o) => (o ?? '').trim())
                          .filter(Boolean)
                          .map((option, i) => (
                            <div key={i} className="flex items-center space-x-2">
                              <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                              <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">
                                {option}
                              </Label>
                            </div>
                          ))}
                      </RadioGroup>
                    )}

                    {qType === 'multiselect' && question.options && (
                      <div className="space-y-2">
                        {(question.options as string[]).map((o) => (o ?? '').trim()).filter(Boolean).map((option, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${question.id}-${i}`}
                              checked={(answers[question.id] || []).includes(option)}
                              onCheckedChange={(checked) => handleCheckboxChange(question.id, option, checked as boolean)}
                            />
                            <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}

                    {qType === 'multiple_choice' && question.options && (
                      <RadioGroup
                        value={answers[question.id] || undefined}
                        onValueChange={(value) => handleAnswerChange(question.id, value)}
                      >
                        {(question.options as string[]).map((o) => (o ?? '').trim()).filter(Boolean).map((option, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                            <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {qType === 'checkbox' && question.options && (
                      <div className="space-y-2">
                        {(question.options as string[]).map((o) => (o ?? '').trim()).filter(Boolean).map((option, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${question.id}-${i}`}
                              checked={(answers[question.id] || []).includes(option)}
                              onCheckedChange={(checked) => handleCheckboxChange(question.id, option, checked as boolean)}
                            />
                            <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}

                    {qType === 'scale' && (
                      <div className="space-y-4">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{question.scale_min}</span>
                          <span className="font-medium text-foreground">{answers[question.id]}</span>
                          <span>{question.scale_max}</span>
                        </div>
                        <Slider
                          value={[answers[question.id] || question.scale_min]}
                          onValueChange={([value]) => handleAnswerChange(question.id, value)}
                          min={question.scale_min}
                          max={question.scale_max}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    )}

                    {qType === 'meal_items' && (
                      <MealItemsRenderer
                        value={answers[question.id] || { horario: '', itens: [['']], bebidas: '' }}
                        onChange={(v) => handleAnswerChange(question.id, v)}
                      />
                    )}

                    {qType === 'training_week' && (
                      <TrainingWeekRenderer
                        value={answers[question.id] || {}}
                        onChange={(v) => handleAnswerChange(question.id, v)}
                      />
                    )}

                    {qType === 'boolean' && (
                      <RadioGroup
                        value={answers[question.id] || undefined}
                        onValueChange={(value) => handleAnswerChange(question.id, value)}
                      >
                        {['Sim', 'Não'].map((option, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                            <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">{option}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {qType === 'symptom_scale' && (
                      <SymptomScaleRenderer
                        symptoms={Array.isArray(question.options) ? (question.options as string[]) : []}
                        value={answers[question.id] || {}}
                        onChange={(v) => handleAnswerChange(question.id, v)}
                      />
                    )}

                    {question.has_comment_field && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <Label
                          htmlFor={`comment-${question.id}`}
                          className={cn(
                            "text-sm text-muted-foreground",
                            question.comment_field_required && "after:content-['*'] after:ml-0.5 after:text-red-500"
                          )}
                        >
                          {question.comment_field_label || 'Comentário'}
                        </Label>
                        <Textarea
                          id={`comment-${question.id}`}
                          value={comments[question.id] || ''}
                          onChange={(e) => handleCommentChange(question.id, e.target.value)}
                          placeholder="Seu comentário..."
                          rows={2}
                          className="mt-2"
                        />
                      </div>
                    )}
                  </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          {/* Terms acceptance */}
          <Card className="mb-6 border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms-accept"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-1"
                />
                <Label htmlFor="terms-accept" className="font-normal cursor-pointer leading-relaxed">
                  Li e aceito os{' '}
                  <a
                    href="/termos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline font-medium"
                  >
                    Termos e Condições de Serviço
                  </a>{' '}
                  do acompanhamento nutricional. <span className="text-red-500">*</span>
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="mt-8">
            <Button type="submit" className="w-full gap-2" disabled={submitting || !termsAccepted}>
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                  {isEditMode ? 'Atualizando...' : 'Enviando...'}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {isEditMode ? 'Atualizar Anamnese' : 'Enviar Anamnese'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Symptom Scale Renderer ─────────────────────────────────────────────────────
// Cada sintoma é avaliado por frequência de 0 (nunca) a 5 (muito frequente).
function SymptomScaleRenderer({
  symptoms,
  value,
  onChange,
}: {
  symptoms: string[];
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  return (
    <div className="space-y-4">
      {symptoms.map((symptom) => {
        const current = typeof value?.[symptom] === 'number' ? value[symptom] : 0;
        return (
          <div key={symptom} className="rounded-lg border p-3 bg-muted/30 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{symptom}</span>
              <span className="text-sm font-bold text-primary">{current}</span>
            </div>
            <Slider
              value={[current]}
              onValueChange={([v]) => onChange({ ...value, [symptom]: v })}
              min={0}
              max={5}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 · nunca</span>
              <span>5 · muito frequente</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Meal Items Renderer ────────────────────────────────────────────────────────
// Cada alimento é um "slot" com uma ou mais opções/substituições (ex: pão OU tapioca OU cuscuz).
// Estrutura: itens = string[][]  (lista de slots, cada slot = lista de opções).
// Normaliza o formato antigo (string[]) automaticamente.
function normalizeItens(itens: any): string[][] {
  if (!Array.isArray(itens) || itens.length === 0) return [['']];
  return itens.map((slot) => {
    if (Array.isArray(slot)) return slot.length ? slot : [''];
    return [typeof slot === 'string' ? slot : ''];
  });
}

function MealItemsRenderer({
  value,
  onChange,
}: {
  value: { horario: string; itens: any; bebidas: string };
  onChange: (v: any) => void;
}) {
  const itens = normalizeItens(value.itens);

  const setField = (field: string, v: string) => onChange({ ...value, [field]: v });
  const update = (next: string[][]) => onChange({ ...value, itens: next });

  const setOption = (si: number, oi: number, v: string) => {
    const next = itens.map((slot, i) => (i === si ? slot.map((o, j) => (j === oi ? v : o)) : slot));
    update(next);
  };
  const addOption = (si: number) => update(itens.map((slot, i) => (i === si ? [...slot, ''] : slot)));
  const removeOption = (si: number, oi: number) => {
    const next = itens.map((slot, i) => (i === si ? slot.filter((_, j) => j !== oi) : slot));
    update(next.map((slot) => (slot.length ? slot : [''])));
  };
  const addItem = () => update([...itens, ['']]);
  const removeItem = (si: number) => {
    if (itens.length <= 1) return;
    update(itens.filter((_, i) => i !== si));
  };

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
      <div className="space-y-1">
        <Label className="text-xs font-medium flex items-center gap-1">🕐 Horário habitual</Label>
        <Input type="time" value={value.horario || ''} onChange={(e) => setField('horario', e.target.value)} className="w-36" />
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-medium">Alimentos e porções</Label>
        {itens.map((slot, si) => (
          <div key={si} className="rounded-md border bg-background/60 p-2 space-y-1.5">
            {slot.map((option, oi) => (
              <div key={oi} className="flex items-center gap-2">
                {oi > 0 && <span className="text-xs text-muted-foreground font-medium shrink-0 w-7 text-center">ou</span>}
                <Input
                  value={option}
                  onChange={(e) => setOption(si, oi, e.target.value)}
                  placeholder={oi === 0 ? 'Ex: Pão francês – 2 fatias' : 'Substituição. Ex: Tapioca – 1 unidade'}
                  className={oi > 0 ? 'flex-1' : ''}
                />
                {oi > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(si, oi)} className="h-9 w-9 p-0 shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(si)} disabled={itens.length <= 1} className="h-9 w-9 p-0 shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => addOption(si)} className="gap-1 px-2 h-7 text-xs text-muted-foreground">
              <Plus className="h-3 w-3" /> ou (substituição)
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Cada linha é um alimento. Use "ou (substituição)" para registrar variações que você costuma comer (ex: pão ou tapioca ou cuscuz). Use medidas caseiras: colher, fatia, copo, unidade, gramas…
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={addItem} className="gap-1 px-2">
          <Plus className="h-4 w-4" /> Adicionar alimento
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium">Bebidas e quantidades</Label>
        <Input value={value.bebidas || ''} onChange={(e) => setField('bebidas', e.target.value)} placeholder="Ex: 1 copo de suco de laranja, 200ml de café…" />
      </div>
    </div>
  );
}

// ── Training Week Renderer ─────────────────────────────────────────────────────
const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;
const MODALIDADES_OPT = [
  { value: 'repouso', label: '😴 Repouso' },
  { value: 'corrida', label: '🏃 Corrida' },
  { value: 'ciclismo', label: '🚴 Ciclismo' },
  { value: 'natacao', label: '🏊 Natação' },
  { value: 'musculacao', label: '🏋️ Musculação' },
  { value: 'funcional', label: '⚡ Funcional' },
  { value: 'triathlon', label: '🏅 Triathlon' },
  { value: 'outro', label: '🎯 Outro' },
];
const TURNOS_OPT = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
];
const INTENSIDADES_OPT = [
  { value: 'leve', label: '🟢 Leve' },
  { value: 'moderado', label: '🟡 Moderado' },
  { value: 'intenso', label: '🔴 Intenso' },
];

// Modalidades de endurance onde faz sentido marcar "longão" (sessão longa)
const ENDURANCE_MODALIDADES = ['corrida', 'ciclismo', 'natacao', 'triathlon'];

const emptyTrainingSession = () => ({ modalidade: '', turno: '', intensidade: '', longao: false });

// Renderiza o treino de UM único dia (usado no modo wizard, 1 dia por tela).
function TrainingDayRenderer({ dia, value, onChange }: { dia: string; value: any; onChange: (v: any) => void }) {
  const getSessions = (): any[] => {
    const v = value?.[dia];
    if (Array.isArray(v)) return v.length ? v : [emptyTrainingSession()];
    if (v && typeof v === 'object' && 'modalidade' in v) return [v];
    return [emptyTrainingSession()];
  };
  const setSessions = (sessions: any[]) => onChange({ ...value, [dia]: sessions });
  const setField = (idx: number, field: string, v: string) => {
    const sessions = getSessions().map((s, i) => (i === idx ? { ...s, [field]: v } : s));
    if (field === 'modalidade') {
      if (v === 'repouso') sessions[idx] = { modalidade: 'repouso', turno: '', intensidade: '', longao: false };
      else if (!ENDURANCE_MODALIDADES.includes(v)) sessions[idx] = { ...sessions[idx], longao: false };
    }
    setSessions(sessions);
  };
  const toggleLongao = (idx: number, checked: boolean) =>
    setSessions(getSessions().map((s, i) => (i === idx ? { ...s, longao: checked } : s)));
  const addSession = () => setSessions([...getSessions(), emptyTrainingSession()]);
  const removeSession = (idx: number) => {
    const sessions = getSessions();
    if (sessions.length <= 1) return;
    setSessions(sessions.filter((_, i) => i !== idx));
  };

  const sessions = getSessions();
  return (
    <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{dia}</p>
      {sessions.map((session, idx) => {
        const isRepouso = session.modalidade === 'repouso';
        const showLongao = ENDURANCE_MODALIDADES.includes(session.modalidade);
        return (
          <div key={idx} className={cn('space-y-2', isRepouso && 'opacity-60', idx > 0 && 'pt-3 border-t border-dashed')}>
            <div className="flex items-start gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                <Select value={session.modalidade} onValueChange={(v) => setField(idx, 'modalidade', v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Modalidade…" /></SelectTrigger>
                  <SelectContent>{MODALIDADES_OPT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input
                  type="time"
                  value={session.hora || ''}
                  onChange={(e) => setField(idx, 'hora', e.target.value)}
                  disabled={isRepouso || !session.modalidade}
                  className="h-9 text-sm"
                  placeholder="Hora"
                />

                <Select value={session.intensidade} onValueChange={(v) => setField(idx, 'intensidade', v)} disabled={isRepouso || !session.modalidade}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Intensidade…" /></SelectTrigger>
                  <SelectContent>{INTENSIDADES_OPT.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {sessions.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeSession(idx)} className="h-9 w-9 p-0 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {showLongao && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={!!session.longao} onChange={(e) => toggleLongao(idx, e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
                <span className="text-sm text-muted-foreground">🐢 É o <strong>longão</strong> da semana<span className="text-xs ml-1">(volume longo / resistência)</span></span>
              </label>
            )}
          </div>
        );
      })}
      <Button type="button" variant="ghost" size="sm" onClick={addSession} className="gap-1 px-2 h-8 text-xs">
        <Plus className="h-3.5 w-3.5" /> Adicionar modalidade neste dia
      </Button>
    </div>
  );
}

function TrainingWeekRenderer({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  // Normalize a day to an array of sessions (supports legacy single-object shape)
  const getSessions = (dia: string): any[] => {
    const v = value[dia];
    if (Array.isArray(v)) return v.length ? v : [emptyTrainingSession()];
    if (v && typeof v === 'object' && 'modalidade' in v) return [v];
    return [emptyTrainingSession()];
  };

  const setSessions = (dia: string, sessions: any[]) => onChange({ ...value, [dia]: sessions });

  const setField = (dia: string, idx: number, field: string, v: string) => {
    const sessions = getSessions(dia).map((s, i) => (i === idx ? { ...s, [field]: v } : s));
    if (field === 'modalidade') {
      if (v === 'repouso') {
        sessions[idx] = { modalidade: 'repouso', turno: '', intensidade: '', longao: false };
      } else if (!ENDURANCE_MODALIDADES.includes(v)) {
        sessions[idx] = { ...sessions[idx], longao: false };
      }
    }
    setSessions(dia, sessions);
  };

  const toggleLongao = (dia: string, idx: number, checked: boolean) => {
    setSessions(dia, getSessions(dia).map((s, i) => (i === idx ? { ...s, longao: checked } : s)));
  };

  const addSession = (dia: string) => setSessions(dia, [...getSessions(dia), emptyTrainingSession()]);
  const removeSession = (dia: string, idx: number) => {
    const sessions = getSessions(dia);
    if (sessions.length <= 1) return;
    setSessions(dia, sessions.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {DIAS_SEMANA.map((dia) => {
        const sessions = getSessions(dia);
        return (
          <div key={dia} className="rounded-lg border p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dia}</p>

            {sessions.map((session, idx) => {
              const isRepouso = session.modalidade === 'repouso';
              const showLongao = ENDURANCE_MODALIDADES.includes(session.modalidade);
              return (
                <div key={idx} className={`space-y-2 ${isRepouso ? 'opacity-60' : ''} ${idx > 0 ? 'pt-3 border-t border-dashed' : ''}`}>
                  <div className="flex items-start gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                      <Select value={session.modalidade} onValueChange={(v) => setField(dia, idx, 'modalidade', v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Modalidade…" /></SelectTrigger>
                        <SelectContent>{MODALIDADES_OPT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input
                        type="time"
                        value={session.hora || ''}
                        onChange={(e) => setField(dia, idx, 'hora', e.target.value)}
                        disabled={isRepouso || !session.modalidade}
                        className="h-9 text-sm"
                        placeholder="Hora"
                      />

                      <Select value={session.intensidade} onValueChange={(v) => setField(dia, idx, 'intensidade', v)} disabled={isRepouso || !session.modalidade}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Intensidade…" /></SelectTrigger>
                        <SelectContent>{INTENSIDADES_OPT.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {sessions.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSession(dia, idx)} className="h-9 w-9 p-0 shrink-0">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {showLongao && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!session.longao}
                        onChange={(e) => toggleLongao(dia, idx, e.target.checked)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span className="text-sm text-muted-foreground">
                        🐢 É o <strong>longão</strong> da semana
                        <span className="text-xs ml-1">(volume longo / sessão de resistência)</span>
                      </span>
                    </label>
                  )}
                </div>
              );
            })}

            <Button type="button" variant="ghost" size="sm" onClick={() => addSession(dia)} className="gap-1 px-2 h-8 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar modalidade neste dia
            </Button>
          </div>
        );
      })}
    </div>
  );
}
