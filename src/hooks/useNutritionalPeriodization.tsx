import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export function useNutritionalPeriodization(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch consultations for a client
  const { data: consultations = [], isLoading: loadingConsultations } = useQuery({
    queryKey: ['np-consultations', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('np_consultations')
        .select('*')
        .eq('client_id', clientId)
        .order('consultation_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Save consultation
  const saveConsultation = useMutation({
    mutationFn: async (consultation: any) => {
      if (consultation.id) {
        const { data, error } = await supabase
          .from('np_consultations')
          .update(consultation)
          .eq('id', consultation.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('np_consultations')
          .insert({ ...consultation, user_id: user?.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['np-consultations', clientId] });
      toast({ title: 'Consulta salva com sucesso' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  // Body assessments
  const fetchAssessments = (consultationId: string) =>
    useQuery({
      queryKey: ['np-assessments', consultationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('np_body_assessments')
          .select('*')
          .eq('consultation_id', consultationId)
          .order('assessment_date', { ascending: false });
        if (error) throw error;
        return data;
      },
      enabled: !!consultationId,
    });

  const saveAssessment = useMutation({
    mutationFn: async (assessment: any) => {
      if (assessment.id) {
        const { data, error } = await supabase
          .from('np_body_assessments')
          .update(assessment)
          .eq('id', assessment.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('np_body_assessments')
          .insert(assessment)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['np-assessments'] });
      toast({ title: 'Avaliação salva com sucesso' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar avaliação', description: err.message, variant: 'destructive' });
    },
  });

  // Daily activities
  const fetchActivities = (consultationId: string) =>
    useQuery({
      queryKey: ['np-activities', consultationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('np_daily_activities')
          .select('*')
          .eq('consultation_id', consultationId)
          .order('order_index');
        if (error) throw error;
        return data;
      },
      enabled: !!consultationId,
    });

  const saveActivities = useMutation({
    mutationFn: async ({ consultationId, activities }: { consultationId: string; activities: any[] }) => {
      // Delete existing and reinsert
      await supabase.from('np_daily_activities').delete().eq('consultation_id', consultationId);
      if (activities.length > 0) {
        const { error } = await supabase.from('np_daily_activities').insert(
          activities.map((a, i) => ({ ...a, consultation_id: consultationId, order_index: i }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['np-activities'] });
    },
  });

  // Running zones
  const fetchRunningZones = (consultationId: string) =>
    useQuery({
      queryKey: ['np-running-zones', consultationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('np_running_zones')
          .select('*')
          .eq('consultation_id', consultationId)
          .order('order_index');
        if (error) throw error;
        return data;
      },
      enabled: !!consultationId,
    });

  const saveRunningZones = useMutation({
    mutationFn: async ({ consultationId, zones }: { consultationId: string; zones: any[] }) => {
      await supabase.from('np_running_zones').delete().eq('consultation_id', consultationId);
      if (zones.length > 0) {
        const { data, error } = await supabase.from('np_running_zones').insert(
          zones.map((z, i) => ({ ...z, consultation_id: consultationId, order_index: i }))
        ).select();
        if (error) throw error;
        return data;
      }
      return [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['np-running-zones'] });
    },
  });

  // Running schedule
  const fetchRunningSchedule = (consultationId: string) =>
    useQuery({
      queryKey: ['np-running-schedule', consultationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('np_running_schedule')
          .select('*, np_running_zones(*)')
          .eq('consultation_id', consultationId);
        if (error) throw error;
        return data;
      },
      enabled: !!consultationId,
    });

  const saveRunningSchedule = useMutation({
    mutationFn: async ({ consultationId, schedule }: { consultationId: string; schedule: any[] }) => {
      await supabase.from('np_running_schedule').delete().eq('consultation_id', consultationId);
      if (schedule.length > 0) {
        const { error } = await supabase.from('np_running_schedule').insert(
          schedule.map(s => ({ ...s, consultation_id: consultationId }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['np-running-schedule'] });
    },
  });

  // Triathlon schedule
  const fetchTriathlonSchedule = (consultationId: string) =>
    useQuery({
      queryKey: ['np-triathlon-schedule', consultationId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('np_triathlon_schedule')
          .select('*')
          .eq('consultation_id', consultationId);
        if (error) throw error;
        return data;
      },
      enabled: !!consultationId,
    });

  const saveTriathlonSchedule = useMutation({
    mutationFn: async ({ consultationId, schedule }: { consultationId: string; schedule: any[] }) => {
      await supabase.from('np_triathlon_schedule').delete().eq('consultation_id', consultationId);
      if (schedule.length > 0) {
        const { error } = await supabase.from('np_triathlon_schedule').insert(
          schedule.map(s => ({ ...s, consultation_id: consultationId }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['np-triathlon-schedule'] });
    },
  });

  // Periodization weeks
  const fetchPeriodizationWeeks = (cId: string) =>
    useQuery({
      queryKey: ['np-periodization-weeks', cId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('np_periodization_weeks')
          .select('*')
          .eq('client_id', cId)
          .order('week_number');
        if (error) throw error;
        return data;
      },
      enabled: !!cId,
    });

  const savePeriodizationWeek = useMutation({
    mutationFn: async (week: any) => {
      if (week.id) {
        const { data, error } = await supabase
          .from('np_periodization_weeks')
          .update(week)
          .eq('id', week.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('np_periodization_weeks')
          .insert({ ...week, user_id: user?.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['np-periodization-weeks'] });
      toast({ title: 'Semana salva com sucesso' });
    },
  });

  // Lab results
  const fetchLabResults = (cId: string) =>
    useQuery({
      queryKey: ['np-lab-results', cId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('np_lab_results')
          .select('*')
          .eq('client_id', cId)
          .order('collection_date', { ascending: false });
        if (error) throw error;
        return data;
      },
      enabled: !!cId,
    });

  const saveLabResult = useMutation({
    mutationFn: async (result: any) => {
      if (result.id) {
        const { data, error } = await supabase
          .from('np_lab_results')
          .update(result)
          .eq('id', result.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('np_lab_results')
          .insert({ ...result, user_id: user?.id })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['np-lab-results'] });
      toast({ title: 'Resultado salvo' });
    },
  });

  const deleteLabResult = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('np_lab_results').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['np-lab-results'] });
    },
  });

  return {
    consultations,
    loadingConsultations,
    saveConsultation,
    fetchAssessments,
    saveAssessment,
    fetchActivities,
    saveActivities,
    fetchRunningZones,
    saveRunningZones,
    fetchRunningSchedule,
    saveRunningSchedule,
    fetchTriathlonSchedule,
    saveTriathlonSchedule,
    fetchPeriodizationWeeks,
    savePeriodizationWeek,
    fetchLabResults,
    saveLabResult,
    deleteLabResult,
  };
}
