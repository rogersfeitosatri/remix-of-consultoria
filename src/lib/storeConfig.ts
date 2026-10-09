export function isStorePath(pathname: string): boolean {
  return pathname === '/loja' || pathname.startsWith('/loja/') || pathname === '/admin/loja';
}

export function storeConnection(url: string | undefined, key: string | undefined, consultationUrl?: string) {
  if (!url || !key) throw new Error('Configure VITE_STORE_SUPABASE_URL e VITE_STORE_SUPABASE_PUBLISHABLE_KEY.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(parsed.hostname) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('A URL da loja deve apontar para um projeto Supabase.');
  }
  if (consultationUrl && parsed.origin === new URL(consultationUrl).origin) throw new Error('A loja precisa de um projeto diferente da consultoria.');
  // Reject privileged keys before a client is constructed. Legacy anon keys are
  // allowed for compatibility, but their role must explicitly be anon.
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      publicKey = key.split('.').length === 3 && payload.role === 'anon';
    } catch { publicKey = false; }
  }
  if (!publicKey) throw new Error('Use somente a chave publicável da loja.');
  const projectRef = parsed.hostname.split('.')[0];
  return {
    url: parsed.origin, key, projectRef,
    storageKey: `sb-store-${projectRef}-auth-token`,
    webhookUrl: `${parsed.origin}/functions/v1/store-stripe-webhook`,
    secretsUrl: `https://supabase.com/dashboard/project/${projectRef}/functions/secrets`,
  };
}
