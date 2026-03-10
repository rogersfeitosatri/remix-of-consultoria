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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PersonStanding, ArrowLeft, ArrowRight, Check, Loader2, Send, LogOut } from 'lucide-react';
import rogersProfile from '@/assets/rogers-profile.jpg';

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
}

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
    if (!validateCurrentSection()) return;
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
              disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
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
