import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AnamneseQuestion {
  id: string;
  form_id: string;
  section: string;
  question_text: string;
  question_type: 'text_short' | 'text_medium' | 'text_long' | 'multiple_choice' | 'checkbox' | 'scale' | 'time' | 'meal';
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  is_required: boolean;
  has_comment_field: boolean;
  comment_field_label?: string;
  comment_field_required?: boolean;
  order_index: number;
  created_at: string;
}

export interface AnamneseForm {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnamneseResponse {
  id: string;
  form_id: string;
  client_id: string;
  responses: Record<string, any>;
  submitted_at: string;
  ai_analysis?: Record<string, any>;
  ai_analyzed_at?: string;
}

// Fetch all anamnese forms for the current user
export function useAnamneseForms() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['anamnese-forms', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('anamnese_forms')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AnamneseForm[];
    },
    enabled: !!user?.id,
  });
}

// Fetch a specific form with its questions
export function useAnamneseFormWithQuestions(formId: string | undefined) {
  return useQuery({
    queryKey: ['anamnese-form', formId],
    queryFn: async () => {
      if (!formId) return null;

      const { data: form, error: formError } = await supabase
        .from('anamnese_forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (formError) throw formError;

      const { data: questions, error: questionsError } = await supabase
        .from('anamnese_questions')
        .select('*')
        .eq('form_id', formId)
        .order('section')
        .order('order_index');

      if (questionsError) throw questionsError;

      return {
        form: form as AnamneseForm,
        questions: questions as AnamneseQuestion[],
      };
    },
    enabled: !!formId,
  });
}

// Fetch responses for a form
export function useAnamneseFormResponses(formId: string | undefined) {
  return useQuery({
    queryKey: ['anamnese-responses', formId],
    queryFn: async () => {
      if (!formId) return [];

      const { data, error } = await supabase
        .from('anamnese_responses')
        .select(`
          *,
          clients (id, name, email)
        `)
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });
}

// Create a new anamnese form
export function useCreateAnamneseForm() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { title: string; description: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: form, error } = await supabase
        .from('anamnese_forms')
        .insert({
          user_id: user.id,
          title: data.title,
          description: data.description,
        })
        .select()
        .single();

      if (error) throw error;
      return form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-forms'] });
    },
  });
}

// Update an anamnese form
export function useUpdateAnamneseForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; description?: string | null; is_active?: boolean; is_required?: boolean }) => {
      const { data: form, error } = await supabase
        .from('anamnese_forms')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return form;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-forms'] });
      queryClient.invalidateQueries({ queryKey: ['anamnese-form', variables.id] });
    },
  });
}

// Delete an anamnese form
export function useDeleteAnamneseForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('anamnese_forms')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-forms'] });
    },
  });
}

// Add a question to an anamnese form
export function useAddAnamneseQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      form_id: string;
      section: string;
      question_text: string;
      question_type: string;
      options?: string[];
      scale_min?: number;
      scale_max?: number;
      is_required?: boolean;
      has_comment_field?: boolean;
      comment_field_label?: string;
      comment_field_required?: boolean;
      order_index?: number;
    }) => {
      const { data: question, error } = await supabase
        .from('anamnese_questions')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return question;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-form', variables.form_id] });
    },
  });
}

// Update a question
export function useUpdateAnamneseQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, form_id, ...data }: { id: string; form_id: string; [key: string]: any }) => {
      const { data: question, error } = await supabase
        .from('anamnese_questions')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { question, form_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-form', result.form_id] });
    },
  });
}

// Delete a question
export function useDeleteAnamneseQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, form_id }: { id: string; form_id: string }) => {
      const { error } = await supabase
        .from('anamnese_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { form_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-form', result.form_id] });
    },
  });
}

// Submit anamnese response
export function useSubmitAnamneseResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { form_id: string; client_id: string; responses: Record<string, any> }) => {
      const { data: response, error } = await supabase
        .from('anamnese_responses')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-responses', variables.form_id] });
    },
  });
}
