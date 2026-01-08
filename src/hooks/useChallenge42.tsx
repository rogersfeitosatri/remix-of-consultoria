import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChallengeActivity {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_active: boolean;
  is_default: boolean;
  required_days: number;
  created_at: string;
  updated_at: string;
}

export interface AthleteProgress {
  id: string;
  client_id: string;
  current_week: number;
  started_at: string;
  completed_weeks: number[];
  created_at: string;
  updated_at: string;
}

export interface DailyMark {
  id: string;
  client_id: string;
  week_number: number;
  day_of_week: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

// Admin: Get all challenge activities
export function useChallengeActivitiesAdmin() {
  return useQuery({
    queryKey: ['challenge-activities-admin'],
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

// Athlete: Get active challenge activities (6 weeks)
export function useAthleteActivities() {
  return useQuery({
    queryKey: ['athlete-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenge_activities')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
        .limit(6);
      if (error) throw error;
      return data as ChallengeActivity[];
    },
  });
}

// Athlete: Get progress
export function useAthleteProgress(clientId?: string) {
  return useQuery({
    queryKey: ['athlete-progress', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('athlete_challenge_progress')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      if (error) throw error;
      return data as AthleteProgress | null;
    },
    enabled: !!clientId,
  });
}

// Athlete: Get daily marks for current challenge
export function useAthleteDailyMarks(clientId?: string) {
  return useQuery({
    queryKey: ['athlete-daily-marks', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('challenge_daily_marks')
        .select('*')
        .eq('client_id', clientId)
        .order('week_number', { ascending: true })
        .order('day_of_week', { ascending: true });
      if (error) throw error;
      return data as DailyMark[];
    },
    enabled: !!clientId,
  });
}

// Start challenge (create progress record)
export function useStartChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase
        .from('athlete_challenge_progress')
        .insert({
          client_id: clientId,
          current_week: 1,
          completed_weeks: [],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['athlete-progress', clientId] });
    },
  });
}

// Toggle daily mark
export function useToggleDailyMark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      clientId, 
      weekNumber, 
      dayOfWeek, 
      completed 
    }: { 
      clientId: string; 
      weekNumber: number; 
      dayOfWeek: number;
      completed: boolean;
    }) => {
      if (completed) {
        const { data, error } = await supabase
          .from('challenge_daily_marks')
          .upsert({
            client_id: clientId,
            week_number: weekNumber,
            day_of_week: dayOfWeek,
            completed: true,
            completed_at: new Date().toISOString(),
          }, { onConflict: 'client_id,week_number,day_of_week' })
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { error } = await supabase
          .from('challenge_daily_marks')
          .delete()
          .eq('client_id', clientId)
          .eq('week_number', weekNumber)
          .eq('day_of_week', dayOfWeek);
        if (error) throw error;
        return null;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['athlete-daily-marks', variables.clientId] });
    },
  });
}

// Complete week and unlock next
export function useCompleteWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, weekNumber }: { clientId: string; weekNumber: number }) => {
      // Get current progress
      const { data: progress, error: fetchError } = await supabase
        .from('athlete_challenge_progress')
        .select('*')
        .eq('client_id', clientId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const completedWeeks = progress.completed_weeks || [];
      if (!completedWeeks.includes(weekNumber)) {
        completedWeeks.push(weekNumber);
      }
      
      const nextWeek = Math.min(weekNumber + 1, 6);
      
      const { data, error } = await supabase
        .from('athlete_challenge_progress')
        .update({
          completed_weeks: completedWeeks,
          current_week: nextWeek,
          updated_at: new Date().toISOString(),
        })
        .eq('client_id', clientId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['athlete-progress', variables.clientId] });
    },
  });
}

// Admin: Reset week for athlete
export function useResetAthleteWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, weekNumber }: { clientId: string; weekNumber: number }) => {
      // Remove daily marks for this week
      await supabase
        .from('challenge_daily_marks')
        .delete()
        .eq('client_id', clientId)
        .eq('week_number', weekNumber);
      
      // Update progress to remove from completed
      const { data: progress } = await supabase
        .from('athlete_challenge_progress')
        .select('completed_weeks')
        .eq('client_id', clientId)
        .single();
      
      if (progress) {
        const completedWeeks = (progress.completed_weeks || []).filter((w: number) => w !== weekNumber);
        await supabase
          .from('athlete_challenge_progress')
          .update({
            completed_weeks: completedWeeks,
            current_week: weekNumber,
          })
          .eq('client_id', clientId);
      }
      
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['athlete-progress', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['athlete-daily-marks', variables.clientId] });
    },
  });
}

// Admin: Update activity
export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ChallengeActivity> & { id: string }) => {
      const { data, error } = await supabase
        .from('challenge_activities')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge-activities-admin'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-activities'] });
    },
  });
}

// Admin: Create default activities
export function useCreateDefaultActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const defaultActivities = [
        { title: 'Semana 1: Hidratação', description: 'Beba pelo menos 2 litros de água por dia', order_index: 0 },
        { title: 'Semana 2: Alimentação Consciente', description: 'Coma sem distrações (TV, celular)', order_index: 1 },
        { title: 'Semana 3: Movimento Diário', description: 'Faça pelo menos 30 minutos de atividade física', order_index: 2 },
        { title: 'Semana 4: Sono Reparador', description: 'Durma pelo menos 7 horas por noite', order_index: 3 },
        { title: 'Semana 5: Planejamento', description: 'Planeje suas refeições do dia seguinte', order_index: 4 },
        { title: 'Semana 6: Gratidão', description: 'Anote 3 coisas pelas quais você é grato', order_index: 5 },
      ];

      const { data, error } = await supabase
        .from('challenge_activities')
        .insert(
          defaultActivities.map(a => ({
            ...a,
            user_id: userId,
            is_active: true,
            is_default: true,
            required_days: 7,
          }))
        )
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge-activities-admin'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-activities'] });
    },
  });
}
