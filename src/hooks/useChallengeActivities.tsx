import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChallengeActivity {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeeklyMark {
  id: string;
  client_id: string;
  activity_id: string;
  week_number: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

// Admin: Get all challenge activities
export function useChallengeActivities() {
  return useQuery({
    queryKey: ['challenge-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenge_activities')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as ChallengeActivity[];
    },
  });
}

// Athlete: Get active challenge activities
export function useAthleteChallengeActivities() {
  return useQuery({
    queryKey: ['athlete-challenge-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenge_activities')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as ChallengeActivity[];
    },
  });
}

// Create activity (Admin)
export function useCreateChallengeActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: result, error } = await supabase
        .from('challenge_activities')
        .insert({ ...data, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge-activities'] });
    },
  });
}

// Update activity (Admin)
export function useUpdateChallengeActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title?: string; description?: string; is_active?: boolean; order_index?: number }) => {
      const { data: result, error } = await supabase
        .from('challenge_activities')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge-activities'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-challenge-activities'] });
    },
  });
}

// Reorder activities (Admin) - move up or down
export function useReorderChallengeActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ activities }: { activities: { id: string; order_index: number }[] }) => {
      // Update all activities with new order_index
      const updates = activities.map(({ id, order_index }) =>
        supabase
          .from('challenge_activities')
          .update({ order_index, updated_at: new Date().toISOString() })
          .eq('id', id)
      );
      
      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge-activities'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-challenge-activities'] });
    },
  });
}

// Delete activity (Admin)
export function useDeleteChallengeActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('challenge_activities')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge-activities'] });
    },
  });
}

// Athlete: Get weekly marks for a client
export function useAthleteWeeklyMarks(clientId?: string) {
  return useQuery({
    queryKey: ['athlete-weekly-marks', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('challenge_weekly_marks')
        .select('*')
        .eq('client_id', clientId);
      if (error) throw error;
      return data as WeeklyMark[];
    },
    enabled: !!clientId,
  });
}

// Athlete: Toggle weekly mark
export function useToggleWeeklyMark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, activityId, weekNumber, completed }: { 
      clientId: string; 
      activityId: string; 
      weekNumber: number;
      completed: boolean;
    }) => {
      if (completed) {
        // Insert or update to completed
        const { data, error } = await supabase
          .from('challenge_weekly_marks')
          .upsert({
            client_id: clientId,
            activity_id: activityId,
            week_number: weekNumber,
            completed: true,
            completed_at: new Date().toISOString(),
          }, { onConflict: 'client_id,activity_id,week_number' })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Update to not completed
        const { error } = await supabase
          .from('challenge_weekly_marks')
          .delete()
          .eq('client_id', clientId)
          .eq('activity_id', activityId)
          .eq('week_number', weekNumber);
        if (error) throw error;
        return null;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['athlete-weekly-marks', variables.clientId] });
    },
  });
}
