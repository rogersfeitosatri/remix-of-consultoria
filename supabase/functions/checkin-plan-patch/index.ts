// Fase 3 (v2): o check-in vira um PATCH incremental — NÃO regenera o plano.
// Sinais e decisão de carbload são determinísticos (código); a IA é usada só
// para escrever a mensagem curta ao atleta. Guarda histórico de versões.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiJson } from "../_shared/planPipeline.ts";
import { requireAdmin, assertClientOwnership } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Mapeia respostas do check-in (texto) para SINAIS estruturados.
function extractSignals(text: string): string[] {
  const t = text.toLowerCase();
  const sig = new Set<string>();
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
  if (has("sem energia", "baixa energia", "falta de energia", "energia baixa", "cansad", "queda de energia") && has("long", "longão")) sig.add("ENERGY_LOW_DURING_LONG_RUN");
  if (has("bem de energia", "boa energia", "energia boa", "disposto", "disposição boa")) sig.add("ENERGY_GOOD");
  if (has("terminei forte", "acabei bem", "terminei bem")) sig.add("FINISHED_STRONG");
  if (has("caiu o ritmo", "queda de ritmo", "não sustentei", "nao sustentei", "perdi ritmo")) sig.add("PACE_DROP");
  if (has("muita fome", "fome excessiva", "fome intensa")) sig.add("EXCESSIVE_HUNGER");
  if (has("recuperação ruim", "recuperacao ruim", "mal recuperado", "sem recuperar")) sig.add("POOR_RECOVERY");
  if (has("estufad", "inchad", "distens", "empachad")) sig.add("GI_BLOATING");
  if (has("náusea", "nausea", "enjoo", "enjoad")) sig.add("GI_NAUSEA");
  if (has("peso no estômago", "peso no estomago", "estômago cheio", "estomago cheio", "pesado")) sig.add("STOMACH_HEAVINESS");
  if (has("volume alto", "muita comida", "não consigo comer tudo", "nao consigo comer tudo")) sig.add("PLAN_VOLUME_TOO_HIGH");
  if (has("fácil seguir", "facil seguir", "consegui seguir", "tranquilo seguir")) sig.add("CARBLOAD_EASY_TO_FOLLOW");
  if (has("difícil seguir", "dificil seguir", "não consegui seguir", "nao consegui seguir")) sig.add("CARBLOAD_DIFFICULT_TO_FOLLOW");
  if (has("pulei refeição", "pulei refeicao", "não fiz refeições", "nao fiz refeicoes")) sig.add("MISSED_MEALS");
  return Array.from(sig);
}

const GI_SIGNALS = new Set(["GI_BLOATING", "GI_NAUSEA", "STOMACH_HEAVINESS", "PLAN_VOLUME_TOO_HIGH", "CARBLOAD_DIFFICULT_TO_FOLLOW"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { clientId } = await req.json();
    if (!clientId) throw new Error("clientId is required");

    const { data: row } = await supabase.from("ai_analyses").select("id, raw_response").eq("client_id", clientId).maybeSingle();
    let stored: any = null;
    try { stored = row?.raw_response ? JSON.parse(row.raw_response) : null; } catch { /* */ }
    if (!row || stored?.planModelVersion !== 2) {
      return json({ error: "Este atleta não tem plano v2. Gere o plano-base (v2) primeiro." }, 400);
    }

    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();

    // Último check-in → texto + sinais
    const { data: checkin } = await supabase
      .from("checkin_responses").select("responses, form_id, submitted_at")
      .eq("client_id", clientId).order("submitted_at", { ascending: false }).limit(1).maybeSingle();
    if (!checkin) return json({ error: "Nenhum check-in encontrado." }, 400);
    let qById: Record<string, string> = {};
    if (checkin.form_id) {
      const { data: qs } = await supabase.from("checkin_questions").select("id, question_text").eq("form_id", checkin.form_id);
      for (const q of qs || []) qById[q.id] = q.question_text;
    }
    const lines: string[] = [];
    for (const [qid, val] of Object.entries<any>(checkin.responses || {})) {
      const ans = val && typeof val === "object" && "answer" in val ? val.answer : val;
      const comment = val && typeof val === "object" && "comment" in val ? val.comment : null;
      lines.push(`${qById[qid] || qid}: ${Array.isArray(ans) ? ans.join(", ") : ans}${comment ? ` (${comment})` : ""}`);
    }
    const checkinText = lines.join("\n");
    const signals = extractSignals(checkinText);

    // Decisão determinística de carbload
    const currentDays = stored.carbloadOverride?.numberOfDays === 2 ? 2 : 1;
    const gi = signals.some((s) => GI_SIGNALS.has(s));
    const wantEscalate = signals.includes("ENERGY_LOW_DURING_LONG_RUN") && !gi;
    let toDays = currentDays;
    const reasonCodes: string[] = [];
    if (gi) { toDays = 1; reasonCodes.push("GI_INTOLERANCE_KEEP_ONE_DAY"); }
    else if (wantEscalate) { toDays = 2; reasonCodes.push("LOW_ENERGY_DURING_LONG_RUN", "GOOD_GI_TOLERANCE"); }
    const carbloadChange = toDays !== currentDays ? { fromDays: currentDays, toDays, reasonCodes } : null;
    const professionalReviewRequired = signals.includes("GI_NAUSEA") || (gi && signals.includes("POOR_RECOVERY"));

    // 1 chamada de IA — SOMENTE a mensagem ao atleta (curta, humana)
    let summaryForAthlete = "";
    try {
      const r = await callAiJson({
        systemPrompt: "Você é um nutricionista falando com o atleta. Português do Brasil, tom humano e acolhedor, sem jargão, sem culpa. Responda em JSON.",
        userPrompt: `Sinais do check-in: ${JSON.stringify(signals)}.
Ação no carbload: ${carbloadChange ? `${carbloadChange.fromDays}→${carbloadChange.toDays} dia(s) (${reasonCodes.join(", ")})` : "manter"}.
${professionalReviewRequired ? "Há sinal que pede avaliação profissional." : ""}
Escreva SOMENTE {"summaryForAthlete": string} — 2 a 4 frases explicando o ajuste (ou que está mantido) de forma simples, citando naturalmente o que foi observado. Não liste gramas.`,
        perAttemptMs: 40_000,
      });
      summaryForAthlete = String(r.data?.summaryForAthlete || "").slice(0, 600);
    } catch { summaryForAthlete = carbloadChange ? "Fizemos um pequeno ajuste no seu carbload com base no seu último check-in, mantendo os alimentos que você já tolera bem." : "Seu plano segue mantido — está indo bem, sem necessidade de mudanças agora."; }

    // Aplica o patch (sem regenerar o plano)
    const patch = {
      createdAt: new Date().toISOString(), signals,
      carbloadChange, summaryForAthlete, professionalReviewRequired, newMealNotes: [],
    };
    const next = {
      ...stored,
      carbloadOverride: carbloadChange ? { numberOfDays: toDays, reasonCodes } : stored.carbloadOverride ?? null,
      patches: [...(stored.patches || []), patch],
      planVersionNumber: (stored.planVersionNumber || 1) + 1,
      athlete_summary: stored.athlete_summary,
      updatedAt: new Date().toISOString(),
    };
    await supabase.from("ai_analyses").update({ raw_response: JSON.stringify(next), updated_at: new Date().toISOString() }).eq("id", row.id);

    console.log("checkin-plan-patch obs:", JSON.stringify({
      clientId, signals, carbloadChange: carbloadChange ? `${carbloadChange.fromDays}->${carbloadChange.toDays}` : "keep",
      professionalReviewRequired, version: next.planVersionNumber,
    }));

    return json({ success: true, planAction: "patch", signals, carbloadChange, professionalReviewRequired, summaryForAthlete });
  } catch (error) {
    console.error("checkin-plan-patch:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
