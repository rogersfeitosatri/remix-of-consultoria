// Envia o plano alimentar da Consultoria para o Zona Nutri.
// Mapeia o plano base + variações por dia (meal_plan.day_variations) para os
// dias da semana no formato do endpoint do Zona Nutri.
//
// Secrets: ZONA_NUTRI_MEAL_PLAN_URL (endpoint do plano) e ZONA_NUTRI_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WEEKDAYS: { key: string; weekday: string; label: string }[] = [
  { key: "seg", weekday: "monday", label: "Segunda" },
  { key: "ter", weekday: "tuesday", label: "Terça" },
  { key: "qua", weekday: "wednesday", label: "Quarta" },
  { key: "qui", weekday: "thursday", label: "Quinta" },
  { key: "sex", weekday: "friday", label: "Sexta" },
  { key: "sab", weekday: "saturday", label: "Sábado" },
  { key: "dom", weekday: "sunday", label: "Domingo" },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Converte uma refeição do formato da consultoria para o formato do Zona Nutri.
function mapMeal(meal: any, order: number) {
  const groupsSrc = (meal.options?.[0]?.food_groups) || meal.food_groups || [];
  const groups = (groupsSrc || []).map((g: any) => ({
    group: g.group ?? "",
    // "pão (100g) ou tapioca (80g)" → opções intercambiáveis
    options: String(g.options ?? "")
      .split(/\s+ou\s+/i)
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((food: string) => ({ food })),
  }));
  return {
    order,
    name: meal.meal_name ?? "",
    time: meal.horario ?? meal.time ?? null,
    timing_note: meal.timing_note ?? null,
    groups,
    macros_text: meal.meal_macros ?? meal.options?.[0]?.meal_macros ?? null,
  };
}

function mapMeals(meals: any[]) {
  return (meals || []).map((m, i) => mapMeal(m, i + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const MEAL_PLAN_URL = Deno.env.get("ZONA_NUTRI_MEAL_PLAN_URL");
    const API_KEY = Deno.env.get("CONSULTORIA_API_KEY");
    if (!MEAL_PLAN_URL) throw new Error("ZONA_NUTRI_MEAL_PLAN_URL não configurada.");
    if (!API_KEY) throw new Error("CONSULTORIA_API_KEY não configurada.");

    const { clientId } = await req.json();
    if (!clientId) throw new Error("clientId is required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Error("Cliente não encontrado");

    const { data: analysis } = await supabase
      .from("ai_analyses").select("*").eq("client_id", clientId).maybeSingle();
    let plan: any = null;
    try { plan = analysis?.raw_response ? JSON.parse(analysis.raw_response) : null; } catch { /* */ }
    if (!plan?.meal_plan?.meals) throw new Error("Não há plano alimentar para enviar.");

    // Localiza o atleta ZN correspondente (mesmo e-mail) para o external_id.
    const { data: znAthlete } = await supabase
      .from("zn_athletes").select("id, email, name, phone, cpf_cnpj")
      .eq("email", (client.email || "").toLowerCase()).maybeSingle();

    const base = plan.meal_plan;
    const variations = base.day_variations || {};
    const hasVariations = Object.keys(variations).length > 0;

    const days = hasVariations
      ? WEEKDAYS.map((wd) => {
          const v = variations[wd.key];
          return {
            weekday: wd.weekday,
            label: wd.label,
            meals: mapMeals(v?.meals ?? base.meals),
            daily_totals: v?.daily_totals ?? base.daily_totals ?? null,
          };
        })
      : [{ weekday: "all", label: "Todos os dias", meals: mapMeals(base.meals), daily_totals: base.daily_totals ?? null }];

    const payload = {
      event: "meal_plan.published",
      sent_at: new Date().toISOString(),
      source: "consultoria",
      athlete: {
        // Não enviamos external_id: o id local do zn_athletes não corresponde
        // ao id do atleta dentro do Zona Nutri. O ZN deve resolver por email/cpf.
        email: (client.email || "").toLowerCase(),
        name: client.name ?? znAthlete?.name ?? null,
        cpf: (znAthlete?.cpf_cnpj ?? (client as any).cpf ?? null),
      },
      nutritionist: { name: "Rogers Feitosa", crn: "CRN 14885" },
      plan: {
        plan_id: analysis?.id,
        version: Math.floor(new Date(analysis?.updated_at || Date.now()).getTime() / 1000),
        issued_at: (analysis?.updated_at || new Date().toISOString()).slice(0, 10),
        objective: plan.athlete_summary ?? "",
        weekly_structure: hasVariations ? "per_day" : "single",
        days,
        strategic_orientations: plan.strategic_orientations ?? {},
        athlete_message: plan.adjustment_message ?? "",
      },
    };

    const res = await fetch(MEAL_PLAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "Idempotency-Key": `${analysis?.id}:${payload.plan.version}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      let znError: string | null = null;
      try { znError = JSON.parse(text)?.error ?? null; } catch { /* */ }
      if (znError === "athlete_not_found") {
        return json({
          error: "ATHLETE_NOT_FOUND",
          message: `Este atleta (${(client.email || "").toLowerCase()}) ainda não existe no Zona Nutri. Peça para ele criar a conta no app Zona Nutri com o mesmo e-mail antes de reenviar o plano.`,
          fallback: true,
        }, 200);
      }
      return json({ error: `Zona Nutri respondeu ${res.status}: ${text.slice(0, 500)}`, fallback: res.status >= 500 }, res.status >= 500 ? 200 : 502);
    }

    // Marca envio no plano (para o admin ver que foi enviado)
    try {
      const updated = { ...plan, zona_nutri_sent_at: new Date().toISOString() };
      await supabase.from("ai_analyses").update({ raw_response: JSON.stringify(updated) }).eq("id", analysis.id);
    } catch { /* não bloqueia */ }

    return json({ success: true, sent: true, response: safeJson(text) });
  } catch (error) {
    console.error("send-meal-plan-to-zona-nutri error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});

function safeJson(s: string) { try { return JSON.parse(s); } catch { return s; } }
