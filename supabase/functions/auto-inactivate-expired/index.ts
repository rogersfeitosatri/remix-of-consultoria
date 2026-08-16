import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireInternal, denied, logSecurityEvent, restrictedCors } from "../_shared/authGuard.ts";

Deno.serve(async (req) => {
  const corsHeaders = restrictedCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ETAPA 6A — C. INTERNAL/CRON: nenhuma chamada anônima executa este processador.
  const guard = await requireInternal(req);
  if (!guard.ok) {
    await logSecurityEvent({ eventType: 'processor_invocation_denied', fn: 'auto-inactivate-expired' });
    return denied(guard, corsHeaders);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // Find active clients whose plan has expired and are NOT frozen
    const { data: expiredClients, error: fetchError } = await supabase
      .from("clients")
      .select("id, name, end_date")
      .eq("is_active", true)
      .lt("end_date", today)
      .or("is_frozen.is.null,is_frozen.eq.false");

    if (fetchError) {
      console.error("Error fetching expired clients:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!expiredClients || expiredClients.length === 0) {
      console.log("No expired clients to inactivate.");
      return new Response(
        JSON.stringify({ message: "No expired clients", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ids = expiredClients.map((c: any) => c.id);

    const { error: updateError } = await supabase
      .from("clients")
      .update({ is_active: false })
      .in("id", ids);

    if (updateError) {
      console.error("Error updating clients:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Auto-inactivated ${ids.length} clients:`, expiredClients.map((c: any) => c.name));

    return new Response(
      JSON.stringify({
        message: `Inactivated ${ids.length} expired clients`,
        count: ids.length,
        clients: expiredClients.map((c: any) => ({ id: c.id, name: c.name, end_date: c.end_date })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
