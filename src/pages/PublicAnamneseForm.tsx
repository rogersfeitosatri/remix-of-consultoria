import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { PersonStanding, Send, CheckCircle2 } from 'lucide-react';
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

  const [athleteName, setAthleteName] = useState('');
  const [athleteEmail, setAthleteEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

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
          .order('section')
          .order('order_index', { ascending: true });

        if (questionsError) throw questionsError;
        const typedQuestions = questionsData as Question[];
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(athleteEmail)) {
      toast.error('Email inválido');
      return;
    }

    // Validate required questions
    for (const question of questions) {
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
      // Find client by email
      const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('email', athleteEmail.toLowerCase().trim())
        .limit(1);

      if (clientError) throw clientError;

      if (!clients || clients.length === 0) {
        toast.error('Email não encontrado. Verifique se está usando o email cadastrado pelo seu assessor.');
        setSubmitting(false);
        return;
      }

      const clientId = clients[0].id;

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
          form_id: formId,
          client_id: clientId,
          responses: responsesWithComments,
        });

      if (submitError) throw submitError;

      setSubmitted(true);
      toast.success('Anamnese enviada com sucesso!');
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Erro ao enviar formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Group questions by section
  const questionsBySection = questions.reduce((acc, q) => {
    if (!acc[q.section]) acc[q.section] = [];
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
          <h1 className="text-2xl font-bold mb-2">Anamnese Enviada!</h1>
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

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <PersonStanding className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">RF Assessoria</h1>
            <p className="text-sm text-muted-foreground">Esportiva</p>
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
                  placeholder="Use o email cadastrado pelo seu assessor"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use o mesmo email que seu assessor cadastrou no sistema
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Questions by Section */}
          {Object.entries(questionsBySection).map(([section, sectionQuestions]) => (
            <Card key={section} className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg capitalize">{section.replace(/_/g, ' ')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {sectionQuestions.map((question, index) => (
                  <div key={question.id} className="space-y-4">
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
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        placeholder="Sua resposta..."
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

          {/* Submit */}
          <div className="mt-8">
            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar Anamnese
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}