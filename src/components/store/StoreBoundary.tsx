import { Outlet, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getStoreConnection, storeDb } from '@/integrations/supabase/storeClient';
import { StoreAuthProvider, useStoreAuth } from '@/hooks/useStoreAuth';
import { StoreLayout, StoreMessage } from './StoreLayout';
import '@/styles/store.css';

export default function StoreBoundary() {
  try { getStoreConnection(); } catch {
    return <div className="rf-store"><main className="store-container"><StoreMessage title="A loja está em preparação"><p>Estamos preparando o acesso aos livros. Volte em breve.</p><Link className="store-text-button" to="/">Voltar ao site</Link></StoreMessage></main></div>;
  }
  return <StoreAuthProvider><Outlet /></StoreAuthProvider>;
}

export function StoreAdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useStoreAuth();
  const role = useQuery({
    queryKey: ['store', 'admin-access', user?.id], enabled: !!user && !loading,
    staleTime: 0, retry: false,
    queryFn: async () => {
      const { data, error } = await storeDb.from('store_admins').select('user_id').eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  if (loading) return <StoreLayout><StoreMessage title="Carregando…" /></StoreLayout>;
  if (!user) return <Navigate to="/loja/entrar?next=%2Floja%2Fadmin" replace />;
  if (role.isPending) return <StoreLayout><StoreMessage title="Verificando acesso…" /></StoreLayout>;
  if (role.isError) return <StoreLayout><StoreMessage title="Não foi possível verificar seu acesso" error><button className="store-text-button" onClick={() => role.refetch()}>Tentar novamente</button></StoreMessage></StoreLayout>;
  if (!role.data) return <StoreLayout><StoreMessage title="Área exclusiva da administração"><p>Esta conta não tem acesso à administração da loja.</p><Link className="store-button" to="/loja/pedidos">Meus pedidos</Link></StoreMessage></StoreLayout>;
  return <>{children}</>;
}
