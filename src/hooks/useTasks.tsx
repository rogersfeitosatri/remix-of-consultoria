import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TaskLabel {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  day_of_week: number;
  due_date: string | null;
  due_time: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  labels?: TaskLabel[];
}

export interface TaskWithLabels extends Task {
  labels: TaskLabel[];
}

export function useTaskLabels() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['task-labels', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('task_labels')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      return data as TaskLabel[];
    },
    enabled: !!user?.id,
  });
}

export function useTasks(includeArchived = false) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tasks', user?.id, includeArchived],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('order_index');

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      const { data: tasks, error: tasksError } = await query;
      if (tasksError) throw tasksError;

      // Fetch label assignments
      const taskIds = tasks.map((t: Task) => t.id);
      if (taskIds.length === 0) return [];

      const { data: assignments, error: assignError } = await supabase
        .from('task_label_assignments')
        .select('task_id, label_id')
        .in('task_id', taskIds);
      if (assignError) throw assignError;

      const { data: labels, error: labelsError } = await supabase
        .from('task_labels')
        .select('*')
        .eq('user_id', user.id);
      if (labelsError) throw labelsError;

      const labelMap = new Map(labels.map((l: TaskLabel) => [l.id, l]));

      return tasks.map((task: Task) => ({
        ...task,
        labels: assignments
          .filter((a: { task_id: string; label_id: string }) => a.task_id === task.id)
          .map((a: { task_id: string; label_id: string }) => labelMap.get(a.label_id))
          .filter(Boolean) as TaskLabel[],
      })) as TaskWithLabels[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateTask() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      day_of_week: number;
      due_date?: string;
      due_time?: string;
      label_ids?: string[];
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: data.title,
          description: data.description || null,
          day_of_week: data.day_of_week,
          due_date: data.due_date || null,
          due_time: data.due_time || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data.label_ids && data.label_ids.length > 0) {
        const { error: assignError } = await supabase
          .from('task_label_assignments')
          .insert(
            data.label_ids.map((label_id) => ({
              task_id: task.id,
              label_id,
            }))
          );
        if (assignError) throw assignError;
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa criada com sucesso');
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast.error('Erro ao criar tarefa');
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      title?: string;
      description?: string;
      day_of_week?: number;
      due_date?: string | null;
      due_time?: string | null;
      is_pinned?: boolean;
      is_archived?: boolean;
      order_index?: number;
      label_ids?: string[];
    }) => {
      const { id, label_ids, ...updateData } = data;

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      if (label_ids !== undefined) {
        // Remove existing assignments
        await supabase
          .from('task_label_assignments')
          .delete()
          .eq('task_id', id);

        // Add new assignments
        if (label_ids.length > 0) {
          const { error: assignError } = await supabase
            .from('task_label_assignments')
            .insert(
              label_ids.map((label_id) => ({
                task_id: id,
                label_id,
              }))
            );
          if (assignError) throw assignError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast.error('Erro ao atualizar tarefa');
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa excluída');
    },
    onError: (error) => {
      console.error('Error deleting task:', error);
      toast.error('Erro ao excluir tarefa');
    },
  });
}

export function useCreateLabel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase.from('task_labels').insert({
        user_id: user.id,
        name: data.name,
        color: data.color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-labels'] });
      toast.success('Etiqueta criada');
    },
    onError: (error) => {
      console.error('Error creating label:', error);
      toast.error('Erro ao criar etiqueta');
    },
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_labels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-labels'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Etiqueta excluída');
    },
    onError: (error) => {
      console.error('Error deleting label:', error);
      toast.error('Erro ao excluir etiqueta');
    },
  });
}
