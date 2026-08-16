// Processa a fila zn_integration_outbox (retries do Zona Nutri).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ZonaNutriSyncService } from "../_shared/zn/ZonaNutriSyncService.ts";
import { requireInternal, denied, logSecurityEvent, restrictedCors } from "../_shared/authGuard.ts";

Deno.serve(async (req) => {
  const corsHeaders = restrictedCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ETAPA 6A — C. INTERNAL/CRON: nenhuma chamada anônima executa este processador.
  const guard = await requireInternal(req);
  if (!guard.ok) {
    await logSecurityEvent({ eventType: 'processor_invocation_denied', fn: 'zn-sync-retry' });
    return denied(guard, corsHeaders);
  }

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
