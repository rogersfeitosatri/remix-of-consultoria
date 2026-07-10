// Auth helper para a API pública de integrações.
// Aceita "Authorization: Bearer <key>" ou "x-api-key: <key>".
// Chaves válidas podem vir de:
//   1) secret INTEGRATIONS_API_KEY (comma-separated) — legado
//   2) tabela public.zn_integration_api_keys (gerenciadas via UI ZN Assessoria)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AuthResult {
  ok: boolean;
  source_system: string | null;
  reason?: string;
  key_id?: string;
}

export async function authenticate(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthResult> {
  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  const apiKey = req.headers.get("x-api-key")?.trim() ?? null;
  const provided = bearer ?? apiKey;

  if (!provided) {
    return { ok: false, source_system: null, reason: "missing_credentials" };
  }

  // 1) Secret legado
  const raw = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";
  const envKeys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  const matchedEnv = envKeys.includes(provided);

  // 2) Chaves gerenciadas no banco (não revogadas)
  let matchedDbId: string | null = null;
  if (!matchedEnv) {
    const { data } = await supabase
      .from("zn_integration_api_keys")
      .select("id")
      .eq("key", provided)
      .is("revoked_at", null)
      .maybeSingle();
    if (data?.id) matchedDbId = data.id;
  }

  if (!matchedEnv && !matchedDbId) {
    return { ok: false, source_system: null, reason: "invalid_credentials" };
  }

  // Atualiza last_used_at (best-effort)
  if (matchedDbId) {
    supabase
      .from("zn_integration_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", matchedDbId)
      .then(() => {});
  }

  const sourceSystem =
    req.headers.get("x-source-system") ??
    req.headers.get("user-agent") ??
    "unknown";

  return { ok: true, source_system: sourceSystem, key_id: matchedDbId ?? undefined };
}
