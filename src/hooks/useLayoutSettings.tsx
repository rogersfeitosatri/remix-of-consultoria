import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ADMIN_NAVIGATION, ADMIN_SETTINGS_ITEM } from '@/lib/adminNavigation';

export interface SidebarItemConfig {
  key: string;
  label: string;
  visible: boolean;
}

export interface LayoutSettings {
  id?: string;
  sidebar_items: SidebarItemConfig[];
  brand_name: string;
  brand_subtitle: string;
  logo_url: string | null;
  avatar_url: string | null;
}

// Default sidebar items matching current navItems order
export const DEFAULT_SIDEBAR_ITEMS: SidebarItemConfig[] = [...ADMIN_NAVIGATION, ADMIN_SETTINGS_ITEM];

export function useLayoutSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['layout-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('admin_layout_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Merge saved settings with defaults (handles new items added after user saved)
  const mergedSettings: LayoutSettings = useMemo(() => ({
    brand_name: settings?.brand_name || 'Rogers Feitosa',
    brand_subtitle: settings?.brand_subtitle || 'Nutrição & Treinamento',
    logo_url: settings?.logo_url || null,
    avatar_url: settings?.avatar_url || null,
    // Old saved menus must not reintroduce duplicate destinations. Branding is preserved.
    sidebar_items: DEFAULT_SIDEBAR_ITEMS,
  }), [settings]);

  const saveSettings = useMutation({
    mutationFn: async (input: Partial<LayoutSettings>) => {
      if (!user?.id) throw new Error('Not authenticated');
      const row: Record<string, unknown> = {
        user_id: user.id,
      };
      if (input.sidebar_items !== undefined) row.sidebar_items = JSON.parse(JSON.stringify(input.sidebar_items));
      if (input.brand_name !== undefined) row.brand_name = input.brand_name;
      if (input.brand_subtitle !== undefined) row.brand_subtitle = input.brand_subtitle;
      if (input.logo_url !== undefined) row.logo_url = input.logo_url;
      if (input.avatar_url !== undefined) row.avatar_url = input.avatar_url;

      if (settings?.id) {
        const { error } = await supabase
          .from('admin_layout_settings')
          .update(row as any)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_layout_settings')
          .insert(row as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layout-settings'] });
      toast.success('Configurações de layout salvas!');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar layout: ' + err.message);
    },
  });

  return { settings: mergedSettings, isLoading, saveSettings, rawSettings: settings };
}
