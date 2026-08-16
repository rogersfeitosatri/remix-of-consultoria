import { supabase } from "@/integrations/supabase/client";

/**
 * ETAPA 3C — Resolução canônica do formulário de check-in de um atleta.
 *
 * Ordem oficial:
 *   1. override individual do atleta (exceção explícita);
 *   2. formulário definido pelo plano/produto contratado;
 *   3. formulário explicitamente vinculado ao schedule ativo.
 *
 * NÃO existe mais fallback "primeiro formulário ativo": quando não há configuração,
 * devolvemos um erro operacional para o admin resolver.
 */
export interface ResolvedCheckinForm {
  id: string;
  title: string;
  versionId: string;
  source: string;
}

export type ResolveCheckinFormResult =
  | { ok: true; form: ResolvedCheckinForm }
  | { ok: false; errorCode: 'checkin_form_not_configured' | 'checkin_form_version_not_published'; message: string };

const MESSAGES: Record<string, string> = {
  checkin_form_not_configured:
    'Formulário de check-in não configurado para este atleta (defina no plano/produto ou crie um override).',
  checkin_form_version_not_published:
    'O formulário deste atleta não possui versão publicada. Publique uma versão antes de enviar.',
};

export async function resolveAthleteCheckinFormResult(
  clientId: string,
): Promise<ResolveCheckinFormResult> {
  const { data, error } = await supabase.rpc("resolve_checkin_form_for_client" as never, {
    p_client_id: clientId,
  } as never);

  if (error) {
    return { ok: false, errorCode: 'checkin_form_not_configured', message: error.message };
  }

  const rows = data as unknown as any;
  const row = (Array.isArray(rows) ? rows[0] : rows) as
    | { form_id: string | null; form_version_id: string | null; source: string | null; error_code: string | null }
    | null;

  if (!row || row.error_code || !row.form_id || !row.form_version_id) {
    const code = (row?.error_code as ResolveCheckinFormResult extends { ok: false } ? string : string) ??
      'checkin_form_not_configured';
    return {
      ok: false,
      errorCode: (code as 'checkin_form_not_configured' | 'checkin_form_version_not_published'),
      message: MESSAGES[code] ?? MESSAGES.checkin_form_not_configured,
    };
  }

  const { data: form } = await supabase
    .from("checkin_forms")
    .select("id, title, archived_at")
    .eq("id", row.form_id)
    .maybeSingle();

  if (!form || (form as { archived_at?: string | null }).archived_at) {
    return {
      ok: false,
      errorCode: 'checkin_form_not_configured',
      message: 'O formulário configurado está arquivado. Ajuste a configuração do plano ou o override do atleta.',
    };
  }

  return {
    ok: true,
    form: {
      id: form.id,
      title: form.title,
      versionId: row.form_version_id,
      source: row.source ?? 'unknown',
    },
  };
}

/**
 * Compatibilidade com chamadas existentes: devolve o formulário ou null.
 * Prefira `resolveAthleteCheckinFormResult` para exibir o erro operacional correto.
 */
export async function resolveAthleteCheckinForm(
  clientId: string,
  _adminUserId?: string,
): Promise<{ id: string; title: string; versionId?: string } | null> {
  const result = await resolveAthleteCheckinFormResult(clientId);
  return result.ok ? { id: result.form.id, title: result.form.title, versionId: result.form.versionId } : null;
}
