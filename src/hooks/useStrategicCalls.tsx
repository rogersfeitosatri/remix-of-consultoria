import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface StrategicCall {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  status: string;
  closing_date: string | null;
  page_title: string;
  page_text: string;
  button_text: string;
  button_color: string;
  page_image_url: string | null;
  whatsapp_message: string;
  created_at: string;
  updated_at: string;
}

export interface StrategicCallQuestion {
  id: string;
  call_id: string;
  question_text: string;
  question_type: string;
  field_name: string | null;
  is_required: boolean;
  options: any;
  score_map: any;
  order_index: number;
  created_at: string;
}

export interface StrategicCallResponse {
  id: string;
  call_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  respondent_phone: string | null;
  answers: any;
  total_score: number;
  classification: string;
  submitted_at: string;
  whatsapp_sent: boolean;
}

export function useStrategicCalls() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['strategic-calls', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategic_calls')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as StrategicCall[];
    },
    enabled: !!user?.id,
  });
}

export function useStrategicCall(callId: string | undefined) {
  return useQuery({
    queryKey: ['strategic-call', callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategic_calls')
        .select('*')
        .eq('id', callId!)
        .single();
      if (error) throw error;
      return data as unknown as StrategicCall;
    },
    enabled: !!callId,
  });
}

export function useStrategicCallBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['strategic-call-slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategic_calls')
        .select('*')
        .eq('slug', slug!)
        .eq('status', 'active')
        .single();
      if (error) throw error;
      return data as unknown as StrategicCall;
    },
    enabled: !!slug,
  });
}

export function useStrategicCallQuestions(callId: string | undefined) {
  return useQuery({
    queryKey: ['strategic-call-questions', callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategic_call_questions')
        .select('*')
        .eq('call_id', callId!)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as unknown as StrategicCallQuestion[];
    },
    enabled: !!callId,
  });
}

export function useStrategicCallResponses(callId: string | undefined) {
  return useQuery({
    queryKey: ['strategic-call-responses', callId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategic_call_responses')
        .select('*')
        .eq('call_id', callId!)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data as unknown as StrategicCallResponse[];
    },
    enabled: !!callId,
  });
}

export function useCreateStrategicCall() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string }) => {
      const { data, error } = await supabase
        .from('strategic_calls')
        .insert({ user_id: user!.id, name: input.name, slug: input.slug } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategic-calls'] });
      toast.success('Call criada com sucesso!');
    },
    onError: (err: any) => toast.error('Erro ao criar call: ' + err.message),
  });
}

export function useUpdateStrategicCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StrategicCall> & { id: string }) => {
      const { error } = await supabase
        .from('strategic_calls')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['strategic-calls'] });
      queryClient.invalidateQueries({ queryKey: ['strategic-call', vars.id] });
      toast.success('Call atualizada!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
}

export function useSaveStrategicCallQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ callId, questions }: { callId: string; questions: Omit<StrategicCallQuestion, 'id' | 'created_at'>[] }) => {
      // Delete existing then insert new
      await supabase.from('strategic_call_questions').delete().eq('call_id', callId);
      if (questions.length > 0) {
        const { error } = await supabase
          .from('strategic_call_questions')
          .insert(questions as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['strategic-call-questions', vars.callId] });
      toast.success('Perguntas salvas!');
    },
    onError: (err: any) => toast.error('Erro: ' + err.message),
  });
}

export function useSubmitStrategicCallResponse() {
  return useMutation({
    mutationFn: async (input: Omit<StrategicCallResponse, 'id' | 'submitted_at' | 'whatsapp_sent'>) => {
      const { data, error } = await supabase
        .from('strategic_call_responses')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}
