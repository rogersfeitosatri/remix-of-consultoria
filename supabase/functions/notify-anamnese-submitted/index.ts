// Lightweight endpoint to fire push notification when an authenticated athlete
// submits (or re-submits) an anamnese. The full pipeline lives in
// process-anamnese-submission (used by the public form).
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
    const { client_id } = await req.json();
    if (!client_id || typeof client_id !== "string") {
      return json({ error: "client_id obrigatório" }, 400);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: client, error } = await supabase
      .from("clients")
      .select("id, name, user_id")
      .eq("id", client_id)
      .maybeSingle();
    if (error || !client?.user_id) {
      console.warn("[notify-anamnese-submitted] cliente sem owner:", error);
      return json({ ok: false, skipped: true }, 200);
    }
    const result = await notifyUser(supabase, client.user_id, {
      prefKey: "anamnese_submitted",
      title: "📋 Anamnese recebida",
      body: `${client.name} enviou a anamnese.`,
      url: `/clients/${client.id}`,
    });
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("[notify-anamnese-submitted] erro:", e);
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
