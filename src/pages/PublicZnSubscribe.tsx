import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PlanCode = 'monthly' | 'semiannual' | 'annual';

const PLANS: Record<PlanCode, { label: string; price: string; installments: string }> = {
  monthly: { label: 'Mensal', price: 'R$ 69,90', installments: 'PIX ou 1x no cartão' },
  semiannual: { label: 'Semestral', price: 'R$ 299,00', installments: 'PIX ou até 6x no cartão' },
  annual: { label: 'Anual', price: 'R$ 419,90', installments: 'PIX ou até 12x no cartão' },
};

const parsePlan = (raw: string | null): PlanCode => {
  const norm = (raw ?? '').toLowerCase();
  if (norm === 'semestral' || norm === 'semiannual') return 'semiannual';
  if (norm === 'anual' || norm === 'annual') return 'annual';
  return 'monthly';
};

const onlyDigits = (s: string) => s.replace(/\D+/g, '');

const validateCPF = (raw: string) => {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i]) * (factor - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === parseInt(cpf[9]) && d2 === parseInt(cpf[10]);
};

const maskCPF = (v: string) =>
  onlyDigits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

const maskPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
};

export default function PublicZnSubscribe() {
  const [params, setParams] = useSearchParams();
  const initialPlan = parsePlan(params.get('plano'));
  const [plan, setPlan] = useState<PlanCode>(initialPlan);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ paymentLink: string | null } | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    body_goal: '' as '' | 'lose' | 'maintain' | 'gain',
    has_target_race: '' as '' | 'yes' | 'no',
    target_race: '',
    target_race_date: '',
    weight_kg: '',
    height_cm: '',
  });

  useEffect(() => {
    document.title = `ZN Assessoria — Plano ${PLANS[plan].label}`;
  }, [plan]);

  const setPlanChange = (v: PlanCode) => {
    setPlan(v);
    setParams({ plano: v === 'semiannual' ? 'semestral' : v === 'annual' ? 'anual' : 'mensal' });
  };

  const canStep1 = useMemo(() => {
    return (
      form.name.trim().length >= 3 &&
      /.+@.+\..+/.test(form.email) &&
      onlyDigits(form.phone).length >= 10 &&
      validateCPF(form.cpf)
    );
  }, [form]);

  const canStep2 = useMemo(() => {
    if (!form.body_goal) return false;
    if (!form.has_target_race) return false;
    if (form.has_target_race === 'yes' && (!form.target_race.trim() || !form.target_race_date)) return false;
    const w = parseFloat(form.weight_kg.replace(',', '.'));
    const h = parseFloat(form.height_cm.replace(',', '.'));
    return w >= 20 && w <= 400 && h >= 80 && h <= 260;
  }, [form]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        plan_choice: plan,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: onlyDigits(form.phone),
        cpf: onlyDigits(form.cpf),
        body_goal: form.body_goal,
        has_target_race: form.has_target_race === 'yes',
        target_race: form.has_target_race === 'yes' ? form.target_race.trim() : null,
        target_race_date: form.has_target_race === 'yes' ? form.target_race_date : null,
        weight_kg: parseFloat(form.weight_kg.replace(',', '.')),
        height_cm: parseFloat(form.height_cm.replace(',', '.')),
      };
      const { data, error } = await supabase.functions.invoke('zn-create-subscription', { body: payload });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).message ?? (data as any).error);

      setSuccess({ paymentLink: (data as any)?.payment_link ?? null });
      if ((data as any)?.payment_link) {
        window.location.href = (data as any).payment_link;
      }
    } catch (err: any) {
      toast({
        title: 'Não foi possível iniciar seu cadastro',
        description: err?.message ?? 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Cadastro criado!</h1>
            <p className="text-muted-foreground">
              Redirecionando para o pagamento seguro do Asaas...
            </p>
            {success.paymentLink && (
              <Button asChild className="w-full">
                <a href={success.paymentLink} rel="noopener">Ir para pagamento</a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-8">
          <p className="text-sm font-medium text-primary uppercase tracking-wide">ZN Assessoria</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">Complete sua assinatura</h1>
          <p className="text-muted-foreground mt-2">Leva menos de 2 minutos.</p>
        </header>

        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex-1 flex items-center">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {n}
              </div>
              {n < 3 && <div className={`flex-1 h-0.5 mx-2 ${step > n ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && 'Seus dados'}
              {step === 2 && 'Perfil rápido'}
              {step === 3 && 'Confirme e pague'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Ana Silva" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(85) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={e => setForm({ ...form, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" />
                  {form.cpf && !validateCPF(form.cpf) && (
                    <p className="text-xs text-destructive">CPF inválido</p>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Objetivo de composição corporal</Label>
                  <RadioGroup
                    value={form.body_goal}
                    onValueChange={v => setForm({ ...form, body_goal: v as any })}
                    className="grid grid-cols-1 gap-2"
                  >
                    {[
                      { v: 'lose', l: 'Perder peso / reduzir gordura' },
                      { v: 'maintain', l: 'Manter peso / recomposição' },
                      { v: 'gain', l: 'Ganhar peso / massa muscular' },
                    ].map(o => (
                      <label key={o.v} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                        <RadioGroupItem value={o.v} />
                        <span className="text-sm">{o.l}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>Você tem prova alvo?</Label>
                  <RadioGroup
                    value={form.has_target_race}
                    onValueChange={v => setForm({ ...form, has_target_race: v as any })}
                    className="grid grid-cols-2 gap-2"
                  >
                    <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="yes" />
                      <span className="text-sm">Sim</span>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="no" />
                      <span className="text-sm">Não</span>
                    </label>
                  </RadioGroup>
                </div>

                {form.has_target_race === 'yes' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Qual prova?</Label>
                      <Input value={form.target_race} onChange={e => setForm({ ...form, target_race: e.target.value })} placeholder="Ex.: Maratona de Fortaleza" />
                    </div>
                    <div className="space-y-2">
                      <Label>Quando será?</Label>
                      <Input type="date" value={form.target_race_date} onChange={e => setForm({ ...form, target_race_date: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Peso atual (kg)</Label>
                    <Input inputMode="decimal" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value })} placeholder="70" />
                  </div>
                  <div className="space-y-2">
                    <Label>Altura (cm)</Label>
                    <Input inputMode="numeric" value={form.height_cm} onChange={e => setForm({ ...form, height_cm: e.target.value })} placeholder="170" />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Escolha o plano</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(PLANS) as PlanCode[]).map(code => {
                      const info = PLANS[code];
                      const selected = plan === code;
                      return (
                        <button
                          type="button"
                          key={code}
                          onClick={() => setPlanChange(code)}
                          className={`text-left rounded-lg border-2 p-4 transition ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="font-semibold">{info.label}</span>
                            <span className="text-lg font-bold text-primary">{info.price}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{info.installments}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><span>{form.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">E-mail</span><span>{form.email}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">WhatsApp</span><span>{form.phone}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">CPF</span><span>{form.cpf}</span></div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Ao continuar você será redirecionado para o ambiente seguro do Asaas para concluir o pagamento.
                </p>
              </>
            )}

            <div className="flex justify-between pt-2">
              {step > 1 ? (
                <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={loading}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
              ) : <span />}

              {step < 3 && (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={(step === 1 && !canStep1) || (step === 2 && !canStep2)}
                >
                  Continuar <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {step === 3 && (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Processando</> : <>Ir para pagamento <ArrowRight className="h-4 w-4 ml-1" /></>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Pagamento processado pelo Asaas. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}
