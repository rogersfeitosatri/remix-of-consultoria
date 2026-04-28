import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trophy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Ctx {
  link_id: string;
  client_id: string;
  client_name: string;
  admin_user_id: string;
  race_name: string | null;
  race_date: string | null;
}

export default function PublicNpCheckin() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [adherence, setAdherence] = useState<number>(80);
  const [gi, setGi] = useState<number>(2);
  const [energy, setEnergy] = useState<number>(7);
  const [sleep, setSleep] = useState<number>(7);
  const [weight, setWeight] = useState<string>("");
  const [mileage, setMileage] = useState<string>("");
  const [longRun, setLongRun] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        setError("Link inválido.");
        setLoading(false);
        return;
      }
      const { data, error: rpcErr } = await (supabase as any).rpc(
        "get_np_checkin_context",
        { p_token: token },
      );
      if (!mounted) return;
      if (rpcErr || !data || data.length === 0) {
        setError("Link inválido, expirado ou já utilizado.");
        setLoading(false);
        return;
      }
      setCtx(data[0] as Ctx);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error: invErr } = await supabase.functions.invoke(
        "np-checkin-submit",
        {
          body: {
            token,
            adherence_pct: adherence,
            gi_score: gi,
            energy_score: energy,
            sleep_score: sleep,
            weight_kg: weight ? Number(weight) : null,
            weekly_mileage_km: mileage ? Number(mileage) : null,
            long_run_completed: longRun,
            notes: notes.trim() || null,
            symptoms: [],
          },
        },
      );
      if (invErr) throw invErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar check-in");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-lg font-semibold">Não foi possível abrir o check-in</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
            <p className="text-lg font-semibold">Check-in enviado!</p>
            <p className="text-sm text-muted-foreground">
              Recebemos suas respostas. Seu nutricionista vai analisar e te
              retornar em breve com a próxima orientação. 💪
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl">
                Check-in de Periodização Nutricional
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">Olá, {ctx?.client_name?.split(" ")[0]} 👋</p>
            {ctx?.race_name && (
              <p className="text-muted-foreground">
                Prova-alvo: <span className="font-medium text-foreground">{ctx.race_name}</span>
                {ctx.race_date && (
                  <> em {format(parseISO(ctx.race_date), "dd 'de' MMMM", { locale: ptBR })}</>
                )}
              </p>
            )}
            <p className="text-muted-foreground pt-2">
              Responda com calma — leva ~2 min e ajusta seu protocolo até a prova.
            </p>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Como você se sentiu na semana?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <SliderField
                label="Aderência ao protocolo nutricional"
                hint="0% = não consegui seguir · 100% = segui à risca"
                value={adherence}
                onChange={setAdherence}
                min={0}
                max={100}
                step={5}
                suffix="%"
              />
              <SliderField
                label="Desconforto gastrointestinal nos treinos"
                hint="0 = nenhum · 10 = muito intenso"
                value={gi}
                onChange={setGi}
                min={0}
                max={10}
              />
              <SliderField
                label="Nível de energia"
                hint="0 = exausto · 10 = ótimo"
                value={energy}
                onChange={setEnergy}
                min={0}
                max={10}
              />
              <SliderField
                label="Qualidade do sono"
                hint="0 = péssimo · 10 = excelente"
                value={sleep}
                onChange={setSleep}
                min={0}
                max={10}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Treino e métricas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weight">Peso atual (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="ex: 72.5"
                  />
                </div>
                <div>
                  <Label htmlFor="mileage">Volume da semana (km)</Label>
                  <Input
                    id="mileage"
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    placeholder="ex: 60"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={longRun}
                  onCheckedChange={(v) => setLongRun(!!v)}
                />
                <span className="text-sm">Cumpri o long run da semana</span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Observações para o nutricionista</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Conte algo importante: dificuldade com algum gel, mudança de rotina, dúvidas..."
                rows={4}
                maxLength={2000}
              />
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...
              </>
            ) : (
              "Enviar check-in"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function SliderField({
  label, hint, value, onChange, min, max, step = 1, suffix = "",
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-base font-semibold tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}
