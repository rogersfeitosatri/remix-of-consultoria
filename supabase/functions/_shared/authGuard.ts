// ETAPA 6A — Modelo de confiança explícito para edge functions.
//
// Regra: service_role é autorização de INFRAESTRUTURA, nunca identidade de usuário.
// Todo caller externo precisa se autenticar ANTES de a função usar service_role.
//
// Categorias suportadas:
//   A. ADMIN AUTHENTICATED  -> requireAdmin (JWT admin)
//   B. ATHLETE AUTHENTICATED-> requireAthlete (JWT + resolve client por auth.uid())
//   C. INTERNAL / CRON      -> requireInternal (service key, cron secret ou admin)
//   D. SIGNED WEBHOOK       -> validação de token do provedor (na própria função)
//   E. PUBLIC TOKEN-SCOPED  -> token do dispatch/booking (na própria função)
//   F. OAUTH CALLBACK       -> state/PKCE (na própria função)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const publicCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

/** Origens confiáveis do painel administrativo / app do atleta. */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)*rogersfeitosa\.com\.br$/,
  /^https:\/\/([a-z0-9-]+\.)*zonanutri\.com$/,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/,
];

/**
 * CORS restrito: funções administrativas/internas não precisam ser chamáveis
 * por qualquer origem. Chamadas server-to-server (sem Origin) não são afetadas.
 */
export function restrictedCors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = origin && ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
    "Vary": "Origin",
  };
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export type Caller =
  | { kind: "internal" }
  | { kind: "admin"; userId: string }
  | { kind: "athlete"; userId: string };

export interface GuardResult {
  ok: boolean;
  status: number;
  caller?: Caller;
  error?: string;
}

const FORBIDDEN: GuardResult = { ok: false, status: 403, error: "Forbidden" };
const UNAUTHORIZED: GuardResult = { ok: false, status: 401, error: "Unauthorized" };

function bearer(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

/** Chamada interna: service role key OU cron secret válido. */
export async function isInternalCall(req: Request): Promise<boolean> {
  const token = bearer(req);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return true;

  const cronSecret = req.headers.get("x-internal-secret");
  if (!cronSecret) return false;
  try {
    const { data } = await serviceClient().rpc("verify_internal_secret", {
      p_secret: cronSecret,
    });
    return data === true;
  } catch {
    return false;
  }
}

/** Resolve o usuário do JWT e diz se é admin. */
async function resolveJwtUser(
  token: string,
): Promise<{ userId: string; isAdmin: boolean } | null> {
  if (!token) return null;
  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  return {
    userId: data.user.id,
    isAdmin: (roles ?? []).some((r: { role: string }) => r.role === "admin"),
  };
}

/** C. INTERNAL / CRON — aceita também admin autenticado (disparo manual no painel). */
export async function requireInternal(req: Request): Promise<GuardResult> {
  if (await isInternalCall(req)) return { ok: true, status: 200, caller: { kind: "internal" } };
  const user = await resolveJwtUser(bearer(req));
  if (!user) return UNAUTHORIZED;
  if (!user.isAdmin) return FORBIDDEN;
  return { ok: true, status: 200, caller: { kind: "admin", userId: user.userId } };
}

/** A. ADMIN AUTHENTICATED — aceita chamada interna (cron/outra função). */
export async function requireAdminCaller(req: Request): Promise<GuardResult> {
  return await requireInternal(req);
}

/** B. ATHLETE AUTHENTICATED — resolve o client a partir de auth.uid(). */
export async function requireAthlete(
  req: Request,
): Promise<GuardResult & { clientIds?: string[] }> {
  const user = await resolveJwtUser(bearer(req));
  if (!user) return UNAUTHORIZED;
  const { data } = await serviceClient()
    .from("clients")
    .select("id")
    .eq("athlete_user_id", user.userId);
  const clientIds = (data ?? []).map((c: { id: string }) => c.id);
  if (clientIds.length === 0) return FORBIDDEN;
  return { ok: true, status: 200, caller: { kind: "athlete", userId: user.userId }, clientIds };
}

/**
 * Ownership: o client precisa pertencer ao admin autenticado.
 * Chamada interna passa direto (não há tenant a validar).
 */
export async function assertClientOwnership(
  caller: Caller | undefined,
  clientId: string,
): Promise<boolean> {
  if (!caller || caller.kind === "internal") return true;
  const { data } = await serviceClient()
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq(caller.kind === "athlete" ? "athlete_user_id" : "user_id", caller.userId)
    .maybeSingle();
  return !!data;
}

/** Resposta de erro padronizada — nunca vaza SQL/stack/segredo. */
export function denied(
  guard: { status: number; error?: string },
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: guard.error ?? "Unauthorized" }), {
    status: guard.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Registra tentativa relevante em operational_events (sem armazenar segredos). */
export async function logSecurityEvent(params: {
  eventType: string;
  fn: string;
  clientId?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await serviceClient().rpc("log_security_event", {
      p_event_type: params.eventType,
      p_function_name: params.fn,
      p_client_id: params.clientId ?? null,
      p_entity_id: params.entityId ?? null,
      p_metadata: params.metadata ?? {},
    });
  } catch (_e) {
    // logging jamais pode quebrar o fluxo
  }
}

/** Rate limit simples baseado em banco. Retorna true quando ainda permitido. */
export async function hitRateLimit(
  bucket: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await serviceClient().rpc("hit_rate_limit", {
      p_bucket: bucket,
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail-open: indisponibilidade do limitador não bloqueia o atleta
    return data !== false;
  } catch {
    return true;
  }
}

export function callerIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
