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

    // If clientId is provided, validate specifically against that client.
    if (body.clientId && typeof body.clientId === "string" && isUuid(body.clientId)) {
      const { data: client, error } = await supabase
        .from("clients")
        .select("id, phone")
        .eq("id", body.clientId)
        .maybeSingle();

      if (error || !client?.phone) {
        return new Response(JSON.stringify({ valid: false, clientId: null }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedDb = normalizePhoneToE164(client.phone);
      const ok = normalizedDb === normalizedInput;

      return new Response(JSON.stringify({ valid: ok, clientId: ok ? client.id : null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: find client by phone (used when link does not include ?client=...)
    const normalizedDigits = normalizedInput.replace(/\D/g, "");
    const withoutDDI = normalizedDigits.startsWith("55") ? normalizedDigits.slice(2) : normalizedDigits;
    const last11 = normalizedDigits.slice(-11);

    const { data: candidates, error: candError } = await supabase
      .from("clients")
      .select("id, phone")
      .not("phone", "is", null)
      .or(`phone.ilike.%${normalizedDigits}%,phone.ilike.%${withoutDDI}%,phone.ilike.%${last11}%`)
      .limit(50);

    if (candError || !candidates?.length) {
      return new Response(JSON.stringify({ valid: false, clientId: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = candidates.find((c) => c.phone && normalizePhoneToE164(c.phone) === normalizedInput);

    return new Response(JSON.stringify({ valid: !!match, clientId: match?.id ?? null }), {
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
