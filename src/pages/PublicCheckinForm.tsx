import { useState, useEffect } from 'react';
import logoRF from '@/assets/logo-rf.jpg';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { PersonStanding, Send, CheckCircle2, Phone, Clock, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  question_text: string;
  question_type: 'short_text' | 'long_text' | 'multiple_choice' | 'checkbox' | 'scale';
  options: string[] | null;
  scale_min: number;
  scale_max: number;
  is_required: boolean;
  order_index: number;
  has_comment_field: boolean;
  comment_field_label: string | null;
  comment_field_required: boolean;
  comment_field_type: 'short' | 'medium' | null;
}

// Patterns to identify conditional questions about long training
const LONG_TRAINING_TRIGGER_PATTERN = /realizou.*treino.*longo|treino.*longo.*semana/i;
const LONG_TRAINING_DEPENDENT_PATTERNS = [
  /como.*sentiu.*treino.*longo/i,
  /suplementação.*treino/i,
];

interface Form {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
}

// Normalize phone to E.164 format (e.g., +5599984817697)
function normalizePhoneToE164(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Remove leading zeros
  while (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  
  // Add Brazil country code if not present
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  
  return '+' + digits;
}

// Format phone for display (Brazilian format)
function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 13 && digits.startsWith('55')) {
    // +55 (DD) 9XXXX-XXXX
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  } else if (digits.length === 12 && digits.startsWith('55')) {
    // +55 (DD) XXXX-XXXX
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  } else if (digits.length === 11) {
    // (DD) 9XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    // (DD) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  return phone;
}

// Apply mask while typing
function applyPhoneMask(value: string): string {
  let digits = value.replace(/\D/g, '');

  // Allow copy/paste with DDI (55) while still supporting local format (DDD + número)
  const hasDDI = digits.startsWith('55');
  const maxDigits = hasDDI ? 13 : 11;

  if (digits.length > maxDigits) {
    digits = digits.slice(0, maxDigits);
  }

  if (digits.length === 0) return '';

  if (hasDDI) {
    const rest = digits.slice(2); // after country code
    if (rest.length === 0) return '+55';
    if (rest.length <= 2) return `+55 (${rest}`;

    const ddd = rest.slice(0, 2);
    const number = rest.slice(2);

    if (number.length === 0) return `+55 (${ddd})`;
    if (number.length <= 4) return `+55 (${ddd}) ${number}`;

    // Landline (8 digits) -> 4-4, Mobile (9 digits) -> 5-4
    if (number.length <= 8) {
      return `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }

    return `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }

  // Local format (no DDI)
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function PublicCheckinForm() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  // ETAPA 3C — versão congelada do formulário vinculada ao disparo (quando houver token)
  const [formVersionId, setFormVersionId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [windowHours, setWindowHours] = useState<number>(36);

  const [athletePhone, setAthletePhone] = useState('');
  const [verifiedClientId, setVerifiedClientId] = useState<string | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  // Find the trigger question for long training
  const longTrainingTriggerQuestion = questions.find(q => 
    LONG_TRAINING_TRIGGER_PATTERN.test(q.question_text)
  );

  // Check if user answered "Sim" to long training question
  const didLongTraining = longTrainingTriggerQuestion 
    ? answers[longTrainingTriggerQuestion.id] === 'Sim'
    : true; // Default to show if trigger question not found

  // Function to check if a question should be visible
  const isQuestionVisible = (question: Question): boolean => {
    // Check if this is a dependent question (about long training details)
    const isDependentQuestion = LONG_TRAINING_DEPENDENT_PATTERNS.some(pattern => 
      pattern.test(question.question_text)
    );
    
    // If it's a dependent question, only show if user did long training
    if (isDependentQuestion) {
      return didLongTraining;
    }
    
    return true;
  };

  // Get visible questions for rendering
  const visibleQuestions = questions.filter(isQuestionVisible);

  useEffect(() => {
    const fetchForm = async () => {
      if (!formId) return;

      try {
        // Resolve via RPC: returns the requested form OR a fallback active form
        // for the same nutritionist if the original is inactive/empty.
        const { data: resolved, error: resolveError } = await supabase
          .rpc('resolve_public_checkin_form' as any, { p_form_id: formId });

        if (resolveError) throw resolveError;
        const resolvedForm = Array.isArray(resolved) && resolved.length > 0 ? resolved[0] : null;
        if (!resolvedForm) throw new Error('Form not found');

        // If the link's formId differs from the resolved one, redirect to the new URL
        // preserving query params (so dispatch tracking continues to work).
        if (resolvedForm.id !== formId) {
          navigate(`/form/${resolvedForm.id}${location.search}`, { replace: true });
          return;
        }

        setForm({
          id: resolvedForm.id,
          title: resolvedForm.title,
          description: resolvedForm.description,
          is_active: resolvedForm.is_active,
        });

        // ETAPA 3C — se o link traz o token do disparo, o atleta responde EXATAMENTE
        // a versão congelada no envio. Sem token, cai na definição atual do formulário.
        const dispatchToken = new URLSearchParams(location.search).get('t');
        let typedQuestions: Question[] | null = null;

        if (dispatchToken) {
          const { data: dv } = await supabase
            .rpc('get_checkin_dispatch_version' as any, { p_dispatch_token: dispatchToken });
          const dispatchRow = Array.isArray(dv) && dv.length > 0 ? (dv[0] as any) : null;
          if (dispatchRow?.form_version_id) {
            setFormVersionId(dispatchRow.form_version_id);
            const { data: vq } = await supabase
              .from('checkin_form_version_questions' as any)
              .select('*')
              .eq('version_id', dispatchRow.form_version_id)
              .order('order_index', { ascending: true });
            if (vq && vq.length > 0) {
              typedQuestions = (vq as any[]).map((q) => ({
                ...q,
                // a resposta é chaveada pela pergunta de origem, preservando o histórico
                id: q.source_question_id ?? q.id,
              })) as Question[];
            }
          }
        }

        if (!typedQuestions) {
          const { data: questionsData, error: questionsError } = await supabase
            .from('checkin_questions')
            .select('*')
            .eq('form_id', resolvedForm.id)
            .order('order_index', { ascending: true });

          if (questionsError) throw questionsError;
          typedQuestions = questionsData as Question[];
        }

        setQuestions(typedQuestions);


        // Initialize answers and comments
        const initialAnswers: Record<string, any> = {};
        const initialComments: Record<string, string> = {};
        typedQuestions.forEach((q) => {
          if (q.question_type === 'checkbox') {
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
      } catch (error) {
        console.error('Error fetching form:', error);
        toast.error('Formulário não encontrado ou inativo');
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [formId]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyPhoneMask(e.target.value);
    setAthletePhone(masked);
    setVerifiedClientId(null);
  };

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

  const validatePhoneOrThrow = (): { normalizedInputPhone: string } => {
    const phoneDigits = athletePhone.replace(/\D/g, '');
    const hasDDI = phoneDigits.startsWith('55');

    const valid =
      (hasDDI && (phoneDigits.length === 12 || phoneDigits.length === 13)) ||
      (!hasDDI && (phoneDigits.length === 10 || phoneDigits.length === 11));

    if (!valid) {
      throw new Error('Telefone inválido. Use o código exatamente como recebeu no WhatsApp.');
    }

    return { normalizedInputPhone: normalizePhoneToE164(athletePhone) };
  };

  const handleVerifyPhone = async () => {
    setVerifyingPhone(true);

    try {
      const { normalizedInputPhone } = validatePhoneOrThrow();
      const clientParam = new URLSearchParams(location.search).get('client') || undefined;

      const { data, error } = await supabase.functions.invoke('verify-checkin-phone', {
        body: {
          clientId: clientParam,
          phone: normalizedInputPhone,
          formId: formId,
        },
      });

      if (error) throw error;

      if (!data?.valid || !data?.clientId) {
        toast.error('Telefone não encontrado. Confirme o número que você recebeu no WhatsApp e tente novamente.');
        setVerifiedClientId(null);
        return;
      }

      // Server-side expiration check (window configurable per athlete)
      if (typeof data?.windowHours === 'number') setWindowHours(data.windowHours);
      if (data?.expired) {
        setLinkExpired(true);
        return;
      }

      setVerifiedClientId(data.clientId);
      toast.success('Telefone confirmado!');
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível confirmar o telefone.');
      setVerifiedClientId(null);
    } finally {
      setVerifyingPhone(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verifiedClientId) {
      toast.error('Confirme o telefone antes de iniciar o preenchimento.');
      return;
    }
    if (questions.length === 0) {
      toast.error('Este formulário não possui perguntas. Avise seu nutricionista.');
      return;
    }

    // Validate required questions (only visible ones)
    for (const question of visibleQuestions) {
      if (question.is_required) {
        const answer = answers[question.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          toast.error(`Por favor responda: ${question.question_text}`);
          return;
        }
      }
      // Validate required comment fields
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
      const clientId = verifiedClientId;

      // Re-check 36h expiration at submission time
      const { data: recheck } = await supabase.functions.invoke('verify-checkin-phone', {
        body: {
          clientId: clientId,
          phone: athletePhone,
          formId: formId,
        },
      });

      if (typeof recheck?.windowHours === 'number') setWindowHours(recheck.windowHours);
      if (recheck?.expired) {
        setLinkExpired(true);
        setSubmitting(false);
        return;
      }

      // Prepare responses with comments
      const responsesWithComments: Record<string, any> = {};
      questions.forEach((q) => {
        responsesWithComments[q.id] = {
          answer: answers[q.id],
          comment: q.has_comment_field ? comments[q.id] || null : null,
        };
      });

      // Submit response (no .select() since public users don't have SELECT permission)
      const { error: submitError } = await supabase
        .from('checkin_responses')
        .insert({
          form_id: formId,
          client_id: clientId,
          responses: responsesWithComments,
          // ETAPA 3C — a resposta guarda a versão exata que o atleta viu
          ...(formVersionId ? { form_version_id: formVersionId } : {}),
        } as any);


      if (submitError) throw submitError;

      // Notify admin via WhatsApp (fire-and-forget)
      supabase.functions.invoke('notify-checkin-response', {
        body: { clientId, formId, responses: responsesWithComments },
      }).catch(err => console.warn('Admin notification failed:', err));

      setSubmitted(true);
      toast.success('Checkin enviado com sucesso!');
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Erro ao enviar formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
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
          <h1 className="text-2xl font-bold mb-2">Checkin Enviado!</h1>
          <p className="text-muted-foreground mb-6">
            Suas respostas foram registradas com sucesso. Seu assessor receberá uma notificação.
          </p>
          <Button variant="outline" onClick={() => window.close()}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  if (linkExpired) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-full bg-orange-500/10 p-4 w-fit mx-auto mb-6">
            <Clock className="h-12 w-12 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Prazo Encerrado</h1>
          <p className="text-muted-foreground mb-4">
            O prazo de {windowHours} horas para preencher este check-in já foi encerrado.
          </p>
          <p className="text-muted-foreground mb-6">
            Caso queira informar algo ao seu nutricionista, envie diretamente pelo contato abaixo.
          </p>
          <Button 
            variant="default" 
            onClick={() => window.open('https://wa.me/5599984817697', '_blank')}
            className="gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Entrar em contato
          </Button>
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
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Seu Telefone (código de acesso) *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={athletePhone}
                  onChange={handlePhoneChange}
                  placeholder="+55 (DD) 9XXXX-XXXX ou (DD) 9XXXX-XXXX"
                  required
                  maxLength={22}
                />
                <p className="text-xs text-muted-foreground">
                  Cole exatamente o código que você recebeu no WhatsApp
                </p>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={handleVerifyPhone}
                disabled={verifyingPhone || !athletePhone.trim()}
              >
                {verifyingPhone ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Confirmando...
                  </>
                ) : (
                  <>Confirmar telefone</>
                )}
              </Button>

              {verifiedClientId && (
                <p className="text-xs text-muted-foreground">
                  Telefone confirmado: {formatPhoneForDisplay(athletePhone)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Questions / Submit */}
          {verifiedClientId && questions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <p className="font-medium">Este formulário ainda não tem perguntas configuradas.</p>
                <p className="text-sm text-muted-foreground">
                  Por favor, entre em contato com seu nutricionista — o link enviado precisa ser corrigido.
                </p>
                <Button
                  type="button"
                  variant="default"
                  className="mt-2 gap-2"
                  onClick={() => window.open('https://wa.me/5599984817697', '_blank')}
                >
                  <MessageCircle className="h-4 w-4" />
                  Avisar o nutricionista
                </Button>
              </CardContent>
            </Card>
          ) : verifiedClientId ? (
            <>
              {/* Questions */}
              <div className="space-y-4">
                {visibleQuestions.map((question, index) => (
                  <Card key={question.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground font-medium">{index + 1}.</span>
                          <div className="flex-1">
                            <Label className={cn(question.is_required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
                              {question.question_text}
                            </Label>
                          </div>
                        </div>

                        {question.question_type === 'short_text' && (
                          <Input
                            value={answers[question.id] || ''}
                            onChange={(e) => {
                              // Se a pergunta é sobre peso, aceitar apenas números
                              const isWeightQuestion = /peso.*jejum|peso.*recente/i.test(question.question_text);
                              if (isWeightQuestion) {
                                const numericValue = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                                handleAnswerChange(question.id, numericValue);
                              } else {
                                handleAnswerChange(question.id, e.target.value);
                              }
                            }}
                            placeholder={/peso.*jejum|peso.*recente/i.test(question.question_text) ? "Ex: 72.5" : "Sua resposta..."}
                            inputMode={/peso.*jejum|peso.*recente/i.test(question.question_text) ? "decimal" : "text"}
                          />
                        )}

                        {question.question_type === 'long_text' && (
                          <Textarea
                            value={answers[question.id] || ''}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            placeholder="Sua resposta..."
                            rows={4}
                          />
                        )}

                        {question.question_type === 'multiple_choice' && question.options && (
                          <RadioGroup
                            value={answers[question.id] || ''}
                            onValueChange={(value) => handleAnswerChange(question.id, value)}
                          >
                            {(question.options as string[]).map((option, i) => (
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
                            {(question.options as string[]).map((option, i) => (
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

                        {/* Comment attachment field */}
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
                            {question.comment_field_type === 'short' ? (
                              <Input
                                id={`comment-${question.id}`}
                                value={comments[question.id] || ''}
                                onChange={(e) => handleCommentChange(question.id, e.target.value)}
                                placeholder="Seu comentário..."
                                className="mt-2"
                              />
                            ) : (
                              <Textarea
                                id={`comment-${question.id}`}
                                value={comments[question.id] || ''}
                                onChange={(e) => handleCommentChange(question.id, e.target.value)}
                                placeholder="Seu comentário..."
                                rows={3}
                                className="mt-2"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Submit */}
              <div className="mt-6">
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Check-in
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Confirme seu telefone acima para liberar o formulário.
                </p>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}
