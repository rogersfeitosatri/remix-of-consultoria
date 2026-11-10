import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { useStoreAuth } from '@/hooks/useStoreAuth';
import { StoreLayout, StoreMessage } from '@/components/store/StoreLayout';
import { prepareStoreBookDownload, storeAction, storeDb } from '@/lib/storeApi';
import { storeCurrency, type StoreOrder } from '@/lib/storeTypes';

const labels = { pending: 'Aguardando confirmação do pagamento', paid: 'Disponível para download', refunded: 'Pagamento reembolsado', disputed: 'Pagamento em contestação', cancelled: 'Pagamento não concluído' };
export default function StoreOrders() {
  const { user, loading } = useStoreAuth();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [readyDownload, setReadyDownload] = useState<{ orderId: string; url: string; expiresAt: number } | null>(null);
  const inAppBrowser = /Instagram|FBAN|FBAV|; wv\)/i.test(navigator.userAgent);
  useEffect(() => {
    if (!readyDownload) return;
    const timer = window.setTimeout(() => setReadyDownload(null), Math.max(0, readyDownload.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [readyDownload]);
  useEffect(() => { setReadyDownload(null); }, [user?.id]);
  const orders = useQuery({ queryKey: ['store', 'orders', user?.id], queryFn: async () => {
    const { data, error } = await storeDb.from('store_orders').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }, enabled: !!user, refetchOnWindowFocus: true, refetchInterval: query => query.state.data?.some(o => o.status === 'pending') ? 15000 : false });
  async function download(order: StoreOrder) {
    setBusy(order.id); setError(''); setReadyDownload(null);
    try { setReadyDownload({ orderId: order.id, ...await prepareStoreBookDownload(order.id) }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível baixar o livro.'); }
    finally { setBusy(''); }
  }
  async function pay(order: StoreOrder) {
    setBusy(order.id); setError('');
    try {
      const result = await storeAction<{ checkout_url?: string; owned?: boolean }>('checkout', { product_id: order.product_id });
      if (result.owned) await orders.refetch();
      else if (result.checkout_url) window.location.assign(result.checkout_url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o pagamento.'); }
    finally { setBusy(''); }
  }
  async function refresh() {
    setBusy('refresh'); setError('');
    try { await storeAction('sync-orders'); await orders.refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar os pedidos.'); }
    finally { setBusy(''); }
  }
  if (!loading && !user) return <Navigate to="/loja/entrar?next=%2Floja%2Fpedidos" replace />;
  return <StoreLayout><section className="store-intro"><div className="store-order-heading"><h1>Meus pedidos</h1><button className="store-text-button" onClick={refresh} disabled={!!busy}>{busy === 'refresh' ? 'Atualizando…' : 'Atualizar pagamentos'}</button></div><p>Seus livros, sempre por aqui.</p></section>
    {params.get('checkout') === 'success' && orders.data?.some(order => order.status === 'pending') && <p className="store-notice" role="status">Estamos aguardando a confirmação do pagamento. O download será liberado automaticamente assim que ela chegar.</p>}
    {params.get('checkout') === 'cancelled' && <p className="store-notice">O pagamento não foi concluído. Você pode continuar quando quiser.</p>}
    {error && <p className="store-error" role="alert">{error}</p>}
    {inAppBrowser && <p className="store-notice">Se o download não abrir neste aplicativo, toque no menu ⋮ ou ⋯ e escolha “Abrir no navegador”. No Chrome ou Safari, acesse <strong>rogersfeitosa.com.br/loja/pedidos</strong> e entre com a conta usada na compra.</p>}
    {readyDownload && <p className="store-notice" role="status">Seu livro está pronto. Toque em “Salvar livro” abaixo. O link vale por 2 minutos; depois, você pode gerar outro gratuitamente.</p>}
    {loading || orders.isPending ? <StoreMessage title="Carregando seus pedidos…" /> : orders.isError ? <StoreMessage title="Não foi possível carregar seus pedidos" error><button className="store-text-button" onClick={() => orders.refetch()}>Tentar novamente</button></StoreMessage>
      : !orders.data?.length ? <StoreMessage title="Seus próximos livros vão aparecer aqui"><p>Após a compra, você poderá baixar o PDF por esta página.</p><Link className="store-button" to="/loja">Conhecer os livros</Link></StoreMessage>
      : <div className="store-orders">{orders.data.map(order => <article className="store-order" key={order.id}><div><h2>{order.product_title}</h2><p className="store-order-meta">{new Date(order.created_at).toLocaleDateString('pt-BR')} · {storeCurrency(order.price_cents)}</p>{order.coupon_code && <p className="store-order-meta">Cupom {order.coupon_code} · desconto de {storeCurrency(order.discount_cents)}</p>}<span className={`store-order-status store-order-status-${order.status}`}>{labels[order.status]}{order.is_live === false ? ' · Pedido de teste' : ''}</span></div><div className="store-order-actions">
        {order.status === 'paid' && <>
          {readyDownload?.orderId === order.id && <a className="store-button" href={readyDownload.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><Download size={17} />Salvar livro</a>}
          <button className={readyDownload?.orderId === order.id ? 'store-text-button' : 'store-button'} onClick={() => download(order)} disabled={!!busy}>{busy === order.id ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}{busy === order.id ? 'Preparando seu PDF…' : readyDownload?.orderId === order.id ? 'Gerar novo link' : 'Baixar livro'}</button>
        </>}
        {order.status === 'pending' && <button className="store-button store-button-secondary" onClick={() => pay(order)} disabled={!!busy}>{busy === order.id ? 'Preparando…' : 'Continuar pagamento'}</button>}
      </div></article>)}</div>}
    {!!orders.data?.some(o => o.status === 'paid') && <p className="store-product-note">Cada PDF contém o e-mail registrado na compra em uma margem reservada de todas as páginas. Uso pessoal.</p>}
  </StoreLayout>;
}
