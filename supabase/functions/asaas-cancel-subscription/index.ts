// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase();
const ASAAS_BASE =
  ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabaseUser.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id } = await req.json();
    const { data: client } = await supabase
      .from("clients")
      .select("id, asaas_subscription_id")
      .eq("id", client_id)
      .single();

    if (!client?.asaas_subscription_id) {
      throw new Error("Atleta não possui assinatura Asaas ativa");
    }

    const res = await fetch(
      `${ASAAS_BASE}/subscriptions/${client.asaas_subscription_id}`,
      { method: "DELETE", headers: { access_token: ASAAS_API_KEY } },
    );
    if (!res.ok) throw new Error(`Asaas [${res.status}]: ${await res.text()}`);

    await supabase
      .from("clients")
      .update({
        asaas_subscription_id: null,
        asaas_subscription_status: "CANCELLED",
      })
      .eq("id", client_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("asaas-cancel-subscription:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
