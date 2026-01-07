import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LinkBioItem {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  link_url: string | null;
  image_url: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useLinkBioItems() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['link-bio-items', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('link_bio_items')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as LinkBioItem[];
    },
    enabled: !!user,
  });
}

export function usePublicLinkBioItems() {
  return useQuery({
    queryKey: ['public-link-bio-items'],
    queryFn: async () => {
      // Get the first admin's link bio items
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single();
      
      if (!adminRole) return [];
      
      const { data, error } = await supabase
        .from('link_bio_items')
        .select('*')
        .eq('user_id', adminRole.user_id)
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data as LinkBioItem[];
    },
  });
}

export function useCreateLinkBioItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: Omit<LinkBioItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('link_bio_items')
        .insert({
          ...item,
          user_id: user?.id!,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-bio-items'] });
    },
  });
}

export function useUpdateLinkBioItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LinkBioItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('link_bio_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-bio-items'] });
    },
  });
}

export function useDeleteLinkBioItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('link_bio_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-bio-items'] });
    },
  });
}
