// ETAPA 1 — Autenticação/autorização central para edge functions sensíveis.
// Nenhuma função que usa service_role pode confiar apenas no client_id do body.
import { createClient } from "npm:@supabase/supabase-js@2";

export interface AuthResult {
  ok: boolean;
  status: number;
  userId?: string;
  isAdmin?: boolean;
  error?: string;
}

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Valida o JWT do header Authorization e retorna o usuário. */
export async function requireUser(req: Request): Promise<AuthResult> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Missing Authorization header" };

  // Chamada interna (cron / outra função) usando a service role key.
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return { ok: true, status: 200, isAdmin: true };
  }

  const supabase = serviceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: "Invalid token" };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  return { ok: true, status: 200, userId: data.user.id, isAdmin };
}

/** Exige admin (ou chamada interna com service role). */
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const res = await requireUser(req);
  if (!res.ok) return res;
  if (!res.isAdmin) return { ok: false, status: 403, error: "Admin role required" };
  return res;
}

/** Garante que o cliente pertence ao admin autenticado (ownership check). */
export async function assertClientOwnership(
  auth: AuthResult,
  clientId: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!auth.userId) return { ok: true, status: 200 }; // chamada interna
  const supabase = serviceClient();
  const { data } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!data) return { ok: false, status: 403, error: "Client does not belong to this user" };
  return { ok: true, status: 200 };
}
