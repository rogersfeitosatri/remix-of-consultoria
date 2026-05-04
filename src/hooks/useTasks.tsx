import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type TaskType = 'meal_plan' | 'checkin_response' | 'consultation_prep' | 'diet_adjustment' | 'custom';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskSource = 'manual' | 'auto_anamnese' | 'auto_checkin' | 'auto_consultation' | 'auto_diet';

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  meal_plan: 'Plano Alimentar',
  checkin_response: 'Check-in',
  consultation_prep: 'Consulta',
  diet_adjustment: 'Ajuste Dieta',
  custom: 'Geral',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  done: 'Concluída',
  overdue: 'Atrasada',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

export interface TaskLabel {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

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
  client_id: string | null;
  task_type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  recurrence_type: RecurrenceType;
  recurrence_days: number[] | null;
  recurrence_day_of_month: number | null;
  recurrence_interval: number;
  recurrence_end_date: string | null;
  parent_task_id: string | null;
  xp_reward: number;
  labels?: TaskLabel[];
  client_name?: string;
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
      const taskIds = tasks.map((t: any) => t.id);
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

      // Fetch client names for tasks with client_id
      const clientIds = [...new Set(tasks.filter((t: any) => t.client_id).map((t: any) => t.client_id))];
      let clientMap = new Map<string, string>();
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds);
        if (clients) {
          clientMap = new Map(clients.map((c: any) => [c.id, c.name]));
        }
      }

      const labelMap = new Map(labels.map((l: TaskLabel) => [l.id, l]));

      // Auto-calculate overdue status
      const today = new Date().toISOString().split('T')[0];

      return tasks.map((task: any) => {
        let computedStatus = task.status as TaskStatus;
        if (task.due_date && task.due_date < today && task.status === 'pending') {
          computedStatus = 'overdue';
        }

        // Auto-calculate priority based on due date
        let computedPriority = task.priority as TaskPriority;
        if (computedStatus === 'overdue') {
          computedPriority = 'urgent';
        } else if (task.due_date === today && task.priority === 'medium') {
          computedPriority = 'high';
        }

        return {
          ...task,
          status: computedStatus,
          priority: computedPriority,
          client_name: task.client_id ? clientMap.get(task.client_id) || null : null,
          labels: (assignments || [])
            .filter((a: { task_id: string; label_id: string }) => a.task_id === task.id)
            .map((a: { task_id: string; label_id: string }) => labelMap.get(a.label_id))
            .filter(Boolean) as TaskLabel[],
        };
      }) as TaskWithLabels[];
    },
    enabled: !!user?.id,
  });
}

export function useTasksByDate(date?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tasks-by-date', user?.id, date],
    queryFn: async () => {
      if (!user?.id || !date) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*, clients(name)')
        .eq('user_id', user.id)
        .eq('due_date', date)
        .eq('is_archived', false)
        .order('priority')
        .order('created_at');

      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        client_name: t.clients?.name || null,
      })) as Task[];
    },
    enabled: !!user?.id && !!date,
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
      client_id?: string;
      task_type?: TaskType;
      priority?: TaskPriority;
      recurrence_type?: RecurrenceType;
      recurrence_days?: number[] | null;
      recurrence_day_of_month?: number | null;
      recurrence_interval?: number;
      recurrence_end_date?: string | null;
      xp_reward?: number;
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
          client_id: data.client_id || null,
          task_type: data.task_type || 'custom',
          priority: data.priority || 'medium',
          source: 'manual',
          recurrence_type: data.recurrence_type || 'none',
          recurrence_days: data.recurrence_days ?? null,
          recurrence_day_of_month: data.recurrence_day_of_month ?? null,
          recurrence_interval: data.recurrence_interval ?? 1,
          recurrence_end_date: data.recurrence_end_date ?? null,
          xp_reward: data.xp_reward ?? 10,
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
      status?: TaskStatus;
      priority?: TaskPriority;
      client_id?: string | null;
      task_type?: TaskType;
      completed_at?: string | null;
    }) => {
      const { id, label_ids, ...updateData } = data;

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      if (label_ids !== undefined) {
        await supabase
          .from('task_label_assignments')
          .delete()
          .eq('task_id', id);

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

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          is_archived: true,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa concluída!');
    },
    onError: () => {
      toast.error('Erro ao concluir tarefa');
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
