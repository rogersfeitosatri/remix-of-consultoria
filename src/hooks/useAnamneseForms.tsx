import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  ENDURANCE_ANAMNESE_QUESTIONS,
  ENDURANCE_ANAMNESE_TITLE,
  ENDURANCE_ANAMNESE_DESCRIPTION,
} from '@/lib/enduranceAnamneseQuestions';

export interface AnamneseQuestion {
  id: string;
  form_id: string;
  section: string;
  question_text: string;
  question_type: string;
  options?: any;
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
        .from('anamnese_forms' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AnamneseForm[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Fetch a specific form with its questions
export function useAnamneseFormWithQuestions(formId: string | undefined) {
  return useQuery({
    queryKey: ['anamnese-form', formId],
    queryFn: async () => {
      if (!formId) return null;

      const { data: form, error: formError } = await supabase
        .from('anamnese_forms' as any)
        .select('*')
        .eq('id', formId)
        .single();

      if (formError) throw formError;

      const { data: questions, error: questionsError } = await supabase
        .from('anamnese_questions' as any)
        .select('*')
        .eq('form_id', formId)
        .order('order_index');

      if (questionsError) throw questionsError;

      return {
        form: form as unknown as AnamneseForm,
        questions: (questions || []) as unknown as AnamneseQuestion[],
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
        .from('anamnese_responses' as any)
        .select(`
          *,
          clients (id, name, email)
        `)
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
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
        .from('anamnese_forms' as any)
        .insert({
          user_id: user.id,
          title: data.title,
          description: data.description,
        })
        .select()
        .single();

      if (error) throw error;
      return form as unknown as AnamneseForm;
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
        .from('anamnese_forms' as any)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return form as unknown as AnamneseForm;
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
        .from('anamnese_forms' as any)
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
        .from('anamnese_questions' as any)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return question as unknown as AnamneseQuestion;
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
        .from('anamnese_questions' as any)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { question: question as unknown as AnamneseQuestion, form_id };
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
        .from('anamnese_questions' as any)
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

// Reorder questions (update order_index for multiple questions)
export function useReorderAnamneseQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ form_id, updates }: { form_id: string; updates: { id: string; order_index: number; section?: string }[] }) => {
      // Execute all updates in sequence to avoid race conditions
      // Using Promise.all with individual updates
      await Promise.all(
        updates.map(async (update) => {
          const { error } = await supabase
            .from('anamnese_questions' as any)
            .update({ order_index: update.order_index, ...(update.section && { section: update.section }) })
            .eq('id', update.id);

          if (error) throw error;
        })
      );
      return { form_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-form', result.form_id] });
    },
  });
}

// Rename section (update section name for all questions in that section)
export function useRenameAnamneseSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ form_id, old_section, new_section }: { form_id: string; old_section: string; new_section: string }) => {
      const { error } = await supabase
        .from('anamnese_questions' as any)
        .update({ section: new_section })
        .eq('form_id', form_id)
        .eq('section', old_section);

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
        .from('anamnese_responses' as any)
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return response as unknown as AnamneseResponse;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-responses', variables.form_id] });
    },
  });
}

// Create the endurance anamnese model (single-question-per-screen wizard)
export function useCreateEnduranceAnamneseForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: form, error: formError } = await supabase
        .from('anamnese_forms' as any)
        .insert({
          user_id: user.id,
          title: ENDURANCE_ANAMNESE_TITLE,
          description: ENDURANCE_ANAMNESE_DESCRIPTION,
          is_active: false,
          single_question_wizard: true,
        })
        .select()
        .single();

      if (formError) throw formError;

      const formId = (form as any).id;

      const questions = ENDURANCE_ANAMNESE_QUESTIONS.map((q, index) => ({
        form_id: formId,
        section: q.section,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options ?? null,
        scale_min: q.scale_min ?? null,
        scale_max: q.scale_max ?? null,
        is_required: q.is_required ?? false,
        order_index: index,
        has_comment_field: q.has_comment_field ?? false,
        comment_field_label: q.comment_field_label ?? null,
        comment_field_required: q.comment_field_required ?? false,
      }));

      const { error: questionsError } = await supabase
        .from('anamnese_questions' as any)
        .insert(questions);

      if (questionsError) throw questionsError;

      return form as unknown as AnamneseForm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-forms'] });
    },
  });
}

// Create default anamnese form with question templates
export function useCreateDefaultAnamneseForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Fetch question templates for anamnese section
      const { data: templates, error: templatesError } = await supabase
        .from('question_templates')
        .select('*')
        .eq('section', 'anamnese')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (templatesError) throw templatesError;
      if (!templates || templates.length === 0) {
        throw new Error('Nenhuma pergunta encontrada no banco de perguntas para a seção de anamnese');
      }

      // Create the form
      const { data: form, error: formError } = await supabase
        .from('anamnese_forms')
        .insert({
          title: 'Anamnese Nutricional',
          description: 'Formulário padrão de anamnese para avaliação nutricional completa do atleta.',
          user_id: user.id,
        })
        .select()
        .single();

      if (formError) throw formError;

      // Map templates to questions
      const questions = templates.map((template: any, index: number) => ({
        form_id: (form as any).id,
        section: template.category || 'geral',
        question_text: template.question_text,
        question_type: template.question_type === 'text' ? 'short_text' : 
                       template.question_type === 'textarea' ? 'long_text' :
                       template.question_type,
        options: template.options,
        scale_min: template.scale_min || 1,
        scale_max: template.scale_max || 10,
        is_required: template.is_required,
        order_index: index,
        has_comment_field: template.has_comment_field || false,
        comment_field_label: template.comment_field_label,
        comment_field_required: template.comment_field_required || false,
      }));

      // Insert all questions
      const { error: questionsError } = await supabase
        .from('anamnese_questions')
        .insert(questions);

      if (questionsError) throw questionsError;

      return form as unknown as AnamneseForm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anamnese-forms'] });
    },
  });
}
