// Processa a fila zn_integration_outbox (retries do Zona Nutri).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ZonaNutriSyncService } from "../_shared/zn/ZonaNutriSyncService.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "25");
    const zn = new ZonaNutriSyncService(supabase);
    const result = await zn.processDueQueue(limit);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[zn-sync-retry] error:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
