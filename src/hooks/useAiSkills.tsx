/**
 * ETAPA 5B — Central de IA: versões de prompt (draft/ativa/arquivada),
 * ativação transacional com rollback e auditoria de execuções (ai_runs).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { AiSkillKey, PromptVersion } from '@/lib/aiSkills';

const db = supabase as any;

export function useAiPromptVersions(skillKey: AiSkillKey) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ai-prompt-versions', user?.id, skillKey],
    enabled: !!user?.id,
    staleTime: 0,
    queryFn: async (): Promise<PromptVersion[]> => {
      const { data, error } = await db
        .from('ai_prompt_versions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('context_key', skillKey)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return (data || []) as PromptVersion[];
    },
  });
}

/** Cria uma nova versão em DRAFT (nunca altera a versão ativa). */
export function useCreateDraftVersion(skillKey: AiSkillKey) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { promptText: string; changeNotes?: string }) => {
      const { data: last } = await db
        .from('ai_prompt_versions')
        .select('version_number')
        .eq('user_id', user!.id)
        .eq('context_key', skillKey)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      const next = (last?.version_number ?? 0) + 1;
      const { data, error } = await db
        .from('ai_prompt_versions')
        .insert({
          user_id: user!.id,
          context_key: skillKey,
          version_number: next,
          prompt_text: input.promptText,
          change_notes: input.changeNotes ?? null,
          status: 'draft',
          is_active: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PromptVersion;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['ai-prompt-versions', user?.id, skillKey] });
      toast.success(`Rascunho v${v.version_number} criado`);
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível criar o rascunho'),
  });
}

/** Atualiza o texto de um DRAFT (versões ativas/arquivadas são imutáveis). */
export function useUpdateDraftVersion(skillKey: AiSkillKey) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { versionId: string; promptText: string; changeNotes?: string }) => {
      const { error } = await db
        .from('ai_prompt_versions')
        .update({ prompt_text: input.promptText, change_notes: input.changeNotes ?? null })
        .eq('id', input.versionId)
        .eq('status', 'draft');
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-prompt-versions', user?.id, skillKey] });
      toast.success('Rascunho salvo');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível salvar o rascunho'),
  });
}

/** Ativação transacional: uma única versão ativa por skill (RPC audita o evento). */
export function useActivatePromptVersion(skillKey: AiSkillKey) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { error } = await db.rpc('activate_ai_prompt_version', { p_version_id: versionId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-prompt-versions', user?.id, skillKey] });
      qc.invalidateQueries({ queryKey: ['ai_prompts', user?.id] });
      toast.success('Versão ativada — produção passa a usá-la agora');
    },
    onError: (e: any) => toast.error(e?.message || 'Não foi possível ativar a versão'),
  });
}

/** Rollback = clonar uma versão antiga como novo draft e ativá-la (histórico preservado). */
export function useRollbackToVersion(skillKey: AiSkillKey) {
  const { user } = useAuth();
  const create = useCreateDraftVersion(skillKey);
  const activate = useActivatePromptVersion(skillKey);
  return useMutation({
    mutationFn: async (source: PromptVersion) => {
      const draft = await create.mutateAsync({
        promptText: source.prompt_text,
        changeNotes: `Rollback para a v${source.version_number}`,
      });
      await activate.mutateAsync(draft.id);
      return draft;
    },
  });
}

export interface AiRun {
  id: string;
  skill_key: string;
  client_id: string | null;
  prompt_version_number: number | null;
  provider: string | null;
  model: string | null;
  environment: string;
  status: string;
  error: string | null;
  duration_ms: number | null;
  effective_prompt_hash: string | null;
  input_snapshot: any;
  output_snapshot: any;
  created_at: string;
}

export function useAiRuns(skillKey?: AiSkillKey, limit = 30) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ai-runs', user?.id, skillKey, limit],
    enabled: !!user?.id,
    staleTime: 0,
    queryFn: async (): Promise<AiRun[]> => {
      let q = db.from('ai_runs').select('*').eq('user_id', user!.id)
        .order('created_at', { ascending: false }).limit(limit);
      if (skillKey) q = q.eq('skill_key', skillKey);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AiRun[];
    },
  });
}

/** Check-ins reais disponíveis para o playground de Análise de Check-in. */
export function useRecentCheckinResponses(limit = 20) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ai-playground-checkins', user?.id, limit],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from('checkin_responses')
        .select('id, submitted_at, clients!inner(id, name, user_id)')
        .eq('clients.user_id', user!.id)
        .order('submitted_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}
