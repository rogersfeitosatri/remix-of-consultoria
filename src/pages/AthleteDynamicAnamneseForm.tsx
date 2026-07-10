import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAthleteClient } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PersonStanding, ArrowLeft, ArrowRight, Check, Loader2, Send, LogOut, Plus, X } from 'lucide-react';
import rogersProfile from '@/assets/rogers-profile.jpg';

// ── Constantes de treino (espelham PublicAnamneseForm) ──────────────────────────
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
const ENDURANCE_MODALIDADES = ['corrida', 'ciclismo', 'natacao', 'triathlon'];
const emptyTrainingSession = () => ({ modalidade: '', turno: '', intensidade: '', longao: false });

function normalizeItens(itens: any): string[][] {
  if (!Array.isArray(itens) || itens.length === 0) return [['']];
  return itens.map((slot) => {
    if (Array.isArray(slot)) return slot.length ? slot : [''];
    return [typeof slot === 'string' ? slot : ''];
  });
}

// ── Renderer: refeição habitual (dark) ──────────────────────────────────────────
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
  const setOption = (si: number, oi: number, v: string) =>
    update(itens.map((slot, i) => (i === si ? slot.map((o, j) => (j === oi ? v : o)) : slot)));
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
    <div className="space-y-4 rounded-lg border border-gray-700 p-4 bg-gray-800/40">
      <div className="space-y-1">
        <Label className="text-xs font-medium flex items-center gap-1 text-gray-300">🕐 Horário habitual</Label>
        <Input type="time" value={value.horario || ''} onChange={(e) => setField('horario', e.target.value)} className="w-36 bg-gray-800 border-gray-700 text-white" />
      </div>
      <div className="space-y-3">
        <Label className="text-xs font-medium text-gray-300">Alimentos e porções</Label>
        {itens.map((slot, si) => (
          <div key={si} className="rounded-md border border-gray-700 bg-gray-900/60 p-2 space-y-1.5">
            {slot.map((option, oi) => (
              <div key={oi} className="flex items-center gap-2">
                {oi > 0 && <span className="text-xs text-gray-500 font-medium shrink-0 w-7 text-center">ou</span>}
                <Input
                  value={option}
                  onChange={(e) => setOption(si, oi, e.target.value)}
                  placeholder={oi === 0 ? 'Ex: Pão francês – 2 fatias' : 'Substituição. Ex: Tapioca – 1 unidade'}
                  className={cn('bg-gray-800 border-gray-700 text-white', oi > 0 && 'flex-1')}
                />
                {oi > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(si, oi)} className="h-9 w-9 p-0 shrink-0 text-gray-400 hover:bg-gray-700">
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(si)} disabled={itens.length <= 1} className="h-9 w-9 p-0 shrink-0 text-gray-400 hover:bg-gray-700">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => addOption(si)} className="gap-1 px-2 h-7 text-xs text-gray-400 hover:bg-gray-700">
              <Plus className="h-3 w-3" /> ou (substituição)
            </Button>
          </div>
        ))}
        <p className="text-xs text-gray-500">
          Cada linha é um alimento. Use "ou (substituição)" para variações que você costuma comer (ex: pão ou tapioca ou cuscuz). Use medidas caseiras: colher, fatia, copo, unidade, gramas…
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={addItem} className="gap-1 px-2 text-gray-300 hover:bg-gray-700">
          <Plus className="h-4 w-4" /> Adicionar alimento
        </Button>
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-medium text-gray-300">Bebidas e quantidades</Label>
        <Input value={value.bebidas || ''} onChange={(e) => setField('bebidas', e.target.value)} placeholder="Ex: 1 copo de suco de laranja, 200ml de café…" className="bg-gray-800 border-gray-700 text-white" />
      </div>
    </div>
  );
}

// ── Renderer: treino de UM dia (dark) ───────────────────────────────────────────
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
    <div className="rounded-lg border border-gray-700 p-3 space-y-3 bg-gray-800/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(43,74%,49%)]">{dia}</p>
      {sessions.map((session, idx) => {
        const isRepouso = session.modalidade === 'repouso';
        const showLongao = ENDURANCE_MODALIDADES.includes(session.modalidade);
        return (
          <div key={idx} className={cn('space-y-2', isRepouso && 'opacity-60', idx > 0 && 'pt-3 border-t border-dashed border-gray-700')}>
            <div className="flex items-start gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                <Select value={session.modalidade} onValueChange={(v) => setField(idx, 'modalidade', v)}>
                  <SelectTrigger className="h-9 text-sm bg-gray-800 border-gray-700 text-white"><SelectValue placeholder="Modalidade…" /></SelectTrigger>
                  <SelectContent>{MODALIDADES_OPT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={session.turno} onValueChange={(v) => setField(idx, 'turno', v)} disabled={isRepouso || !session.modalidade}>
                  <SelectTrigger className="h-9 text-sm bg-gray-800 border-gray-700 text-white"><SelectValue placeholder="Turno…" /></SelectTrigger>
                  <SelectContent>{TURNOS_OPT.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={session.intensidade} onValueChange={(v) => setField(idx, 'intensidade', v)} disabled={isRepouso || !session.modalidade}>
                  <SelectTrigger className="h-9 text-sm bg-gray-800 border-gray-700 text-white"><SelectValue placeholder="Intensidade…" /></SelectTrigger>
                  <SelectContent>{INTENSIDADES_OPT.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {sessions.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeSession(idx)} className="h-9 w-9 p-0 shrink-0 text-gray-400 hover:bg-gray-700">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {showLongao && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={!!session.longao} onChange={(e) => toggleLongao(idx, e.target.checked)} className="h-4 w-4 rounded border-gray-600 accent-[hsl(43,74%,49%)]" />
                <span className="text-sm text-gray-400">🐢 É o <strong>longão</strong> da semana<span className="text-xs ml-1">(volume longo / resistência)</span></span>
              </label>
            )}
          </div>
        );
      })}
      <Button type="button" variant="ghost" size="sm" onClick={addSession} className="gap-1 px-2 h-8 text-xs text-gray-300 hover:bg-gray-700">
        <Plus className="h-3.5 w-3.5" /> Adicionar modalidade neste dia
      </Button>
    </div>
  );
}

// ── Renderer: escala de sintomas 0–5 (dark) ─────────────────────────────────────
function SymptomScaleRenderer({ symptoms, value, onChange }: { symptoms: string[]; value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  return (
    <div className="space-y-4">
      {symptoms.map((symptom) => {
        const current = typeof value?.[symptom] === 'number' ? value[symptom] : 0;
        return (
          <div key={symptom} className="rounded-lg border border-gray-700 p-3 bg-gray-800/40 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white font-medium">{symptom}</span>
              <span className="text-sm font-bold text-[hsl(43,74%,49%)]">{current}</span>
            </div>
            <Slider
              value={[current]}
              onValueChange={([v]) => onChange({ ...value, [symptom]: v })}
              min={0}
              max={5}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>0 · nunca</span>
              <span>5 · muito frequente</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface Question {
  id: string;
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
}

interface Form {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  user_id: string;
  single_question_wizard?: boolean;
}

const emptyMealValue = () => ({ horario: '', itens: [['']], bebidas: '' });
const emptyTrainingWeek = () => DIAS_SEMANA.reduce((acc, d) => { acc[d] = [emptyTrainingSession()]; return acc; }, {} as Record<string, any>);

export default function AthleteDynamicAnamneseForm() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: client, isLoading: clientLoading } = useAthleteClient();

  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Fetch the active anamnese form for the admin that owns this client
  useEffect(() => {
    const fetchForm = async () => {
      if (!client) {
        // If client is null but clientLoading is false, stop loading
        if (!clientLoading) {
          setLoading(false);
        }
        return;
      }

      try {
        // Get the admin user_id from the client record
        const adminUserId = client.user_id;

        // Fetch active anamnese form from this admin
        const { data: formData, error: formError } = await supabase
          .from('anamnese_forms')
          .select('*')
          .eq('user_id', adminUserId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (formError) throw formError;

        if (!formData) {
          toast.error('Nenhum formulário de anamnese ativo encontrado. Entre em contato com seu assessor.');
          setLoading(false);
          return;
        }

        setForm(formData);

        // Fetch questions for this form - order by order_index to respect admin's ordering
        const { data: questionsData, error: questionsError } = await supabase
          .from('anamnese_questions')
          .select('*')
          .eq('form_id', formData.id)
          .order('order_index', { ascending: true });

        if (questionsError) throw questionsError;

        const typedQuestions = questionsData as Question[];
        setQuestions(typedQuestions);

        // Initialize answers and comments
        const initialAnswers: Record<string, any> = {};
        const initialComments: Record<string, string> = {};
        typedQuestions.forEach((q) => {
          if (q.question_type === 'checkbox' || q.question_type === 'multiselect') {
            initialAnswers[q.id] = [];
          } else if (q.question_type === 'scale') {
            initialAnswers[q.id] = Math.floor((q.scale_min + q.scale_max) / 2);
          } else if (q.question_type === 'meal_items') {
            initialAnswers[q.id] = emptyMealValue();
          } else if (q.question_type === 'training_week') {
            initialAnswers[q.id] = emptyTrainingWeek();
          } else if (q.question_type === 'symptom_scale') {
            const syms: string[] = Array.isArray(q.options) ? q.options : [];
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
      } catch (error) {
        console.error('Error fetching form:', error);
        toast.error('Erro ao carregar formulário');
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [client, clientLoading]);

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleCommentChange = (questionId: string, value: string) => {
    setComments(prev => ({ ...prev, [questionId]: value }));
  };

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      if (checked) {
        return { ...prev, [questionId]: [...current, option] };
      } else {
        return { ...prev, [questionId]: current.filter((o: string) => o !== option) };
      }
    });
  };

  // Group questions by section
  const questionsBySection = questions.reduce((acc, q) => {
    if (!acc[q.section]) acc[q.section] = [];
    acc[q.section].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

  const sections = Object.keys(questionsBySection);
  const currentSection = sections[currentSectionIndex];
  const currentQuestions = questionsBySection[currentSection] || [];
  const progress = sections.length > 0 ? ((currentSectionIndex + 1) / sections.length) * 100 : 0;

  // ── Modo wizard (1 pergunta por tela) ──────────────────────────────────────────
  const isWizard = !!form?.single_question_wizard;
  // Expande training_week em uma tela por dia da semana.
  const steps = isWizard
    ? questions.flatMap((q) =>
        q.question_type === 'training_week'
          ? DIAS_SEMANA.map((dia) => ({ question: q, day: dia as string }))
          : [{ question: q, day: undefined as string | undefined }]
      )
    : [];
  const currentStep = steps[currentStepIndex];
  const stepProgress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  // Renderiza o widget de entrada de uma pergunta (reutilizado por seção e wizard).
  const renderWidget = (question: Question, dayOverride?: string) => {
    switch (question.question_type) {
      case 'short_text':
      case 'text':
        return (
          <Input
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Sua resposta..."
            className="bg-gray-800 border-gray-700 text-white"
          />
        );
      case 'long_text':
      case 'textarea':
        return (
          <Textarea
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Sua resposta..."
            rows={4}
            className="bg-gray-800 border-gray-700 text-white"
          />
        );
      case 'boolean':
        return (
          <RadioGroup
            value={answers[question.id] || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            {['Sim', 'Não'].map((option, i) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${i}`} className="border-gray-600" />
                <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer text-gray-300">{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'multiple_choice':
      case 'select':
        return question.options ? (
          <RadioGroup
            value={answers[question.id] || ''}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
          >
            {(question.options as string[]).map((option, i) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${i}`} className="border-gray-600" />
                <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer text-gray-300">{option}</Label>
              </div>
            ))}
          </RadioGroup>
        ) : null;
      case 'checkbox':
      case 'multiselect':
        return question.options ? (
          <div className="space-y-2">
            {(question.options as string[]).map((option, i) => (
              <div key={i} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${i}`}
                  checked={(answers[question.id] || []).includes(option)}
                  onCheckedChange={(checked) => handleCheckboxChange(question.id, option, checked as boolean)}
                  className="border-gray-600"
                />
                <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer text-gray-300">{option}</Label>
              </div>
            ))}
          </div>
        ) : null;
      case 'scale':
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{question.scale_min}</span>
              <span className="font-medium text-white">{answers[question.id]}</span>
              <span>{question.scale_max}</span>
            </div>
            <Slider
              value={[answers[question.id] ?? question.scale_min]}
              onValueChange={([value]) => handleAnswerChange(question.id, value)}
              min={question.scale_min}
              max={question.scale_max}
              step={1}
              className="w-full"
            />
          </div>
        );
      case 'meal_items':
        return (
          <MealItemsRenderer
            value={answers[question.id] || emptyMealValue()}
            onChange={(v) => handleAnswerChange(question.id, v)}
          />
        );
      case 'training_week':
        return (
          <TrainingDayRenderer
            dia={dayOverride || DIAS_SEMANA[0]}
            value={answers[question.id] || emptyTrainingWeek()}
            onChange={(v) => handleAnswerChange(question.id, v)}
          />
        );
      case 'symptom_scale':
        return (
          <SymptomScaleRenderer
            symptoms={Array.isArray(question.options) ? (question.options as string[]) : []}
            value={answers[question.id] || {}}
            onChange={(v) => handleAnswerChange(question.id, v)}
          />
        );
      default:
        return (
          <Input
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Sua resposta..."
            className="bg-gray-800 border-gray-700 text-white"
          />
        );
    }
  };

  const validateQuestion = (question: Question): boolean => {
    if (question.is_required) {
      const answer = answers[question.id];
      if (!answer || (Array.isArray(answer) && answer.length === 0) || (typeof answer === 'string' && !answer.trim())) {
        toast.error(`Por favor responda: ${question.question_text}`);
        return false;
      }
    }
    if (question.has_comment_field && question.comment_field_required) {
      const comment = comments[question.id];
      if (!comment || !comment.trim()) {
        toast.error(`Por favor preencha: ${question.comment_field_label}`);
        return false;
      }
    }
    return true;
  };

  const handleStepNext = () => {
    // Só valida no último passo de uma pergunta (training_week ocupa vários passos).
    const isLastStepOfQuestion = !currentStep || currentStep.day === undefined || currentStep.day === DIAS_SEMANA[DIAS_SEMANA.length - 1];
    if (isLastStepOfQuestion && currentStep && !validateQuestion(currentStep.question)) return;
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleStepPrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const validateCurrentSection = (): boolean => {
    for (const question of currentQuestions) {
      if (question.is_required) {
        const answer = answers[question.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0) || (typeof answer === 'string' && !answer.trim())) {
          toast.error(`Por favor responda: ${question.question_text}`);
          return false;
        }
      }
      if (question.has_comment_field && question.comment_field_required) {
        const comment = comments[question.id];
        if (!comment || !comment.trim()) {
          toast.error(`Por favor preencha: ${question.comment_field_label}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentSection()) {
      if (currentSectionIndex < sections.length - 1) {
        setCurrentSectionIndex(prev => prev + 1);
        window.scrollTo(0, 0);
      }
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    if (isWizard) {
      if (currentStep && !validateQuestion(currentStep.question)) return;
    } else if (!validateCurrentSection()) {
      return;
    }
    if (!termsAccepted) {
      toast.error('Você precisa aceitar os Termos e Condições para enviar a anamnese');
      return;
    }
    if (!client?.id || !form?.id) {
      toast.error('Erro: cliente ou formulário não encontrado');
      return;
    }

    setSubmitting(true);

    try {
      // Prepare responses with comments
      const responsesWithComments: Record<string, any> = {};
      questions.forEach((q) => {
        responsesWithComments[q.id] = {
          answer: answers[q.id],
          comment: q.has_comment_field ? comments[q.id] || null : null,
        };
      });

      // Submit response
      const { error: submitError } = await supabase
        .from('anamnese_responses')
        .insert({
          form_id: form.id,
          client_id: client.id,
          responses: responsesWithComments,
        });

      if (submitError) throw submitError;

      // Update client status
      const { error: updateError } = await supabase
        .from('clients')
        .update({ athlete_status: 'ready_for_ai_analysis' })
        .eq('id', client.id);

      if (updateError) throw updateError;

      // Update athlete_profiles to mark anamnese as completed
      const { error: profileError } = await supabase
        .from('athlete_profiles')
        .upsert({
          client_id: client.id,
          anamnese_completed: true,
          anamnese_submitted_at: new Date().toISOString(),
        }, { onConflict: 'client_id' });

      if (profileError) {
        console.error('Error updating athlete profile:', profileError);
      }

      // Auto-fill target_race from dynamic anamnese responses
      try {
        const { extractRaceFromDynamicResponses, autoFillTargetRace } = await import('@/lib/extractTargetRace');
        const { raceName, raceDate } = extractRaceFromDynamicResponses(
          questions.map(q => ({ id: q.id, question_text: q.question_text, question_type: q.question_type })),
          responsesWithComments
        );
        if (raceName) {
          await autoFillTargetRace(client.id, raceName, raceDate);
        }
      } catch (e) {
        console.error('Error auto-filling target race:', e);
      }

      // Fire-and-forget: push notification para o nutricionista dono
      supabase.functions
        .invoke('notify-anamnese-submitted', { body: { client_id: client.id } })
        .catch((e) => console.warn('notify-anamnese-submitted falhou:', e));

      toast.success('Anamnese enviada com sucesso!');
      navigate('/athlete');
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Erro ao enviar formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading || clientLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(43,74%,49%)]"></div>
      </div>
    );
  }

  if (!form || questions.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-gray-800 bg-black">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden border border-[hsl(43,74%,49%)]">
                <img src={rogersProfile} alt="Rogers Feitosa" className="w-full h-[200%] object-cover object-[center_15%]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">ROGERS FEITOSA</h1>
                <p className="text-xs text-gray-400">Nutrição e Treinamento</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white hover:bg-gray-800">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-12 text-center">
          <PersonStanding className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Formulário não disponível</h2>
          <p className="text-gray-400 mb-6">
            Nenhum formulário de anamnese está ativo no momento. Entre em contato com seu assessor.
          </p>
          <Button onClick={() => navigate('/athlete')} variant="outline" className="border-gray-700 text-white hover:bg-gray-800">
            Voltar
          </Button>
        </main>
      </div>
    );
  }

  // ── Renderização em modo wizard (1 pergunta por tela) ──────────────────────────
  if (isWizard && steps.length > 0) {
    const q = currentStep.question;
    const isLastStep = currentStepIndex === steps.length - 1;
    const dayLabel = currentStep.day ? ` — ${currentStep.day}` : '';
    return (
      <div className="min-h-screen bg-black text-white pb-32">
        <header className="border-b border-gray-800 bg-black sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden border border-[hsl(43,74%,49%)]">
                <img src={rogersProfile} alt="Rogers Feitosa" className="w-full h-[200%] object-cover object-[center_15%]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">ROGERS FEITOSA</h1>
                <p className="text-xs text-gray-400">Nutrição e Treinamento</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white hover:bg-gray-800">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white mb-1">{form.title}</h2>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Pergunta {currentStepIndex + 1} de {steps.length}</span>
              <span>{Math.round(stepProgress)}%</span>
            </div>
            <Progress value={stepProgress} className="h-2 bg-gray-800" />
          </div>

          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardHeader>
              <p className="text-xs uppercase tracking-wide text-[hsl(43,74%,49%)] font-semibold mb-1">{q.section?.replace(/_/g, ' ')}{dayLabel}</p>
              <CardTitle className={cn('text-white text-lg', q.is_required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
                {q.question_text}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderWidget(q, currentStep.day)}

              {q.has_comment_field && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <Label
                    htmlFor={`comment-${q.id}`}
                    className={cn('text-sm text-gray-400', q.comment_field_required && "after:content-['*'] after:ml-0.5 after:text-red-500")}
                  >
                    {q.comment_field_label || 'Comentário'}
                  </Label>
                  <Textarea
                    id={`comment-${q.id}`}
                    value={comments[q.id] || ''}
                    onChange={(e) => handleCommentChange(q.id, e.target.value)}
                    placeholder="Seu comentário..."
                    rows={2}
                    className="mt-2 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {isLastStep && (
            <Card className="mt-6 mb-8 bg-gray-900 border-[hsl(43,74%,49%)]/40">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms-accept-athlete-wizard"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    className="mt-1 border-gray-500"
                  />
                  <Label htmlFor="terms-accept-athlete-wizard" className="font-normal cursor-pointer leading-relaxed text-white">
                    Li e aceito os{' '}
                    <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-[hsl(43,74%,49%)] underline font-medium">
                      Termos e Condições de Serviço
                    </a>{' '}
                    do acompanhamento nutricional. <span className="text-red-500">*</span>
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 p-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            {currentStepIndex > 0 && (
              <Button variant="outline" onClick={handleStepPrevious} className="flex-1 border-gray-700 text-white hover:bg-gray-800">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Anterior
              </Button>
            )}
            {!isLastStep ? (
              <Button onClick={handleStepNext} className="flex-1 bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold">
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !termsAccepted} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold disabled:opacity-50">
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Enviar Anamnese</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden border border-[hsl(43,74%,49%)]">
              <img src={rogersProfile} alt="Rogers Feitosa" className="w-full h-[200%] object-cover object-[center_15%]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[hsl(43,74%,49%)]">ROGERS FEITOSA</h1>
              <p className="text-xs text-gray-400">Nutrição e Treinamento</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white hover:bg-gray-800">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Form Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">{form.title}</h2>
          {form.description && <p className="text-gray-400">{form.description}</p>}
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Seção {currentSectionIndex + 1} de {sections.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-gray-800" />
        </div>

        {/* Section Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {sections.map((section, idx) => (
            <button
              key={section}
              onClick={() => {
                if (idx < currentSectionIndex) setCurrentSectionIndex(idx);
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                idx === currentSectionIndex
                  ? "bg-[hsl(43,74%,49%)] text-black"
                  : idx < currentSectionIndex
                    ? "bg-green-500/20 text-green-400 border border-green-500/30 cursor-pointer hover:bg-green-500/30"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
              )}
            >
              {idx < currentSectionIndex && <Check className="h-3 w-3 inline mr-1" />}
              {section.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Current Section */}
        <Card className="bg-gray-900 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white capitalize">{currentSection?.replace(/_/g, ' ')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentQuestions.map((question, index) => (
              <div key={question.id} className="space-y-4">
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 font-medium">{index + 1}.</span>
                  <div className="flex-1">
                    <Label className={cn(
                      "text-white",
                      question.is_required && "after:content-['*'] after:ml-0.5 after:text-red-500"
                    )}>
                      {question.question_text}
                    </Label>
                  </div>
                </div>

                {(question.question_type === 'short_text' || question.question_type === 'text') && (
                  <Input
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Sua resposta..."
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                )}

                {(question.question_type === 'long_text' || question.question_type === 'textarea') && (
                  <Textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Sua resposta..."
                    rows={4}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                )}

                {(question.question_type === 'multiple_choice' || question.question_type === 'select') && question.options && (
                  <RadioGroup
                    value={answers[question.id] || ''}
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                  >
                    {(question.options as string[]).map((option, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${question.id}-${i}`} className="border-gray-600" />
                        <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer text-gray-300">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {(question.question_type === 'checkbox' || question.question_type === 'multiselect') && question.options && (
                  <div className="space-y-2">
                    {(question.options as string[]).map((option, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${question.id}-${i}`}
                          checked={(answers[question.id] || []).includes(option)}
                          onCheckedChange={(checked) => handleCheckboxChange(question.id, option, checked as boolean)}
                          className="border-gray-600"
                        />
                        <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer text-gray-300">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}

                {question.question_type === 'scale' && (
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{question.scale_min}</span>
                      <span className="font-medium text-white">{answers[question.id]}</span>
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

                {/* Comment attachment field */}
                {question.has_comment_field && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <Label
                      htmlFor={`comment-${question.id}`}
                      className={cn(
                        "text-sm text-gray-400",
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
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {currentSectionIndex === sections.length - 1 && (
          <Card className="mt-6 mb-32 bg-gray-900 border-[hsl(43,74%,49%)]/40">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms-accept-athlete"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-1 border-gray-500"
                />
                <Label htmlFor="terms-accept-athlete" className="font-normal cursor-pointer leading-relaxed text-white">
                  Li e aceito os{' '}
                  <a
                    href="/termos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[hsl(43,74%,49%)] underline font-medium"
                  >
                    Termos e Condições de Serviço
                  </a>{' '}
                  do acompanhamento nutricional. <span className="text-red-500">*</span>
                </Label>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Navigation Buttons - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 p-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          {currentSectionIndex > 0 && (
            <Button
              variant="outline"
              onClick={handlePrevious}
              className="flex-1 border-gray-700 text-white hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>
          )}

          {currentSectionIndex < sections.length - 1 ? (
            <Button
              onClick={handleNext}
              className="flex-1 bg-[hsl(43,74%,49%)] hover:bg-[hsl(43,74%,40%)] text-black font-bold"
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !termsAccepted}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Anamnese
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
