// Envia o plano alimentar da Consultoria para o Zona Nutri.
// Mapeia o plano base + variações por dia (meal_plan.day_variations) para os
// dias da semana no formato do endpoint do Zona Nutri.
//
// Secrets: ZONA_NUTRI_MEAL_PLAN_URL (endpoint do plano) e CONSULTORIA_API_KEY.
// Opcional: ZONA_NUTRI_SYNC_URL. Se ausente, é derivada do endpoint do plano.
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

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

function onlyDigits(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function deriveSyncUrl(mealPlanUrl: string) {
  const explicit = Deno.env.get("ZONA_NUTRI_SYNC_URL")?.trim();
  if (explicit) return explicit;
  return mealPlanUrl.replace(/\/consultoria-meal-plan\/?$/, "/consultoria-sync");
}

async function readResponse(res: Response) {
  const text = await res.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { text, body };
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

async function findOrCreateLocalZnAthlete(supabase: any, client: any, email: string) {
  const ownerUserId = client.user_id;
  const selectCols = "id, user_id, email, name, phone, cpf_cnpj, status, plan_choice, metadata";

  let query = supabase.from("zn_athletes").select(selectCols).eq("email", email);
  if (ownerUserId) query = query.eq("user_id", ownerUserId);
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing;

  const insertPayload = {
    user_id: ownerUserId,
    email,
    name: client.name ?? email.split("@")[0],
    phone: onlyDigits(client.phone),
    cpf_cnpj: onlyDigits(client.cpf ?? client.cpf_cnpj),
    status: client.is_active ? "active" : "pending",
    plan_choice: client.plan_type ?? client.plan_duration ?? null,
    metadata: { consultoria_client_id: client.id },
  };
  const { data: created, error } = await supabase
    .from("zn_athletes")
    .insert(insertPayload)
    .select(selectCols)
    .single();

  if (!error && created) return created;

  // Corrida de inserção/unique: tenta carregar novamente e deixa o envio seguir.
  let retry = supabase.from("zn_athletes").select(selectCols).eq("email", email);
  if (ownerUserId) retry = retry.eq("user_id", ownerUserId);
  const { data: afterRace } = await retry.maybeSingle();
  return afterRace ?? null;
}

async function ensureZonaNutriProfile(params: {
  syncUrl: string;
  apiKey: string;
  client: any;
  znAthlete: any;
  email: string;
}) {
  const { syncUrl, apiKey, client, znAthlete, email } = params;
  if (!syncUrl || !syncUrl.includes("/consultoria-sync")) {
    return { ok: false, skipped: true, error: "ZONA_NUTRI_SYNC_URL inválida ou não configurada" };
  }

  const payload = {
    evento: "subscription_created",
    athleteId: znAthlete.id,
    nome: client.name ?? znAthlete.name ?? email.split("@")[0],
    email,
    telefone: onlyDigits(client.phone ?? znAthlete.phone),
    plano: client.plan_type ?? znAthlete.plan_choice ?? client.plan_duration ?? "consultoria",
    status: client.is_active === false ? "inactive" : "active",
    dataInicio: client.start_date ?? new Date().toISOString().slice(0, 10),
    dataExpiracao: client.end_date ?? null,
    eventId: `meal-plan-profile-link:${znAthlete.id}:${client.updated_at ?? client.id}`,
  };

  try {
    const res = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": payload.eventId,
      },
      body: JSON.stringify(payload),
    });
    const parsed = await readResponse(res);
    return { ok: res.ok && parsed.body?.success !== false, status: res.status, response: parsed.body };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const MEAL_PLAN_URL = Deno.env.get("ZONA_NUTRI_MEAL_PLAN_URL")?.trim();
    const API_KEY = Deno.env.get("CONSULTORIA_API_KEY");
    if (!MEAL_PLAN_URL) throw new Error("ZONA_NUTRI_MEAL_PLAN_URL não configurada.");
    if (!API_KEY) throw new Error("CONSULTORIA_API_KEY não configurada.");
    const SYNC_URL = deriveSyncUrl(MEAL_PLAN_URL);

    const { clientId } = await req.json();
    if (!clientId) throw new Error("clientId is required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Error("Cliente não encontrado");
    const email = normalizeEmail(client.email);
    if (!email) throw new Error("Cliente sem e-mail; não é possível vincular ao Zona Nutri.");

    const { data: analysis } = await supabase
      .from("ai_analyses").select("*").eq("client_id", clientId).maybeSingle();
    let plan: any = null;
    try { plan = analysis?.raw_response ? JSON.parse(analysis.raw_response) : null; } catch { /* */ }
    if (!plan?.meal_plan?.meals) throw new Error("Não há plano alimentar para enviar.");

    // O endpoint do Zona Nutri resolve primeiro por external_id
    // (profiles.consultoria_athlete_id). Portanto, antes de enviar o plano,
    // garantimos o vínculo remoto por e-mail e reenviamos o ID local correto.
    const znAthlete = await findOrCreateLocalZnAthlete(supabase, client, email);
    if (!znAthlete?.id) throw new Error("Não foi possível preparar o vínculo local do atleta Zona Nutri.");
    const preSync = await ensureZonaNutriProfile({
      syncUrl: SYNC_URL,
      apiKey: API_KEY,
      client,
      znAthlete,
      email,
    });

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
        // O Zona Nutri lê "zn:<id>" como consultoria_athlete_id e usa e-mail
        // apenas como fallback. Sem esse external_id, usuários já existentes por
        // e-mail podem cair em athlete_not_found dependendo da versão da API ZN.
        external_id: `zn:${znAthlete.id}`,
        email,
        name: client.name ?? znAthlete?.name ?? null,
        cpf: (znAthlete?.cpf_cnpj ?? onlyDigits((client as any).cpf ?? (client as any).cpf_cnpj)),
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

    const sendPlan = () => fetch(MEAL_PLAN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "Idempotency-Key": `${analysis?.id}:${payload.plan.version}`,
      },
      body: JSON.stringify(payload),
    });

    let res = await sendPlan();
    let { text, body: responseBody } = await readResponse(res);
    if (!res.ok) {
      let znError: string | null = null;
      try { znError = typeof responseBody === "object" ? responseBody?.error ?? null : null; } catch { /* */ }
      if (znError === "athlete_not_found") {
        // Self-healing final: força novamente o vínculo e tenta o plano uma vez
        // mais. Isso cobre casos em que a conta já existia no ZN, mas ainda não
        // estava com consultoria_athlete_id preenchido.
        const syncAgain = preSync.ok ? preSync : await ensureZonaNutriProfile({
          syncUrl: SYNC_URL,
          apiKey: API_KEY,
          client,
          znAthlete,
          email,
        });
        if (syncAgain.ok) {
          res = await sendPlan();
          ({ text, body: responseBody } = await readResponse(res));
          if (res.ok) {
            try {
              const updated = { ...plan, zona_nutri_sent_at: new Date().toISOString() };
              await supabase.from("ai_analyses").update({ raw_response: JSON.stringify(updated) }).eq("id", analysis.id);
            } catch { /* não bloqueia */ }
            return json({ success: true, sent: true, linked: true, response: responseBody });
          }
        }
        return json({
          error: "ATHLETE_NOT_FOUND",
          message: `Não foi possível localizar/vincular ${email} no Zona Nutri automaticamente. Verifique se a conta do atleta no Zona Nutri usa exatamente este e-mail e tente novamente.`,
          fallback: true,
          sync: syncAgain,
        }, 200);
      }
      return json({ error: `Zona Nutri respondeu ${res.status}: ${text.slice(0, 500)}`, fallback: res.status >= 500 }, res.status >= 500 ? 200 : 502);
    }

    // Marca envio no plano (para o admin ver que foi enviado)
    try {
      const updated = { ...plan, zona_nutri_sent_at: new Date().toISOString() };
      await supabase.from("ai_analyses").update({ raw_response: JSON.stringify(updated) }).eq("id", analysis.id);
    } catch { /* não bloqueia */ }

    return json({ success: true, sent: true, linked: preSync.ok, response: responseBody });
  } catch (error) {
    console.error("send-meal-plan-to-zona-nutri error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});

function safeJson(s: string) { try { return JSON.parse(s); } catch { return s; } }
