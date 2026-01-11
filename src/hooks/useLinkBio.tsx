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
      // Query all active link bio items ordered by order_index
      // Using anon key - the RLS policy allows public read access to active items
      const { data, error } = await supabase
        .from('link_bio_items')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      
      if (error) {
        console.error('Error fetching public link bio items:', error);
        return [];
      }
      
      return (data || []) as LinkBioItem[];
    },
    staleTime: 0, // Always fetch fresh data
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
      queryClient.invalidateQueries({ queryKey: ['public-link-bio-items'] });
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
      queryClient.invalidateQueries({ queryKey: ['public-link-bio-items'] });
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
      queryClient.invalidateQueries({ queryKey: ['public-link-bio-items'] });
    },
  });
}

export function useReorderLinkBioItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; order_index: number }[]) => {
      // Update all items in parallel
      const updates = items.map(item => 
        supabase
          .from('link_bio_items')
          .update({ order_index: item.order_index })
          .eq('id', item.id)
      );
      
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        throw new Error('Failed to update some items');
      }
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['link-bio-items'] });
      queryClient.invalidateQueries({ queryKey: ['public-link-bio-items'] });
    },
  });
}
