import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Contato quinzenal: além dos check-ins, um "oi" no WhatsApp a cada ~14 dias
// para cada atleta ATIVO. Quem foi contatado nos últimos 14 dias fica "em dia";
// os demais aparecem como pendentes. Atleta inativado sai da lista sozinho.
export const CONTACT_CYCLE_DAYS = 14;

export interface ContactRow {
  id: string;
  name: string;
  phone: string | null;
  lastContactedAt: string | null; // ISO ou null (nunca)
  daysSince: number | null;       // null = nunca
  done: boolean;                  // contatado dentro do ciclo atual
}

function daysBetween(iso: string): number {
  const then = new Date(iso).getTime();
  return Math.floor((Date.now() - then) / 86_400_000);
}

export function useBiweeklyContacts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['biweekly-contacts', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<ContactRow[]> => {
      // 1) Atletas ativos (não congelados / inativados).
      const { data: clients, error: cErr } = await supabase
        .from('clients')
        .select('id, name, phone')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .eq('is_frozen', false)
        .order('name');
      if (cErr) throw cErr;

      // 2) Contatos recentes (janela de ~60 dias basta para o ciclo).
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
      let contactByClient = new Map<string, string>(); // client_id → último contacted_at
      try {
        const { data: contacts } = await (supabase as any)
          .from('client_contacts')
          .select('client_id, contacted_at')
          .eq('user_id', user!.id)
          .gte('contacted_at', since)
          .order('contacted_at', { ascending: false });
        for (const c of (contacts || [])) {
          if (!contactByClient.has(c.client_id)) contactByClient.set(c.client_id, c.contacted_at);
        }
      } catch { /* tabela pode não existir ainda → todos aparecem como pendentes */ }

      return (clients || []).map((c: any) => {
        const last = contactByClient.get(c.id) ?? null;
        const daysSince = last ? daysBetween(last) : null;
        const done = daysSince != null && daysSince < CONTACT_CYCLE_DAYS;
        return { id: c.id, name: c.name, phone: c.phone ?? null, lastContactedAt: last, daysSince, done };
      });
    },
  });

  const rows = query.data ?? [];
  const pending = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done);

  const markContacted = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await (supabase as any)
        .from('client_contacts')
        .insert({ user_id: user!.id, client_id: clientId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biweekly-contacts', user?.id] }),
  });

  const undoContact = useMutation({
    mutationFn: async (clientId: string) => {
      // Remove os contatos do CICLO atual → volta a ser pendente.
      const cutoff = new Date(Date.now() - CONTACT_CYCLE_DAYS * 86_400_000).toISOString();
      const { error } = await (supabase as any)
        .from('client_contacts')
        .delete()
        .eq('user_id', user!.id)
        .eq('client_id', clientId)
        .gte('contacted_at', cutoff);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['biweekly-contacts', user?.id] }),
  });

  return {
    rows, pending, done,
    total: rows.length,
    isLoading: query.isLoading,
    markContacted: (id: string) => markContacted.mutate(id),
    undoContact: (id: string) => undoContact.mutate(id),
  };
}
