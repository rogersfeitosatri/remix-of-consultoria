import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
export const DEFAULT_SIDEBAR_ITEMS: SidebarItemConfig[] = [
  { key: '/admin', label: 'Dashboard', visible: true },
  { key: '/tasks', label: 'Tarefas', visible: true },
  { key: '/clients', label: 'Atletas', visible: true },
  { key: '/meal-plans', label: 'Plano Alimentar', visible: true },
  { key: '/checkin-hub', label: 'Check-ins', visible: true },
  { key: '/adjustments', label: 'Ajustes', visible: true },
  { key: '/financial', label: 'Financeiro', visible: true },
  { key: '/calendar', label: 'Calendário', visible: true },
  { key: '/scheduling', label: 'Agendamento', visible: true },
  { key: '/content', label: 'Conteúdo Atleta', visible: true },
  { key: '/forms', label: 'Formulários', visible: true },
  { key: '/ai-training', label: 'Central de IA', visible: true },
  { key: '/zn-assessoria', label: 'ZN Assessoria', visible: true },
  { key: '/settings', label: 'Configurações', visible: true },
];

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
    sidebar_items: (() => {
      // Routes moved into Settings — never show in sidebar
      const HIDDEN_ROUTES = new Set(['/calls', '/scheduling-links', '/link-bio', '/periodization', '/metabolic-web']);
      const saved = (settings?.sidebar_items || []) as unknown as SidebarItemConfig[];
      const base = saved.length === 0 ? DEFAULT_SIDEBAR_ITEMS : (() => {
        const savedKeys = new Set(saved.map(s => s.key));
        const newItems = DEFAULT_SIDEBAR_ITEMS.filter(d => !savedKeys.has(d.key));
        return [...saved, ...newItems];
      })();
      return base.filter(item => !HIDDEN_ROUTES.has(item.key));
    })(),
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
