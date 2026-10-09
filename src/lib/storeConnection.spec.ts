import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStorePath, storeConnection } from './storeConfig';

const url = 'https://storeproject.supabase.co';
const key = 'sb_publishable_store_public_key';
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks(); });

describe('separate store connection', () => {
  it('does not fall back to consultation config or accept the same project', () => {
    expect(() => storeConnection(undefined, undefined, url)).toThrow('VITE_STORE');
    expect(() => storeConnection(url, key, `${url}/`)).toThrow('diferente');
    expect(() => storeConnection(url, undefined)).toThrow();
  });
  it.each(['sb_secret_private', 'service_role', 'sk_live_stripe', `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`])('rejects a privileged or unrelated key %s', unsafe => {
    expect(() => storeConnection(url, unsafe)).toThrow('publicável');
  });
  it('gives the new project its own session storage and webhook', () => {
    expect(storeConnection(url, key)).toMatchObject({ storageKey: 'sb-store-storeproject-auth-token', webhookUrl: `${url}/functions/v1/store-stripe-webhook` });
    expect(storeConnection(url, `header.${btoa(JSON.stringify({ role: 'anon' }))}.signature`).projectRef).toBe('storeproject');
  });
  it.each(['http://storeproject.supabase.co', 'https://storeproject.supabase.co.evil.test', `${url}/rest/v1`, `${url}?key=test`])('rejects malformed connection URL %s', invalid => {
    expect(() => storeConnection(invalid, key)).toThrow();
  });
  it('keeps store callbacks out of consultation auth detection', () => {
    for (const path of ['/loja', '/loja/entrar', '/loja/pedidos', '/loja/admin', '/admin/loja']) expect(isStorePath(path)).toBe(true);
    for (const path of ['/', '/auth', '/admin', '/lojas', '/admin/lojax']) expect(isStorePath(path)).toBe(false);
  });
  it('can import store modules without configuration and fails before any network call on use', async () => {
    vi.stubEnv('VITE_STORE_SUPABASE_URL', '');
    vi.stubEnv('VITE_STORE_SUPABASE_PUBLISHABLE_KEY', '');
    const fetcher = vi.spyOn(globalThis, 'fetch');
    const { storeDb } = await import('../integrations/supabase/storeClient');
    expect(() => storeDb.from('store_orders')).toThrow('VITE_STORE');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
