import { useState, useEffect, useCallback } from 'react';
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
import { PersonStanding, Send, CheckCircle2, Pencil, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
}

export default function PublicAnamneseForm() {
  const { formId } = useParams<{ formId: string }>();

  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [previousLoaded, setPreviousLoaded] = useState(false);

  const [athleteName, setAthleteName] = useState('');
  const [athleteEmail, setAthleteEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);

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
        const typedQuestions = questionsData as Question[];
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
      if (q.question_type === 'checkbox' || q.question_type === 'multiselect') {
        initialAnswers[q.id] = [];
      } else if (q.question_type === 'scale') {
        initialAnswers[q.id] = Math.floor((q.scale_min + q.scale_max) / 2);
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

        // Pre-fill answers from previous responses
        const prevResponses = prev.responses as Record<string, any>;
        const filledAnswers: Record<string, any> = {};
        const filledComments: Record<string, string> = {};

        questions.forEach((q) => {
          const prevResponse = prevResponses[q.id];
          if (prevResponse !== undefined) {
            if (typeof prevResponse === 'object' && prevResponse?.answer !== undefined) {
              filledAnswers[q.id] = prevResponse.answer;
              if (q.has_comment_field && prevResponse.comment) {
                filledComments[q.id] = prevResponse.comment;
              }
            } else {
              filledAnswers[q.id] = prevResponse;
            }
          } else {
            if (q.question_type === 'checkbox' || q.question_type === 'multiselect') {
              filledAnswers[q.id] = [];
            } else if (q.question_type === 'scale') {
              filledAnswers[q.id] = Math.floor((q.scale_min + q.scale_max) / 2);
            } else {
              filledAnswers[q.id] = '';
            }
          }
          if (q.has_comment_field && !filledComments[q.id]) {
            filledComments[q.id] = '';
          }
        });

        setAnswers(filledAnswers);
        setComments(filledComments);
        setIsEditMode(true);
        setPreviousLoaded(true);
        toast.info('Respostas anteriores carregadas. Edite o que precisar e envie novamente.');
      }
    } catch (error) {
      console.error('Error loading previous responses:', error);
    } finally {
      setLoadingPrevious(false);
    }
  }, [formId, athleteEmail, athleteName, questions, previousLoaded]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!athleteName.trim() || !athleteEmail.trim()) {
      toast.error('Nome e email são obrigatórios');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(athleteEmail)) {
      toast.error('Email inválido');
      return;
    }

    if (!termsAccepted) {
      toast.error('Você precisa aceitar os Termos e Condições para enviar a anamnese');
      return;
    }

    for (const question of questions) {
      if (question.is_required) {
        const answer = answers[question.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          toast.error(`Por favor responda: ${question.question_text}`);
          return;
        }
      }
      if (question.has_comment_field && question.comment_field_required) {
        const comment = comments[question.id];
        if (!comment || !comment.trim()) {
          toast.error(`Por favor preencha o comentário: ${question.comment_field_label}`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const responsesWithComments: Record<string, any> = {};
      questions.forEach((q) => {
        responsesWithComments[q.id] = {
          answer: answers[q.id],
          comment: q.has_comment_field ? comments[q.id] || null : null,
        };
      });

      const { data, error: fnError } = await supabase.functions.invoke('process-anamnese-submission', {
        body: {
          form_id: formId,
          respondent_name: athleteName.trim(),
          respondent_email: athleteEmail.toLowerCase().trim(),
          responses: responsesWithComments,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
      toast.success(isEditMode ? 'Respostas atualizadas com sucesso!' : 'Anamnese enviada com sucesso!');
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Erro ao enviar formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAgain = () => {
    setSubmitted(false);
    setIsEditMode(true);
  };

  // Group questions by section while preserving order_index order
  const orderedSections: string[] = [];
  const questionsBySection = questions.reduce((acc, q) => {
    if (!acc[q.section]) {
      acc[q.section] = [];
      orderedSections.push(q.section);
    }
    acc[q.section].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

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
                  onChange={(e) => {
                    setAthleteEmail(e.target.value);
                    setPreviousLoaded(false);
                  }}
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
                {questionsBySection[section].map((question, index) => (
                  <div key={question.id} className="space-y-4">
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground font-medium">{index + 1}.</span>
                      <div className="flex-1">
                        <Label className={cn(question.is_required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
                          {question.question_text}
                        </Label>
                      </div>
                    </div>

                    {(question.question_type === 'short_text' || question.question_type === 'text') && (
                      <Input
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Sua resposta..."
                      />
                    )}

                    {(question.question_type === 'long_text' || question.question_type === 'textarea') && (
                      <Textarea
                        value={answers[question.id] || ''}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Sua resposta..."
                        rows={4}
                      />
                    )}

                    {question.question_type === 'select' && question.options && (
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

                    {question.question_type === 'multiselect' && question.options && (
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

                    {question.question_type === 'multiple_choice' && question.options && (
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

                    {question.question_type === 'checkbox' && question.options && (
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

                    {question.question_type === 'scale' && (
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
                ))}
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
