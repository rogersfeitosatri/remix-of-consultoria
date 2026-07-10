// AthleteService — cria/localiza atletas do módulo ZN Assessoria.
// Não altera nem lê a tabela `clients` da consultoria.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { AsaasCustomer } from "./types.ts";

export interface FindOrCreateInput {
  owner_user_id: string;             // admin dono
  email: string;
  name?: string | null;
  phone?: string | null;
  cpf_cnpj?: string | null;
  asaas_customer_id?: string | null;
}

export class AthleteService {
  constructor(private supabase: SupabaseClient) {}

  async findOrCreate(input: FindOrCreateInput) {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new Error("AthleteService: e-mail obrigatório");

    // 1) tenta pelo asaas_customer_id (mais confiável em renovações)
    if (input.asaas_customer_id) {
      const { data } = await this.supabase
        .from("zn_athletes")
        .select("*")
        .eq("user_id", input.owner_user_id)
        .eq("asaas_customer_id", input.asaas_customer_id)
        .maybeSingle();
      if (data) return data;
    }

    // 2) tenta pelo par (user_id, email)
    const { data: byEmail } = await this.supabase
      .from("zn_athletes")
      .select("*")
      .eq("user_id", input.owner_user_id)
      .eq("email", email)
      .maybeSingle();

    if (byEmail) {
      // completa dados eventualmente ausentes
      const patch: Record<string, unknown> = {};
      if (!byEmail.asaas_customer_id && input.asaas_customer_id) patch.asaas_customer_id = input.asaas_customer_id;
      if (!byEmail.phone && input.phone) patch.phone = input.phone;
      if (!byEmail.cpf_cnpj && input.cpf_cnpj) patch.cpf_cnpj = input.cpf_cnpj;
      if (!byEmail.name && input.name) patch.name = input.name;
      if (Object.keys(patch).length) {
        const { data: upd } = await this.supabase
          .from("zn_athletes")
          .update(patch)
          .eq("id", byEmail.id)
          .select("*")
          .single();
        return upd ?? byEmail;
      }
      return byEmail;
    }

    // 3) cria
    const { data: created, error } = await this.supabase
      .from("zn_athletes")
      .insert({
        user_id: input.owner_user_id,
        name: input.name?.trim() || email.split("@")[0],
        email,
        phone: input.phone ?? null,
        cpf_cnpj: input.cpf_cnpj ?? null,
        asaas_customer_id: input.asaas_customer_id ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(`AthleteService.create: ${error.message}`);
    return created;
  }

  async markActive(athleteId: string) {
    const { error } = await this.supabase
      .from("zn_athletes")
      .update({ status: "active", first_payment_at: new Date().toISOString() })
      .eq("id", athleteId)
      .is("first_payment_at", null);
    if (error) throw new Error(`AthleteService.markActive: ${error.message}`);
  }
}

export function extractCustomerFromEvent(payload: {
  customer?: AsaasCustomer;
  payment?: { customer?: string };
}): { asaas_customer_id: string | null; email: string | null; name: string | null; phone: string | null; cpf: string | null } {
  const c = payload.customer;
  return {
    asaas_customer_id: c?.id ?? payload.payment?.customer ?? null,
    email: c?.email ?? null,
    name: c?.name ?? null,
    phone: c?.mobilePhone ?? c?.phone ?? null,
    cpf: c?.cpfCnpj ?? null,
  };
}
