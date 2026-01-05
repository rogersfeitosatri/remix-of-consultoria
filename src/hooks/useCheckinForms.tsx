import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type QuestionType = 'short_text' | 'long_text' | 'multiple_choice' | 'checkbox' | 'scale';

export interface CheckinQuestion {
  id: string;
  form_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  scale_min: number;
  scale_max: number;
  is_required: boolean;
  order_index: number;
  created_at: string;
}

export interface CheckinForm {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CheckinResponse {
  id: string;
  form_id: string;
  client_id: string;
  responses: Record<string, any>;
  submitted_at: string;
}

export function useCheckinForms() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['checkin_forms', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_forms')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CheckinForm[];
    },
    enabled: !!user,
  });
}

export function useCheckinFormWithQuestions(formId: string | undefined) {
  return useQuery({
    queryKey: ['checkin_form', formId],
    queryFn: async () => {
      if (!formId) return null;

      const { data: form, error: formError } = await supabase
        .from('checkin_forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (formError) throw formError;

      const { data: questions, error: questionsError } = await supabase
        .from('checkin_questions')
        .select('*')
        .eq('form_id', formId)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;

      return {
        form: form as CheckinForm,
        questions: questions as CheckinQuestion[],
      };
    },
    enabled: !!formId,
  });
}

export function useCheckinFormResponses(formId: string | undefined) {
  return useQuery({
    queryKey: ['checkin_form_responses', formId],
    queryFn: async () => {
      if (!formId) return [];

      const { data, error } = await supabase
        .from('checkin_responses')
        .select(`
          *,
          clients (name, email)
        `)
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });
}

export function useCreateCheckinForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: { title: string; description?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('checkin_forms')
        .insert({
          ...formData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CheckinForm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkin_forms'] });
    },
  });
}

export function useUpdateCheckinForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CheckinForm> & { id: string }) => {
      const { data, error } = await supabase
        .from('checkin_forms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CheckinForm;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkin_forms'] });
      queryClient.invalidateQueries({ queryKey: ['checkin_form', data.id] });
    },
  });
}

export function useDeleteCheckinForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('checkin_forms')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkin_forms'] });
    },
  });
}

export function useAddCheckinQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (questionData: Omit<CheckinQuestion, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('checkin_questions')
        .insert(questionData)
        .select()
        .single();

      if (error) throw error;
      return data as CheckinQuestion;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkin_form', data.form_id] });
    },
  });
}

export function useUpdateCheckinQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, form_id, ...updates }: Partial<CheckinQuestion> & { id: string; form_id: string }) => {
      const { data, error } = await supabase
        .from('checkin_questions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, form_id } as CheckinQuestion;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkin_form', data.form_id] });
    },
  });
}

export function useDeleteCheckinQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, formId }: { id: string; formId: string }) => {
      const { error } = await supabase
        .from('checkin_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { formId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkin_form', data.formId] });
    },
  });
}

export function useSubmitCheckinResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (responseData: { form_id: string; client_id: string; responses: Record<string, any> }) => {
      const { data, error } = await supabase
        .from('checkin_responses')
        .insert(responseData)
        .select()
        .single();

      if (error) throw error;
      return data as CheckinResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['checkin_form_responses', data.form_id] });
      queryClient.invalidateQueries({ queryKey: ['checkin_responses'] });
    },
  });
}
