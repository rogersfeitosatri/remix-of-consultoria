import { supabase } from "@/integrations/supabase/client";

/**
 * Cria um registro em checkin_dispatches ANTES do envio via WhatsApp.
 * Regra obrigatória: nenhum envio direto via Z-API sem dispatch correspondente.
 *
 * Retorna o dispatchId para que, após o envio, o status possa ser atualizado.
 */
export async function createCheckinDispatchForSend(params: {
  clientId: string;
  userId: string;
  linkCheckin: string;
  source: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_checkin_dispatch_for_send" as any, {
    p_client_id: params.clientId,
    p_user_id: params.userId,
    p_link_checkin: params.linkCheckin,
    p_source: params.source,
  });
  if (error) throw new Error(`Falha ao registrar dispatch: ${error.message}`);
  return data as unknown as string;
}

export async function markDispatchSent(dispatchId: string, providerResponse?: unknown) {
  await supabase
    .from("checkin_dispatches")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_response: (providerResponse as any) ?? null,
    })
    .eq("id", dispatchId);

  // Propaga last_dispatched_at para o schedule vinculado
  const { data: disp } = await supabase
    .from("checkin_dispatches")
    .select("schedule_id")
    .eq("id", dispatchId)
    .maybeSingle();
  if (disp?.schedule_id) {
    await supabase
      .from("athlete_checkin_schedules")
      .update({ last_dispatched_at: new Date().toISOString() })
      .eq("id", disp.schedule_id);
  }
}

export async function markDispatchFailed(dispatchId: string, errorMessage: string) {
  await supabase
    .from("checkin_dispatches")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 500),
    })
    .eq("id", dispatchId);
}
