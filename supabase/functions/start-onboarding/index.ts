import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StartOnboardingRequest {
  plan_slug: string;
  name: string;
  email: string;
  phone: string;
}

// Sanitize BR phone to E.164 digits (12 or 13 starting with 55)
function sanitizeBrPhone(raw: string): { ok: true; phone: string } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: "Telefone obrigatório" };
  let d = String(raw).replace(/\D/g, "");
  while (d.startsWith("0")) d = d.substring(1);
  if (d.length >= 14 && d.startsWith("5555")) d = d.substring(2);
  if (!d.startsWith("55")) d = "55" + d;
  if (d.length === 12 || d.length === 13) return { ok: true, phone: d };
  return { ok: false, reason: "Telefone inválido (use DDD + número)" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json()) as StartOnboardingRequest;
    const plan_slug = (body.plan_slug || "").trim();
    const name = (body.name || "").trim();
    const email = (body.email || "").toLowerCase().trim();
    const phoneCheck = sanitizeBrPhone(body.phone || "");

    if (!plan_slug || !name || !email) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!phoneCheck.ok) {
      return new Response(JSON.stringify({ error: phoneCheck.reason }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const phone = "+" + phoneCheck.phone;

    // 1) Load plan
    const { data: plan, error: planErr } = await admin
      .from("onboarding_plans")
      .select("id, slug, name, category, periodicity, duration_months, payment_link, price, is_active")
      .eq("slug", plan_slug)
      .eq("is_active", true)
      .maybeSingle();

    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // payment_link will be sent only AFTER anamnese is completed,
    // so we just warn in logs if missing (admin will see in notify message).

    // 2) Find onboarding settings to get admin user_id + anamnese_form_id
    const { data: settings, error: settingsErr } = await admin
      .from("onboarding_payment_settings")
      .select("user_id, anamnese_form_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (settingsErr || !settings?.user_id) {
      return new Response(
        JSON.stringify({ error: "Configurações de onboarding não inicializadas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const adminUserId = settings.user_id;

    // 3) Find or create client (scoped to this admin)
    const { data: existing } = await admin
      .from("clients")
      .select("id, onboarding_status, selected_plan_id")
      .eq("user_id", adminUserId)
      .ilike("email", email)
      .limit(1);

    const today = new Date().toISOString().split("T")[0];
    let clientId: string;
    let clientCreated = false;

    if (existing && existing.length > 0) {
      clientId = existing[0].id;
      // Update with new plan selection — payment link sent only after anamnese
      await admin
        .from("clients")
        .update({
          name,
          phone,
          selected_plan_id: plan.id,
          onboarding_status: "awaiting_anamnese",
          registration_source: "onboarding_self",
        })
        .eq("id", clientId);
    } else {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (plan.duration_months || 3));
      const endDateStr = endDate.toISOString().split("T")[0];

      const { data: created, error: createErr } = await admin
        .from("clients")
        .insert({
          user_id: adminUserId,
          name,
          email,
          phone,
          service_type: "nutrition",
          plan_type: "consultoria",
          start_date: today,
          end_date: endDateStr,
          monthly_value: 0,
          is_active: false,
          has_checkin: false,
          athlete_status: "pending_plan",
          registration_source: "onboarding_self",
          selected_plan_id: plan.id,
          onboarding_status: "awaiting_anamnese",
        })
        .select("id")
        .single();

      if (createErr || !created) {
        console.error("Error creating client:", createErr);
        return new Response(JSON.stringify({ error: "Erro ao registrar atleta" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      clientId = created.id;
      clientCreated = true;

      await admin.from("athlete_profiles").insert({
        client_id: clientId,
        full_name: name,
      });
    }

    // Notify admin (best-effort)
    try {
      const adminPhone = "+5599984817697";
      const zapiInstance = Deno.env.get("ZAPI_INSTANCE_ID");
      const zapiToken = Deno.env.get("ZAPI_TOKEN");
      const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
      if (zapiInstance && zapiToken && zapiClientToken) {
        const msg = `🆕 Novo onboarding\n\n👤 ${name}\n📧 ${email}\n📱 ${phone}\n📋 Plano: ${plan.name}\n\n${clientCreated ? "Atleta criado" : "Atleta existente atualizado"} • Aguardando envio da anamnese para liberar o link de pagamento.`;
        await fetch(
          `https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/send-text`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": zapiClientToken,
            },
            body: JSON.stringify({
              phone: adminPhone.replace(/\D/g, ""),
              message: msg,
            }),
          }
        );
      }
    } catch (e) {
      console.warn("Admin notify failed:", e);
    }

    const whatsappSent = false;
    const whatsappError: string | null = null;


    return new Response(
      JSON.stringify({
        success: true,
        client_id: clientId,
        client_created: clientCreated,
        whatsapp_sent: whatsappSent,
        whatsapp_error: whatsappError,
        anamnese_form_id: settings.anamnese_form_id,
        plan_name: plan.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("start-onboarding fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
