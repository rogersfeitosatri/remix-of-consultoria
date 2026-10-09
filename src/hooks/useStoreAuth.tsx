import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { storeDb } from '@/integrations/supabase/storeClient';

type StoreAuthState = { session: Session | null; loading: boolean };
type StoreAuthValue = StoreAuthState & { user: Session['user'] | null; signOut: () => Promise<void> };
const StoreAuthContext = createContext<StoreAuthValue | undefined>(undefined);

function StoreQueryScope({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function StoreAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreAuthState>({ session: null, loading: true });
  useEffect(() => {
    let mounted = true;
    let receivedEvent = false;
    const { data: { subscription } } = storeDb.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      if (mounted) setState({ session, loading: false });
    });
    void storeDb.auth.getSession().then(({ data, error }) => {
      if (mounted && !receivedEvent) setState({ session: error ? null : data.session, loading: false });
    }).catch(() => { if (mounted && !receivedEvent) setState({ session: null, loading: false }); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  const value = useMemo<StoreAuthValue>(() => ({ ...state, user: state.session?.user ?? null, signOut: async () => {
    const { error } = await storeDb.auth.signOut({ scope: 'local' });
    if (error) throw error;
  } }), [state]);
  return <StoreAuthContext.Provider value={value}>
    {/* A different shopper never inherits cached orders or admin results. */}
    <StoreQueryScope key={state.loading ? 'loading' : state.session?.user.id ?? 'guest'}>{children}</StoreQueryScope>
  </StoreAuthContext.Provider>;
}

export function useStoreAuth() {
  const value = useContext(StoreAuthContext);
  if (!value) throw new Error('useStoreAuth requires StoreAuthProvider');
  return value;
}
