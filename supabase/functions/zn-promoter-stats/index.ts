// Painel PÚBLICO do criador/influenciador: dado o ref_code do promoter, retorna
// APENAS a contagem de quantas pessoas usaram o(s) cupom(ns) dele. NUNCA expõe
// nomes, e-mails ou qualquer dado de quem usou — só números agregados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const ref = (url.searchParams.get("ref") || "").trim().toLowerCase();
    let body: any = {};
    if (req.method === "POST") { try { body = await req.json(); } catch { /* */ } }
    const refCode = ref || String(body.ref ?? "").trim().toLowerCase();
    if (!refCode) return json({ error: "ref_required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Localiza o criador pelo ref_code (não revela e-mail/contato).
    const { data: promoter } = await supabase
      .from("zn_promoters")
      .select("id, name, handle")
      .ilike("ref_code", refCode)
      .maybeSingle();
    if (!promoter) return json({ error: "not_found" }, 404);

    // Cupons do criador (só código + total de usos — sem quem usou).
    const { data: coupons } = await supabase
      .from("zn_coupons")
      .select("id, code, uses_count")
      .eq("promoter_id", promoter.id);

    // Contagem de resgates atribuídos ao criador (fonte granular).
    const { count: redemptionCount } = await supabase
      .from("zn_coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promoter_id", promoter.id);

    const byCoupon = (coupons || []).map((c: any) => ({
      code: c.code,
      uses: Number(c.uses_count) || 0,
    }));
    const sumUses = byCoupon.reduce((a, c) => a + c.uses, 0);
    // Usa a maior contagem entre resgates e soma de uses_count (robusto).
    const totalUses = Math.max(Number(redemptionCount) || 0, sumUses);

    return json({
      promoter: { name: promoter.name, handle: promoter.handle ?? null },
      total_uses: totalUses,
      by_coupon: byCoupon,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
