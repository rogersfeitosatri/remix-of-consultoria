// Auth helper para a API pública de integrações.
// Aceita "Authorization: Bearer <key>" ou "x-api-key: <key>".
// Chaves válidas vêm de INTEGRATIONS_API_KEY (comma-separated para permitir
// mais de um consumidor no futuro sem refatorar).
export interface AuthResult {
  ok: boolean;
  source_system: string | null;
  reason?: string;
}

export function authenticate(req: Request): AuthResult {
  const raw = Deno.env.get("INTEGRATIONS_API_KEY") ?? "";
  const keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    return { ok: false, source_system: null, reason: "server_missing_api_key" };
  }

  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  const apiKey = req.headers.get("x-api-key")?.trim() ?? null;
  const provided = bearer ?? apiKey;

  if (!provided) {
    return { ok: false, source_system: null, reason: "missing_credentials" };
  }
  if (!keys.includes(provided)) {
    return { ok: false, source_system: null, reason: "invalid_credentials" };
  }

  const sourceSystem =
    req.headers.get("x-source-system") ??
    req.headers.get("user-agent") ??
    "unknown";

  return { ok: true, source_system: sourceSystem };
}
