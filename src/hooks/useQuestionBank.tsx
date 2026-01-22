import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface QuestionTemplate {
  id: string;
  user_id: string;
  question_text: string;
  question_type: 'text' | 'textarea' | 'multiple_choice' | 'checkbox' | 'scale';
  category: string;
  section: string;
  options: string[] | null;
  scale_min: number | null;
  scale_max: number | null;
  is_required: boolean;
  has_comment_field: boolean;
  comment_field_label: string | null;
  comment_field_required: boolean | null;
  created_at: string;
  updated_at: string;
}

export const QUESTION_CATEGORIES = [
  { value: 'sono', label: 'Sono' },
  { value: 'treino', label: 'Treino' },
  { value: 'fome_saciedade', label: 'Fome/Saciedade' },
  { value: 'comportamento', label: 'Comportamento' },
  { value: 'exames', label: 'Exames' },
  { value: 'suplementacao', label: 'Suplementação' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'saude', label: 'Saúde' },
  { value: 'outros', label: 'Outros' },
];

export const QUESTION_TYPES = [
  { value: 'text', label: 'Texto Curto' },
  { value: 'textarea', label: 'Texto Médio' },
  { value: 'multiple_choice', label: 'Múltipla Escolha' },
  { value: 'checkbox', label: 'Checkbox (múltiplas respostas)' },
  { value: 'scale', label: 'Escala Numérica' },
];

export const QUESTION_SECTIONS = [
  { value: 'anamnese', label: 'Anamnese' },
  { value: 'checkin', label: 'Check-in' },
];

// Fetch all question templates
export function useQuestionTemplates(section?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['question-templates', section, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('question_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (section) {
        query = query.eq('section', section);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as QuestionTemplate[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Create question template
export function useCreateQuestionTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (template: Omit<QuestionTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('question_templates')
        .insert({
          ...template,
          user_id: user?.id!,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-templates'] });
    },
  });
}

// Update question template
export function useUpdateQuestionTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuestionTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('question_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-templates'] });
    },
  });
}

// Delete question template
export function useDeleteQuestionTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('question_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-templates'] });
    },
  });
}

// Duplicate question template
export function useDuplicateQuestionTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (template: QuestionTemplate) => {
      const { id, created_at, updated_at, ...rest } = template;
      const { data, error } = await supabase
        .from('question_templates')
        .insert({
          ...rest,
          question_text: `${rest.question_text} (cópia)`,
          user_id: user?.id!,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-templates'] });
    },
  });
}
