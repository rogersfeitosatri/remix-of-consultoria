import { getStoreConnection, storeDb } from '@/integrations/supabase/storeClient';
export { storeDb };

export async function storeAction<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await storeDb.functions.invoke('store-api', { body: { action, ...input } });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error || 'Não foi possível concluir. Tente novamente em instantes.');
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function prepareStoreBookDownload(orderId: string): Promise<{ url: string; expiresAt: number }> {
  const { data, error } = await storeDb.functions.invoke('store-download', { body: { order_id: orderId, delivery: 'link' } });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error || 'Não foi possível preparar o livro. Tente novamente.');
  }
  const url = new URL(data?.download_url || '', getStoreConnection().url);
  const expiresAt = Date.parse(data?.expires_at);
  if (url.protocol !== 'https:' || url.origin !== new URL(getStoreConnection().url).origin ||
      !url.pathname.startsWith('/storage/v1/object/sign/store-deliveries/') ||
      !url.searchParams.get('token') || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error('O link não está disponível. Tente novamente.');
  }
  return { url: url.href, expiresAt };
}
