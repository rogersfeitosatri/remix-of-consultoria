import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AiChatSettings {
  user_id: string;
  enabled: boolean;
  model: string;
  system_prompt: string;
  escalation_keywords: string[];
  updated_at: string;
}

export function useAiChatSettings() {
  return useQuery({
    queryKey: ['ai-chat-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('ai_chat_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as AiChatSettings | null;
    },
  });
}

export function useSaveAiChatSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AiChatSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('ai_chat_settings')
        .upsert({ user_id: user.id, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-chat-settings'] });
      toast.success('Configurações salvas');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });
}

export function useAiChatEscalations() {
  return useQuery({
    queryKey: ['ai-chat-escalations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_chat_escalations')
        .select('id, client_id, trigger, excerpt, status, created_at, clients!inner(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useResolveEscalation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_chat_escalations')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-chat-escalations'] }),
  });
}

export function useAiChatConversations() {
  return useQuery({
    queryKey: ['ai-chat-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_chat_conversations')
        .select('id, client_id, last_message_at, message_count, clients!inner(name, phone, ai_whatsapp_enabled)')
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAiChatMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['ai-chat-messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('id, role, content, created_at, escalated')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}
