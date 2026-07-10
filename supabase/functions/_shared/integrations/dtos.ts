// DTOs e validators simples (sem dependências externas) para a API pública.
// Regra: nunca aceitar payload não validado; sempre retornar 400 com detalhes.

export interface ValidationError {
  field: string;
  message: string;
}

export type Validated<T> =
  | { ok: true; data: T }
  | { ok: false; errors: ValidationError[] };

const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export interface CancelDTO {
  athleteId: string;
  motivoCancelamento?: string;
}
export function validateCancel(body: unknown): Validated<CancelDTO> {
  const errors: ValidationError[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isUuid(b.athleteId)) errors.push({ field: "athleteId", message: "UUID obrigatório" });
  if (b.motivoCancelamento != null && typeof b.motivoCancelamento !== "string") {
    errors.push({ field: "motivoCancelamento", message: "deve ser string" });
  }
  if (typeof b.motivoCancelamento === "string" && b.motivoCancelamento.length > 500) {
    errors.push({ field: "motivoCancelamento", message: "máx. 500 caracteres" });
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      athleteId: b.athleteId as string,
      motivoCancelamento: (b.motivoCancelamento as string | undefined)?.trim() || undefined,
    },
  };
}

const VALID_PLANS = ["monthly", "semiannual", "annual"] as const;
export type ZnPlan = typeof VALID_PLANS[number];

export interface ChangePlanDTO {
  athleteId: string;
  novoPlano: ZnPlan;
}
export function validateChangePlan(body: unknown): Validated<ChangePlanDTO> {
  const errors: ValidationError[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isUuid(b.athleteId)) errors.push({ field: "athleteId", message: "UUID obrigatório" });
  if (!VALID_PLANS.includes(b.novoPlano as ZnPlan)) {
    errors.push({ field: "novoPlano", message: `deve ser ${VALID_PLANS.join(" | ")}` });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { athleteId: b.athleteId as string, novoPlano: b.novoPlano as ZnPlan } };
}

export interface ReactivateDTO {
  athleteId: string;
}
export function validateReactivate(body: unknown): Validated<ReactivateDTO> {
  const errors: ValidationError[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isUuid(b.athleteId)) errors.push({ field: "athleteId", message: "UUID obrigatório" });
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { athleteId: b.athleteId as string } };
}
