// Envia um push de teste para o usuário autenticado (ou userId informado).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { notifyUser } from "../_shared/fcm.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let userId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    userId = body?.userId ?? null;
  } catch { /* noop */ }

  if (!userId) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "userId ausente" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await notifyUser(supabase, userId, {
    prefKey: "__test__",
    title: "🔔 Teste de notificação",
    body: "Se você recebeu isso, o push está funcionando ✅",
    url: "/",
  });

  return new Response(JSON.stringify({ ok: true, userId, ...result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
