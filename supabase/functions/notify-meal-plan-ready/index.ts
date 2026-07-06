// Push notification para o ATLETA quando o plano alimentar é publicado/atualizado.
// O plano já aparece no app assim que salvo (RLS); esta função apenas avisa o atleta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { notifyUser } from "../_shared/fcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { client_id, is_first_time } = await req.json();
    if (!client_id || typeof client_id !== "string") {
      return json({ error: "client_id obrigatório" }, 400);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: client, error } = await supabase
      .from("clients")
      .select("id, name, athlete_user_id")
      .eq("id", client_id)
      .maybeSingle();
    if (error || !client) {
      return json({ error: "cliente não encontrado" }, 404);
    }
    if (!client.athlete_user_id) {
      // Atleta ainda não acessou/vinculou a conta — não há para quem notificar.
      return json({ ok: false, skipped: true, reason: "athlete_not_linked" }, 200);
    }

    const firstName = String(client.name || "").split(" ")[0] || "";
    const result = await notifyUser(supabase, client.athlete_user_id, {
      prefKey: "meal_plan_updated",
      title: is_first_time ? "🍽️ Seu plano alimentar está pronto!" : "🍽️ Plano alimentar atualizado",
      body: is_first_time
        ? `${firstName}, seu nutricionista montou seu plano. Toque para ver.`
        : `${firstName}, seu plano foi atualizado. Confira as novidades.`,
      url: "/athlete",
    });
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("[notify-meal-plan-ready] erro:", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
