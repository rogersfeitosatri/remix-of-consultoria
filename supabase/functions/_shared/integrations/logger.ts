// Registra cada chamada da API pública em zn_integration_api_logs.
// Nunca derruba o request — falhas de log só são logadas no console.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface ApiLogEntry {
  endpoint: string;
  method: string;
  source_system: string | null;
  status_code: number;
  success: boolean;
  error_message?: string | null;
  duration_ms: number;
  request_payload?: unknown;
  response_payload?: unknown;
  athlete_id?: string | null;
  subscription_id?: string | null;
}

export async function logApiCall(
  supabase: SupabaseClient,
  entry: ApiLogEntry,
): Promise<void> {
  try {
    await supabase.from("zn_integration_api_logs").insert({
      endpoint: entry.endpoint,
      method: entry.method,
      source_system: entry.source_system,
      status_code: entry.status_code,
      success: entry.success,
      error_message: entry.error_message ?? null,
      duration_ms: entry.duration_ms,
      request_payload: entry.request_payload ?? null,
      response_payload: entry.response_payload ?? null,
      athlete_id: entry.athlete_id ?? null,
      subscription_id: entry.subscription_id ?? null,
    });
  } catch (err) {
    console.error("[integrations-api] falha ao registrar log:", err);
  }
}
