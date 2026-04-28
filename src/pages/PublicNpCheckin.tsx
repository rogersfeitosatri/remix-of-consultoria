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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Trophy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CheckinQuestion } from "@/hooks/useCheckinForms";

interface Ctx {
  link_id: string;
  client_id: string;
  client_name: string;
  admin_user_id: string;
  race_name: string | null;
  race_date: string | null;
  checkin_form_id: string | null;
  checkin_form_title: string | null;
}

export default function PublicNpCheckin() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [questions, setQuestions] = useState<CheckinQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core metrics (always shown)
  const [adherence, setAdherence] = useState<number>(80);
  const [gi, setGi] = useState<number>(2);
  const [energy, setEnergy] = useState<number>(7);
  const [sleep, setSleep] = useState<number>(7);
  const [weight, setWeight] = useState<string>("");
  const [mileage, setMileage] = useState<string>("");
  const [longRun, setLongRun] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  // Dynamic answers (form-driven)
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

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
      const context = data[0] as Ctx;
      setCtx(context);

      // Load dynamic questions if a form is linked
      if (context.checkin_form_id) {
        const { data: qs } = await supabase
          .from("checkin_questions")
          .select("*")
          .eq("form_id", context.checkin_form_id)
          .order("order_index", { ascending: true });
        if (mounted) setQuestions((qs || []) as CheckinQuestion[]);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  function setAnswer(qid: string, value: any) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }
  function setComment(qid: string, value: string) {
    setComments((prev) => ({ ...prev, [qid]: value }));
  }

  function validateRequired(): string | null {
    for (const q of questions) {
      if (!q.is_required) continue;
      const v = answers[q.id];
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) {
        return `Responda: "${q.question_text}"`;
      }
      if (q.has_comment_field && q.comment_field_required) {
        const c = comments[q.id];
        if (!c || !c.trim()) return `Comente em: "${q.question_text}"`;
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const err = validateRequired();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      // Build dynamic responses payload
      const dynamicResponses: Record<string, any> = {};
      questions.forEach((q) => {
        const v = answers[q.id];
        if (v == null || v === "") return;
        if (q.has_comment_field && comments[q.id]?.trim()) {
          dynamicResponses[q.id] = { value: v, comment: comments[q.id].trim() };
        } else {
          dynamicResponses[q.id] = v;
        }
      });

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
            form_id: ctx?.checkin_form_id ?? null,
            dynamic_responses: dynamicResponses,
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
                {ctx?.checkin_form_title || "Check-in de Periodização Nutricional"}
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

          {/* Dynamic questions from admin form */}
          {questions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Perguntas adicionais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {questions.map((q) => (
                  <DynamicQuestion
                    key={q.id}
                    question={q}
                    value={answers[q.id]}
                    comment={comments[q.id] || ""}
                    onValueChange={(v) => setAnswer(q.id, v)}
                    onCommentChange={(v) => setComment(q.id, v)}
                  />
                ))}
              </CardContent>
            </Card>
          )}

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

function DynamicQuestion({
  question,
  value,
  comment,
  onValueChange,
  onCommentChange,
}: {
  question: CheckinQuestion;
  value: any;
  comment: string;
  onValueChange: (v: any) => void;
  onCommentChange: (v: string) => void;
}) {
  const opts = (question.options || []) as string[];
  return (
    <div className="space-y-2">
      <Label className="text-sm">
        {question.question_text}
        {question.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {question.question_type === "short_text" && (
        <Input value={value || ""} onChange={(e) => onValueChange(e.target.value)} />
      )}

      {question.question_type === "long_text" && (
        <Textarea
          rows={3}
          value={value || ""}
          onChange={(e) => onValueChange(e.target.value)}
        />
      )}

      {question.question_type === "scale" && (
        <SliderField
          label=""
          value={typeof value === "number" ? value : question.scale_min}
          onChange={onValueChange}
          min={question.scale_min}
          max={question.scale_max}
        />
      )}

      {question.question_type === "multiple_choice" && (
        <RadioGroup value={value || ""} onValueChange={onValueChange}>
          {opts.map((o, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value={o} id={`${question.id}-${i}`} />
              <span className="text-sm">{o}</span>
            </label>
          ))}
        </RadioGroup>
      )}

      {question.question_type === "checkbox" && (
        <div className="space-y-2">
          {opts.map((o, i) => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const checked = arr.includes(o);
            return (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (c) onValueChange([...arr, o]);
                    else onValueChange(arr.filter((x) => x !== o));
                  }}
                />
                <span className="text-sm">{o}</span>
              </label>
            );
          })}
        </div>
      )}

      {question.has_comment_field && (
        <div className="pt-2">
          <Label className="text-xs text-muted-foreground">
            {question.comment_field_label || "Comente"}
            {question.comment_field_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {question.comment_field_type === "medium" ? (
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
            />
          ) : (
            <Input
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
            />
          )}
        </div>
      )}
    </div>
  );
}
