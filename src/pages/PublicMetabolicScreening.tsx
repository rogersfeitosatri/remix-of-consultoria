import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import logoRF from '@/assets/logo-rf.jpg';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckCircle2, Network, Send, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { metabolicCategories, scoreLabels } from '@/data/metabolicScreeningQuestions';
import { cn } from '@/lib/utils';

function applyPhoneMask(value: string): string {
  let digits = value.replace(/\D/g, '');
  const hasDDI = digits.startsWith('55');
  const maxDigits = hasDDI ? 13 : 11;
  if (digits.length > maxDigits) digits = digits.slice(0, maxDigits);
  if (digits.length === 0) return '';

  if (hasDDI) {
    const rest = digits.slice(2);
    if (rest.length === 0) return '+55';
    if (rest.length <= 2) return `+55 (${rest}`;
    const ddd = rest.slice(0, 2);
    const number = rest.slice(2);
    if (number.length === 0) return `+55 (${ddd})`;
    if (number.length <= 4) return `+55 (${ddd}) ${number}`;
    if (number.length <= 8) return `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
    return `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }

  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function normalizePhoneToE164(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  while (digits.startsWith('0')) digits = digits.substring(1);
  if (!digits.startsWith('55')) digits = '55' + digits;
  return '+' + digits;
}

export default function PublicMetabolicScreening() {
  const [searchParams] = useSearchParams();
  const clientParam = searchParams.get('client') || undefined;

  const [athletePhone, setAthletePhone] = useState('');
  const [verifiedClientId, setVerifiedClientId] = useState<string | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [responses, setResponses] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);

  const currentCat = metabolicCategories[activeCategoryIdx];
  const answeredInCat = currentCat.questions.filter(q => responses[q.id] !== undefined).length;
  const totalAnswered = Object.keys(responses).length;
  const totalQuestions = metabolicCategories.reduce((s, c) => s + c.questions.length, 0);
  const allAnswered = totalAnswered === totalQuestions;

  const handleScore = (questionId: string, score: number) => {
    setResponses(prev => ({ ...prev, [questionId]: score }));
  };

  const handleVerifyPhone = async () => {
    setVerifyingPhone(true);
    try {
      const phoneDigits = athletePhone.replace(/\D/g, '');
      const hasDDI = phoneDigits.startsWith('55');
      const valid =
        (hasDDI && (phoneDigits.length === 12 || phoneDigits.length === 13)) ||
        (!hasDDI && (phoneDigits.length === 10 || phoneDigits.length === 11));
      if (!valid) throw new Error('Telefone inválido.');

      const normalizedPhone = normalizePhoneToE164(athletePhone);
      const { data, error } = await supabase.functions.invoke('verify-checkin-phone', {
        body: { clientId: clientParam, phone: normalizedPhone },
      });
      if (error) throw error;
      if (!data?.valid || !data?.clientId) {
        toast.error('Telefone não encontrado. Confirme o número recebido no WhatsApp.');
        return;
      }
      setVerifiedClientId(data.clientId);
      toast.success('Telefone confirmado!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao verificar telefone.');
    } finally {
      setVerifyingPhone(false);
    }
  };

  const handleSubmit = async () => {
    if (!allAnswered || !verifiedClientId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-public-metabolic-screening', {
        body: { clientId: verifiedClientId, responses, notes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSubmitted(true);
      toast.success('Rastreamento enviado com sucesso!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setResponses({});
    setNotes('');
    setActiveCategoryIdx(0);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="rounded-full bg-green-500/10 p-4 w-fit mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Rastreamento Enviado!</h1>
          <p className="text-muted-foreground mb-6">
            Suas respostas foram registradas com sucesso. A análise será gerada automaticamente e seu nutricionista será notificado.
          </p>
          <Button variant="outline" onClick={() => window.close()}>Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <img src={logoRF} alt="Rogers Feitosa" className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Rogers Feitosa</h1>
            <p className="text-sm text-muted-foreground">Nutrição & Treinamento</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              Rastreamento Metabólico
            </CardTitle>
            <CardDescription>
              Preencha o questionário abaixo com atenção. Suas respostas serão utilizadas para gerar sua teia de interconexão metabólica e orientar seu plano nutricional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Seu Telefone (código de acesso) *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={athletePhone}
                onChange={e => { setAthletePhone(applyPhoneMask(e.target.value)); setVerifiedClientId(null); }}
                placeholder="+55 (DD) 9XXXX-XXXX"
                disabled={!!verifiedClientId}
                maxLength={22}
              />
              <p className="text-xs text-muted-foreground">
                Insira o mesmo número cadastrado com seu nutricionista
              </p>
            </div>
            {!verifiedClientId && (
              <Button className="w-full" onClick={handleVerifyPhone} disabled={verifyingPhone || !athletePhone.trim()}>
                {verifyingPhone ? 'Confirmando...' : 'Confirmar Telefone'}
              </Button>
            )}
            {verifiedClientId && (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Telefone confirmado
              </Badge>
            )}
          </CardContent>
        </Card>

        {verifiedClientId && (
          <div className="space-y-4">
            {/* Score legend */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Escala de intensidade:</p>
                <div className="flex flex-wrap gap-2">
                  {scoreLabels.map(sl => (
                    <Badge key={sl.value} variant="outline" className="text-xs">
                      {sl.value} = {sl.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Category navigation */}
            <div className="flex flex-wrap gap-2">
              {metabolicCategories.map((cat, idx) => {
                const answered = cat.questions.filter(q => responses[q.id] !== undefined).length;
                const complete = answered === cat.questions.length;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategoryIdx(idx)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      idx === activeCategoryIdx
                        ? 'bg-primary text-primary-foreground border-primary'
                        : complete
                        ? 'bg-accent/50 text-accent-foreground border-border'
                        : 'bg-card text-muted-foreground border-border hover:bg-accent/30'
                    )}
                  >
                    {cat.shortLabel}
                    <span className="ml-1 opacity-70">{answered}/{cat.questions.length}</span>
                  </button>
                );
              })}
            </div>

            {/* Questions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span style={{ color: currentCat.color }}>●</span>
                  {currentCat.label}
                  <Badge variant="outline" className="ml-auto text-xs">{answeredInCat}/{currentCat.questions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentCat.questions.map(q => (
                  <div key={q.id} className="space-y-1.5">
                    <p className="text-sm text-foreground">{q.text}</p>
                    <div className="flex gap-1">
                      {scoreLabels.map(sl => (
                        <button
                          key={sl.value}
                          onClick={() => handleScore(q.id, sl.value)}
                          title={sl.label}
                          className={cn(
                            'flex-1 py-1.5 text-xs rounded-md border transition-all font-medium',
                            responses[q.id] === sl.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card text-muted-foreground border-border hover:bg-accent/30'
                          )}
                        >
                          {sl.value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 pt-3">
                  {activeCategoryIdx > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setActiveCategoryIdx(activeCategoryIdx - 1)}>
                      ← Anterior
                    </Button>
                  )}
                  {activeCategoryIdx < metabolicCategories.length - 1 && (
                    <Button variant="outline" size="sm" className="ml-auto" onClick={() => setActiveCategoryIdx(activeCategoryIdx + 1)}>
                      Próxima →
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notes & Submit */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações (opcional)</label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Algo que gostaria de informar ao nutricionista..." rows={2} />
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{totalAnswered}/{totalQuestions} respondidas</p>
                  <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto gap-1">
                    <RotateCcw className="h-3.5 w-3.5" /> Limpar
                  </Button>
                  <Button size="sm" onClick={handleSubmit} disabled={!allAnswered || submitting} className="gap-1">
                    <Send className="h-3.5 w-3.5" /> {submitting ? 'Enviando...' : 'Enviar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
