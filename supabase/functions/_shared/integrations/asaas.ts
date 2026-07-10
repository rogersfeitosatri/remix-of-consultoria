// Cliente fino para a API do Asaas — usado exclusivamente pelo módulo de
// integrações. A Consultoria é o único sistema que conversa com o Asaas.
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase();
export const ASAAS_BASE =
  ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

function headers() {
  if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada");
  return {
    "Content-Type": "application/json",
    access_token: ASAAS_API_KEY,
  };
}

export async function asaasRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(
      `Asaas [${res.status}] ${path}: ${typeof body === "object" ? JSON.stringify(body) : text}`,
    );
  }
  return body as T;
}

export const PLAN_TO_CYCLE: Record<string, string> = {
  monthly: "MONTHLY",
  semiannual: "SEMIANNUALLY",
  annual: "YEARLY",
};
