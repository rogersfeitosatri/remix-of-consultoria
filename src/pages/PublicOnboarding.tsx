import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  ArrowRight,
  Sparkles,
  CalendarDays,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import logoRF from "@/assets/logo-rf.jpg";

interface OnboardingPlan {
  id: string;
  slug: string;
  category: string;
  periodicity: string;
  name: string;
  description: string | null;
  duration_months: number;
  consultations_count: number;
  consultation_interval_weeks: number | null;
  checkin_frequency: string | null;
  order_index: number;
}

type Step = "select" | "details" | "done";

export default function PublicOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSlug = searchParams.get("plano");

  const [plans, setPlans] = useState<OnboardingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("select");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    plan_name: string;
    anamnese_form_id: string | null;
    whatsapp_sent: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("onboarding_plans")
        .select(
          "id, slug, category, periodicity, name, description, duration_months, consultations_count, consultation_interval_weeks, checkin_frequency, order_index"
        )
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (error) {
        console.error(error);
        toast.error("Não foi possível carregar os planos");
      } else {
        setPlans(data as OnboardingPlan[]);
      }
      setLoading(false);
    })();
  }, []);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.slug === selectedSlug) || null,
    [plans, selectedSlug]
  );

  useEffect(() => {
    if (initialSlug && plans.length > 0 && plans.some((p) => p.slug === initialSlug)) {
      setStep("details");
    }
  }, [initialSlug, plans]);

  const handlePick = (slug: string) => {
    setSelectedSlug(slug);
    setStep("details");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    if (!name.trim() || !email.trim() || !phone.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-onboarding", {
        body: {
          plan_slug: selectedPlan.slug,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult({
        plan_name: (data as any).plan_name,
        anamnese_form_id: (data as any).anamnese_form_id ?? null,
        whatsapp_sent: !!(data as any).whatsapp_sent,
      });
      setStep("done");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao iniciar onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <img src={logoRF} alt="Rogers Feitosa" className="h-12 w-12 rounded-full" />
          <div>
            <h1 className="text-xl font-semibold">Rogers Feitosa · Nutrição Esportiva</h1>
            <p className="text-sm text-muted-foreground">Cadastro de novo atleta</p>
          </div>
        </div>

        {step === "select" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Escolha o seu plano</h2>
              <p className="text-muted-foreground">
                Selecione o plano que você contratou. Em seguida você preenche uma anamnese rápida
                e o link de pagamento é enviado no seu WhatsApp.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className="hover:border-primary transition cursor-pointer"
                  onClick={() => handlePick(plan.slug)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {plan.description || `Plano ${plan.category}`}
                        </CardDescription>
                      </div>
                      <Badge variant={plan.category === "consultas" ? "default" : "secondary"}>
                        {plan.category === "consultas" ? "Consultas" : "Consultoria"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        {plan.duration_months} meses
                      </span>
                      {plan.consultations_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-4 w-4" />
                          {plan.consultations_count} consultas
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Repeat className="h-4 w-4" />
                        check-in{" "}
                        {plan.checkin_frequency === "biweekly" ? "quinzenal" : "mensal"}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-4 px-0">
                      Selecionar este plano <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {step === "details" && selectedPlan && (
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <Badge className="w-fit mb-2">{selectedPlan.name}</Badge>
              <CardTitle>Quase lá! Confirme seus dados</CardTitle>
              <CardDescription>
                Após confirmar seus dados, você será levado para a anamnese. Quando enviar, o link
                de pagamento chega automaticamente no seu WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="João da Silva"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">WhatsApp (com DDD)</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(85) 99999-9999"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usaremos para enviar o link de pagamento após a anamnese.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("select")}
                    disabled={submitting}
                  >
                    Trocar de plano
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4 mr-2" /> Continuar para a anamnese
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "done" && result && (
          <Card className="max-w-xl mx-auto">
            <CardHeader>
              <div className="rounded-full bg-green-500/10 p-3 w-fit mx-auto mb-3">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <CardTitle className="text-center">Cadastro recebido!</CardTitle>
              <CardDescription className="text-center">
                Plano escolhido: <strong>{result.plan_name}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.anamnese_form_id ? (
                <>
                  <Alert>
                    <MessageCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Próximo passo:</strong> preencha sua anamnese agora. Assim que você
                      enviar, o <strong>link de pagamento</strong> chega no seu WhatsApp
                      automaticamente.
                    </AlertDescription>
                  </Alert>

                  <div className="border rounded-lg p-4 bg-muted/30">
                    <h3 className="font-semibold mb-1">Preencher anamnese</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Leva poucos minutos. Sem anamnese, o link de pagamento não é liberado.
                    </p>
                    <Button
                      onClick={() => navigate(`/anamnese-form/${result.anamnese_form_id}`)}
                      className="w-full"
                      size="lg"
                    >
                      Preencher anamnese agora <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    O formulário de anamnese ainda não está configurado. Entraremos em contato com
                    você o quanto antes.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
