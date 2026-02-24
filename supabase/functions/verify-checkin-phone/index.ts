import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VerifyRequest = {
  clientId?: string;
  phone: string;
};

function normalizePhoneToE164(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  while (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // If user pasted +55..., we already have 55 in digits.
  // If user pasted local (DDD+number), enforce Brazil DDI.
  if (!digits.startsWith("55")) {
    digits = `55${digits}`;
  }

  return `+${digits}`;
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = (await req.json()) as VerifyRequest;

    if (!body?.phone || typeof body.phone !== "string") {
      return new Response(JSON.stringify({ valid: false, error: "PHONE_REQUIRED" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inputDigits = body.phone.replace(/\D/g, "");
    const hasDDI = inputDigits.startsWith("55");
    const validLength =
      (hasDDI && (inputDigits.length === 12 || inputDigits.length === 13)) ||
      (!hasDDI && (inputDigits.length === 10 || inputDigits.length === 11));

    if (!validLength) {
      return new Response(JSON.stringify({ valid: false, error: "PHONE_INVALID" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedInput = normalizePhoneToE164(body.phone);

    // If clientId is provided, try strict validation first.
    // If it fails (stale/wrong clientId), fallback to phone lookup.
    if (body.clientId && typeof body.clientId === "string" && isUuid(body.clientId)) {
      const { data: client, error } = await supabase
        .from("clients")
        .select("id, phone")
        .eq("id", body.clientId)
        .maybeSingle();

      if (!error && client?.phone) {
        const normalizedDb = normalizePhoneToE164(client.phone);
        const ok = normalizedDb === normalizedInput;

        if (ok) {
          return new Response(JSON.stringify({ valid: true, clientId: client.id }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Fallback: find client by phone (also covers stale/invalid ?client=...)
    // Fetch in pages to avoid missing matches in larger datasets.
    const pageSize = 1000;
    let from = 0;
    let matchedClientId: string | null = null;

    while (true) {
      const to = from + pageSize - 1;
      const { data: candidates, error: candError } = await supabase
        .from("clients")
        .select("id, phone")
        .not("phone", "is", null)
        .range(from, to);

      if (candError) {
        return new Response(JSON.stringify({ valid: false, clientId: null }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!candidates?.length) break;

      const match = candidates.find((c) => c.phone && normalizePhoneToE164(c.phone) === normalizedInput);
      if (match?.id) {
        matchedClientId = match.id;
        break;
      }

      if (candidates.length < pageSize) break;
      from += pageSize;
    }

    return new Response(JSON.stringify({ valid: !!matchedClientId, clientId: matchedClientId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[verify-checkin-phone] Error:", error);
    return new Response(JSON.stringify({ valid: false, error: "INTERNAL" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
