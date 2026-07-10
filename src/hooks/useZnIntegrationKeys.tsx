import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ZnIntegrationApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  created_by: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

function generateKey(): string {
  // Chave forte: znk_ + 48 chars base62 aleatórios
  const bytes = new Uint8Array(36);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `znk_${out}`;
}

export function useZnIntegrationKeys() {
  return useQuery({
    queryKey: ['zn-integration-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zn_integration_api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ZnIntegrationApiKey[];
    },
  });
}

export function useCreateZnIntegrationKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const key = generateKey();
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('zn_integration_api_keys')
        .insert({ name, key, created_by: userData.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as ZnIntegrationApiKey;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn-integration-keys'] });
      toast.success('Nova chave gerada');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao gerar chave'),
  });
}

export function useRevokeZnIntegrationKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('zn_integration_api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zn-integration-keys'] });
      toast.success('Chave revogada');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao revogar'),
  });
}
