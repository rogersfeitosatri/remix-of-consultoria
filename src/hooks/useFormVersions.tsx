/**
 * ETAPA 3C — Versionamento de formulários (Check-in e Anamnese).
 *
 * FORM  = identidade do modelo (checkin_forms / anamnese_forms)
 * VERSION = definição imutável usada num momento (checkin_form_versions / anamnese_form_versions)
 *
 * A definição "de trabalho" continua em checkin_questions / anamnese_questions.
 * Publicar uma versão congela essa definição num snapshot imutável.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logOperationalEvent } from '@/lib/operationalEvents';

export type FormKind = 'checkin' | 'anamnese';

export interface FormVersion {
  id: string;
  form_id: string;
  version_number: number;
  status: 'draft' | 'published' | 'superseded';
  title: string | null;
  created_at: string;
  created_by: string | null;
  published_at: string | null;
  superseded_at: string | null;
  metadata: Record<string, unknown> | null;
  response_count?: number;
}

const versionsTable = (kind: FormKind) =>
  kind === 'checkin' ? 'checkin_form_versions' : 'anamnese_form_versions';
const versionQuestionsTable = (kind: FormKind) =>
  kind === 'checkin' ? 'checkin_form_version_questions' : 'anamnese_form_version_questions';
const responsesTable = (kind: FormKind) =>
  kind === 'checkin' ? 'checkin_responses' : 'anamnese_responses';

export function useFormVersions(kind: FormKind, formId: string | undefined) {
  return useQuery({
    queryKey: ['form_versions', kind, formId],
    queryFn: async (): Promise<FormVersion[]> => {
      if (!formId) return [];
      const { data, error } = await supabase
        .from(versionsTable(kind) as never)
        .select('*')
        .eq('form_id', formId)
        .order('version_number', { ascending: false });
      if (error) throw error;

      const versions = (data ?? []) as unknown as FormVersion[];
      if (versions.length === 0) return versions;

      const { data: counts } = await supabase
        .from(responsesTable(kind) as never)
        .select('form_version_id')
        .eq('form_id', formId);

      const byVersion = new Map<string, number>();
      ((counts ?? []) as unknown as { form_version_id: string | null }[]).forEach((r) => {
        if (!r.form_version_id) return;
        byVersion.set(r.form_version_id, (byVersion.get(r.form_version_id) ?? 0) + 1);
      });

      return versions.map((v) => ({ ...v, response_count: byVersion.get(v.id) ?? 0 }));
    },
    enabled: !!formId,
    staleTime: 30_000,
  });
}

/** Perguntas congeladas de uma versão (reconstrução histórica). */
export function useFormVersionQuestions(kind: FormKind, versionId: string | null | undefined) {
  return useQuery({
    queryKey: ['form_version_questions', kind, versionId],
    queryFn: async () => {
      if (!versionId) return [];
      const { data, error } = await supabase
        .from(versionQuestionsTable(kind) as never)
        .select('*')
        .eq('version_id', versionId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Record<string, any>[];
    },
    enabled: !!versionId,
  });
}

/** Publica a definição atual como nova versão. Versões anteriores viram 'superseded'. */
export function usePublishFormVersion(kind: FormKind) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, note }: { formId: string; note?: string }) => {
      const rpc = kind === 'checkin' ? 'publish_checkin_form_version' : 'publish_anamnese_form_version';
      const { data, error } = await supabase.rpc(rpc as never, {
        p_form_id: formId,
        p_note: note ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: async (versionId, { formId }) => {
      await logOperationalEvent({
        entityType: kind === 'checkin' ? 'checkin_form' : 'anamnese_form',
        entityId: formId,
        eventType: kind === 'checkin' ? 'checkin_form_version_published' : 'anamnese_form_version_published',
        metadata: { form_id: formId, version_id: versionId },
      });
      queryClient.invalidateQueries({ queryKey: ['form_versions', kind, formId] });
      queryClient.invalidateQueries({ queryKey: ['checkin_forms'] });
      queryClient.invalidateQueries({ queryKey: ['anamnese_forms'] });
    },
  });
}

/** Arquiva (ou restaura) um formulário — substitui o hard delete no fluxo normal. */
export function useArchiveForm(kind: FormKind) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, archive }: { formId: string; archive: boolean }) => {
      const rpc = kind === 'checkin' ? 'archive_checkin_form' : 'archive_anamnese_form';
      const { error } = await supabase.rpc(rpc as never, {
        p_form_id: formId,
        p_archive: archive,
      } as never);
      if (error) throw error;
      return { formId, archive };
    },
    onSuccess: async ({ formId, archive }) => {
      await logOperationalEvent({
        entityType: kind === 'checkin' ? 'checkin_form' : 'anamnese_form',
        entityId: formId,
        eventType: kind === 'checkin' ? 'checkin_form_archived' : 'anamnese_form_archived',
        metadata: { form_id: formId, archived: archive },
      });
      queryClient.invalidateQueries({ queryKey: ['checkin_forms'] });
      queryClient.invalidateQueries({ queryKey: ['anamnese_forms'] });
    },
  });
}

/** true quando o formulário já recebeu respostas (=> edição exige nova versão). */
export function useFormHasResponses(kind: FormKind, formId: string | undefined) {
  return useQuery({
    queryKey: ['form_has_responses', kind, formId],
    queryFn: async () => {
      if (!formId) return false;
      const { count } = await supabase
        .from(responsesTable(kind) as never)
        .select('id', { count: 'exact', head: true })
        .eq('form_id', formId);
      return (count ?? 0) > 0;
    },
    enabled: !!formId,
    staleTime: 30_000,
  });
}
