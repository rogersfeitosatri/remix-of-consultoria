import { storeDb } from '@/integrations/supabase/storeClient';
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

export async function downloadStoreBook(orderId: string, title: string): Promise<void> {
  const { data, error } = await storeDb.functions.invoke('store-download', { body: { order_id: orderId } });
  if (error) {
    const detail = await error.context?.json?.().catch(() => null);
    throw new Error(detail?.error || 'Não foi possível preparar o livro. Tente novamente.');
  }
  if (!(data instanceof Blob) || data.type !== 'application/pdf') throw new Error('O arquivo não está disponível. Tente novamente.');
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\p{L}\p{N} -]/gu, '').trim() || 'livro'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
