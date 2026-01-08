import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Extended category types for athlete area tabs
type SupportMaterialCategory = 'onboarding' | 'dieta' | 'material_suporte' | 'dashboard' | 'checkins' | 'feedbacks' | 'materiais' | 'historico' | 'perfil' | 'inicio' | 'desafio42' | 'controle';

interface SupportMaterial {
  id: string;
  user_id: string;
  category: SupportMaterialCategory;
  title: string | null;
  content: string | null;
  content_type: 'text' | 'youtube_video';
  youtube_url: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type { SupportMaterial, SupportMaterialCategory };

interface DietAppConfig {
  id: string;
  user_id: string;
  app_download_instructions: string | null;
  app_code: string | null;
  support_instructions: string | null;
  created_at: string;
  updated_at: string;
}

interface TimeBlock {
  id: string;
  settings_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

// Support Materials hooks
export function useSupportMaterials(category?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['support-materials', category, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('support_materials')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SupportMaterial[];
    },
    enabled: !!user,
  });
}

export function useAthleteSupportMaterials(category?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['athlete-support-materials', category, user?.id],
    queryFn: async () => {
      // Fetch ALL active support materials (shown to all athletes)
      let query = supabase
        .from('support_materials')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SupportMaterial[];
    },
    enabled: !!user,
  });
}

export function useCreateSupportMaterial() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (material: { 
      category: SupportMaterialCategory;
      title?: string;
      content?: string | null;
      content_type: 'text' | 'youtube_video';
      youtube_url?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('support_materials')
        .insert([{
          category: material.category,
          title: material.title || null,
          content: material.content || null,
          content_type: material.content_type,
          youtube_url: material.youtube_url || null,
          user_id: user?.id!,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-materials'] });
    },
  });
}

export function useUpdateSupportMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportMaterial> & { id: string }) => {
      const { data, error } = await supabase
        .from('support_materials')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-materials'] });
    },
  });
}

export function useDeleteSupportMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('support_materials')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-materials'] });
    },
  });
}

// Diet App Config hooks
export function useDietAppConfig() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['diet-app-config', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_app_config')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as DietAppConfig | null;
    },
    enabled: !!user,
  });
}

export function useAthleteDietAppConfig() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['athlete-diet-app-config', user?.id],
    queryFn: async () => {
      // Fetch ANY diet app config (first one found - for single-admin scenario)
      const { data, error } = await supabase
        .from('diet_app_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as DietAppConfig | null;
    },
    enabled: !!user,
  });
}

export function useSaveDietAppConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (config: Partial<DietAppConfig>) => {
      const { data: existing } = await supabase
        .from('diet_app_config')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('diet_app_config')
          .update(config)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('diet_app_config')
          .insert({
            ...config,
            user_id: user?.id,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diet-app-config'] });
    },
  });
}

// Time Blocks hooks
export function useTimeBlocks(settingsId?: string) {
  return useQuery({
    queryKey: ['time-blocks', settingsId],
    queryFn: async () => {
      if (!settingsId) return [];
      
      const { data, error } = await supabase
        .from('scheduling_time_blocks')
        .select('*')
        .eq('settings_id', settingsId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data as TimeBlock[];
    },
    enabled: !!settingsId,
  });
}

export function useAddTimeBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (block: Omit<TimeBlock, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('scheduling_time_blocks')
        .insert(block)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blocks'] });
    },
  });
}

export function useDeleteTimeBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduling_time_blocks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blocks'] });
    },
  });
}
