import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useStrategicCallBySlug, useStrategicCallQuestions, useSubmitStrategicCallResponse, type StrategicCallQuestion } from '@/hooks/useStrategicCalls';
import { supabase } from '@/integrations/supabase/client';
import { PhoneInput } from '@/components/ui/phone-input';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type Phase = 'landing' | 'wizard' | 'done';

export default function PublicStrategicCall() {
  const { slug } = useParams<{ slug: string }>();
  const { data: call, isLoading: callLoading } = useStrategicCallBySlug(slug);
  const { data: questions = [], isLoading: qLoading } = useStrategicCallQuestions(call?.id);
  const submitResponse = useSubmitStrategicCallResponse();

  const [phase, setPhase] = useState<Phase>('landing');
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const progress = questions.length > 0 ? ((currentStep + 1) / questions.length) * 100 : 0;
  const currentQ = questions[currentStep];

  const setAnswer = (qId: string, value: any) => setAnswers(prev => ({ ...prev, [qId]: value }));

  const calculateScore = () => {
    let total = 0;
    questions.forEach(q => {
      if (q.score_map && typeof q.score_map === 'object') {
        const answer = answers[q.id];
        if (Array.isArray(answer)) {
          answer.forEach(a => { total += (q.score_map as Record<string, number>)[a] || 0; });
        } else if (answer) {
          total += (q.score_map as Record<string, number>)[answer] || 0;
        }
      }
    });
    return total;
  };

  const classify = (score: number) => {
    const maxPossible = questions.reduce((sum, q) => {
      if (!q.score_map || typeof q.score_map !== 'object') return sum;
      const vals = Object.values(q.score_map as Record<string, number>);
      return sum + Math.max(...vals, 0);
    }, 0);
    if (maxPossible === 0) return 'medium';
    const pct = score / maxPossible;
    if (pct >= 0.7) return 'high';
    if (pct >= 0.4) return 'medium';
    return 'low';
  };

  // Extract name, email, phone from answers by field_name or question_type
  const getContactField = (fieldName: string) => {
    // Try by field_name first
    const byField = questions.find(q => q.field_name === fieldName);
    if (byField && answers[byField.id]) return answers[byField.id];
    // Fallback: match by question_type
    const typeMap: Record<string, string[]> = {
      nome: ['short_text'],
      name: ['short_text'],
      email: ['email'],
      telefone: ['phone'],
      phone: ['phone'],
      whatsapp: ['phone'],
    };
    const types = typeMap[fieldName];
    if (types) {
      const byType = questions.find(q => types.includes(q.question_type) && answers[q.id]);
      if (byType) return answers[byType.id];
    }
    return '';
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const score = calculateScore();
      const classification = classify(score);
      const name = getContactField('nome') || getContactField('name') || '';
      const email = getContactField('email') || '';
      const phone = getContactField('telefone') || getContactField('phone') || getContactField('whatsapp') || '';

      await submitResponse.mutateAsync({
        call_id: call!.id,
        respondent_name: name,
        respondent_email: email,
        respondent_phone: phone,
        answers,
        total_score: score,
        classification,
      });

      // Send WhatsApp to respondent + admin notification
      try {
        const formattedPhone = phone ? phone.replace(/\D/g, '') : '';
        await supabase.functions.invoke('send-strategic-call-whatsapp', {
          body: {
            phone: formattedPhone || null,
            message: call?.whatsapp_message || null,
            respondentName: name,
            callId: call.id,
          },
        });
      } catch (wpErr) {
        console.error('WhatsApp send error:', wpErr);
      }

      setPhase('done');
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (currentQ?.is_required && !answers[currentQ.id]) {
      toast.error('Este campo é obrigatório');
      return;
    }
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  if (callLoading || qLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!call) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-lg">Call não encontrada ou encerrada.</p></div>;
  }

  // Check if call is past closing date
  const isClosedByDate = call.closing_date && new Date(call.closing_date + 'T23:59:59') < new Date();
  if (isClosedByDate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-bold text-foreground">Inscrições encerradas</h2>
          <p className="text-muted-foreground">O período de inscrição para esta call já foi encerrado.</p>
        </div>
      </div>
    );
  }

  // DONE
  if (phase === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Aplicação enviada!</h2>
          <p className="text-muted-foreground">Obrigado por se inscrever. Entraremos em contato em breve.</p>
        </div>
      </div>
    );
  }

  // Handle Google Form confirmation
  const handleGoogleFormConfirm = async () => {
    setSubmitting(true);
    try {
      // Send WhatsApp notifications (respondent + admin)
      try {
        await supabase.functions.invoke('send-strategic-call-whatsapp', {
          body: {
            phone: null,
            message: call?.whatsapp_message || null,
            respondentName: 'Aplicante',
            callId: call!.id,
          },
        });
      } catch (wpErr) {
        console.error('WhatsApp send error:', wpErr);
      }
      setPhase('done');
    } catch (err: any) {
      toast.error('Erro ao confirmar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // GOOGLE FORM EMBED
  if (phase === 'wizard' && call.google_form_url) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="w-full max-w-3xl mx-auto px-4 pt-6">
          <Button variant="ghost" onClick={() => setPhase('landing')} className="mb-4">← Voltar</Button>
        </div>
        <div className="flex-1 flex justify-center px-4">
          <div className="w-full max-w-3xl space-y-4">
            <iframe
              src={call.google_form_url}
              className="w-full border-0 rounded-xl"
              style={{ minHeight: '75vh' }}
              title="Formulário"
            />
            <div className="text-center pb-8 space-y-3">
              <p className="text-sm text-muted-foreground">Após preencher e enviar o formulário acima, clique no botão abaixo para confirmar.</p>
              <Button
                onClick={handleGoogleFormConfirm}
                disabled={submitting}
                size="lg"
                className="text-lg px-8 py-6"
                style={{ backgroundColor: call.button_color }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '✅ Já enviei o formulário'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // WIZARD
  if (phase === 'wizard' && currentQ) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="w-full max-w-xl mx-auto px-4 pt-6">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">{currentStep + 1} / {questions.length}</p>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-xl space-y-6">
            <h2 className="text-xl font-semibold text-foreground">{currentQ.question_text}</h2>
            <QuestionInput question={currentQ} value={answers[currentQ.id]} onChange={v => setAnswer(currentQ.id, v)} />
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button variant="outline" onClick={() => setCurrentStep(prev => prev - 1)}>Voltar</Button>
              )}
              <Button onClick={handleNext} disabled={submitting} className="flex-1" style={{ backgroundColor: call.button_color }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : currentStep === questions.length - 1 ? 'Enviar' : 'Próximo'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LANDING
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-2xl space-y-8 py-12">
        {call.page_image_url && <img src={call.page_image_url} alt="" className="w-full rounded-xl max-h-80 object-cover" />}
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">{call.page_title}</h1>
        <div className="text-foreground/80 whitespace-pre-line text-base sm:text-lg leading-relaxed">{call.page_text}</div>
        <Button
          onClick={() => setPhase('wizard')}
          size="lg"
          className="text-lg px-8 py-6"
          style={{ backgroundColor: call.button_color }}
        >
          {call.button_text}
        </Button>
      </div>
    </div>
  );
}

function QuestionInput({ question, value, onChange }: { question: StrategicCallQuestion; value: any; onChange: (v: any) => void }) {
  const opts = Array.isArray(question.options) ? question.options as string[] : [];

  switch (question.question_type) {
    case 'short_text':
      return <Input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Sua resposta..." className="text-base" />;
    case 'long_text':
      return <Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Sua resposta..." rows={5} className="text-base" />;
    case 'number':
      return <Input type="number" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="0" className="text-base" />;
    case 'date':
      return <Input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className="text-base" />;
    case 'phone':
      return <PhoneInput value={value || ''} onChange={onChange} placeholder="(11) 99999-9999" className="text-base" />;
    case 'email':
      return <Input type="email" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="seu@email.com" className="text-base" />;
    case 'single_choice':
      return (
        <RadioGroup value={value || ''} onValueChange={onChange} className="space-y-3">
          {opts.map(opt => (
            <div key={opt} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
              <RadioGroupItem value={opt} id={opt} />
              <Label htmlFor={opt} className="flex-1 cursor-pointer text-base">{opt}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    case 'multiple_choice':
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-3">
          {opts.map(opt => (
            <div key={opt} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={checked => {
                  onChange(checked ? [...selected, opt] : selected.filter((s: string) => s !== opt));
                }}
                id={opt}
              />
              <Label htmlFor={opt} className="flex-1 cursor-pointer text-base">{opt}</Label>
            </div>
          ))}
        </div>
      );
    default:
      return <Input value={value || ''} onChange={e => onChange(e.target.value)} className="text-base" />;
  }
}
