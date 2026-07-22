// Tipos compartilhados do módulo ZN Assessoria
// "monthly" mantido apenas para compatibilidade com assinaturas LEGADAS; o
// funil novo oferece "quarterly" (Trimestral) no lugar do mensal.
export type ZnPlanCode = "monthly" | "quarterly" | "semiannual" | "annual";

export type ZnSubscriptionStatus =
  | "pending"
  | "active"
  | "overdue"
  | "suspended"
  | "cancelled"
  | "expired";

export type ZnAthleteStatus = "pending" | "active" | "inactive";

export type ZnPaymentStatus =
  | "pending"
  | "confirmed"
  | "received"
  | "overdue"
  | "refunded"
  | "failed"
  | "deleted";

export interface AsaasPayment {
  id: string;
  customer?: string;
  subscription?: string;
  value?: number;
  netValue?: number;
  billingType?: string;
  status?: string;
  dueDate?: string;
  paymentDate?: string;
  invoiceUrl?: string;
  externalReference?: string;
}

export interface AsaasSubscription {
  id: string;
  customer?: string;
  cycle?: string;
  value?: number;
  status?: string;
  externalReference?: string;
}

export interface AsaasCustomer {
  id: string;
  name?: string;
  email?: string;
  mobilePhone?: string;
  phone?: string;
  cpfCnpj?: string;
  externalReference?: string;
}

export interface AsaasEventPayload {
  id?: string; // event id (evt_...)
  event: string;
  dateCreated?: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
  customer?: AsaasCustomer;
}

export function mapAsaasCycleToPlan(cycle?: string | null): ZnPlanCode | null {
  const c = (cycle ?? "").toUpperCase();
  if (c === "MONTHLY") return "monthly";
  if (c === "QUARTERLY") return "quarterly";
  if (c === "SEMIANNUALLY") return "semiannual";
  if (c === "YEARLY" || c === "ANNUALLY") return "annual";
  return null;
}

export function mapAsaasPaymentStatus(s?: string): ZnPaymentStatus {
  switch ((s ?? "").toUpperCase()) {
    case "CONFIRMED":
      return "confirmed";
    case "RECEIVED":
    case "RECEIVED_IN_CASH":
      return "received";
    case "OVERDUE":
      return "overdue";
    case "REFUNDED":
    case "REFUND_REQUESTED":
      return "refunded";
    case "DELETED":
      return "deleted";
    case "PENDING":
      return "pending";
    default:
      return "pending";
  }
}

export function mapAsaasBillingType(b?: string): string {
  switch ((b ?? "").toUpperCase()) {
    case "CREDIT_CARD":
      return "card";
    case "PIX":
      return "pix";
    case "BOLETO":
      return "boleto";
    default:
      return (b ?? "").toLowerCase() || "card";
  }
}
