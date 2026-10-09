import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StoreDatabase } from '@/lib/storeTypes';
import { storeConnection } from '@/lib/storeConfig';

export function getStoreConnection() {
  return storeConnection(import.meta.env.VITE_STORE_SUPABASE_URL, import.meta.env.VITE_STORE_SUPABASE_PUBLISHABLE_KEY, import.meta.env.VITE_SUPABASE_URL);
}

let client: SupabaseClient<StoreDatabase> | undefined;
export function getStoreClient() {
  if (!client) {
    const config = getStoreConnection();
    client = createClient<StoreDatabase>(config.url, config.key, {
      auth: {
        storageKey: config.storageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: typeof window !== 'undefined' && window.location.pathname === '/loja/entrar',
      },
    });
  }
  return client;
}

// Resolve only when a store route uses the client. Missing store configuration
// must not break consultation pages, and must never fall back to their database.
export const storeDb = new Proxy({} as SupabaseClient<StoreDatabase>, {
  get(_target, property) {
    const instance = getStoreClient();
    const value = Reflect.get(instance, property);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
