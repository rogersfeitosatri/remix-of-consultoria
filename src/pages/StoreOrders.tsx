import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { StoreLayout, StoreMessage } from '@/components/store/StoreLayout';
import { downloadStoreBook, storeAction, storeDb } from '@/lib/storeApi';
import { storeCurrency, type StoreOrder } from '@/lib/storeTypes';

const labels = { pending: 'Aguardando confirmação do pagamento', paid: 'Disponível para download', refunded: 'Pagamento reembolsado', disputed: 'Pagamento em contestação', cancelled: 'Pagamento não concluído' };
export default function StoreOrders() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const orders = useQuery({ queryKey: ['store', 'orders', user?.id], queryFn: async () => {
    const { data, error } = await storeDb.from('store_orders').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }, enabled: !!user, refetchOnWindowFocus: true, refetchInterval: query => query.state.data?.some(o => o.status === 'pending') ? 15000 : false });
  async function download(order: StoreOrder) {
    setBusy(order.id); setError('');
    try { await downloadStoreBook(order.id, order.product_title); }
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
    {loading || orders.isPending ? <StoreMessage title="Carregando seus pedidos…" /> : orders.isError ? <StoreMessage title="Não foi possível carregar seus pedidos" error><button className="store-text-button" onClick={() => orders.refetch()}>Tentar novamente</button></StoreMessage>
      : !orders.data?.length ? <StoreMessage title="Seus próximos livros vão aparecer aqui"><p>Após a compra, você poderá baixar o PDF por esta página.</p><Link className="store-button" to="/loja">Conhecer os livros</Link></StoreMessage>
      : <div className="store-orders">{orders.data.map(order => <article className="store-order" key={order.id}><div><h2>{order.product_title}</h2><p className="store-order-meta">{new Date(order.created_at).toLocaleDateString('pt-BR')} · {storeCurrency(order.price_cents)}</p><span className={`store-order-status store-order-status-${order.status}`}>{labels[order.status]}{order.is_live === false ? ' · Pedido de teste' : ''}</span></div><div className="store-order-actions">
        {order.status === 'paid' && <button className="store-button" onClick={() => download(order)} disabled={!!busy}>{busy === order.id ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}{busy === order.id ? 'Preparando seu PDF…' : 'Baixar livro'}</button>}
        {order.status === 'pending' && <button className="store-button store-button-secondary" onClick={() => pay(order)} disabled={!!busy}>{busy === order.id ? 'Preparando…' : 'Continuar pagamento'}</button>}
      </div></article>)}</div>}
    {!!orders.data?.some(o => o.status === 'paid') && <p className="store-product-note">Cada PDF contém o e-mail registrado na compra em uma margem reservada de todas as páginas. Uso pessoal.</p>}
  </StoreLayout>;
}
