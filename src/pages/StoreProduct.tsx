import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { StoreLayout, StoreMessage } from '@/components/store/StoreLayout';
import { BookCover } from '@/components/store/BookCover';
import { useAuth } from '@/hooks/useAuth';
import { storeAction, storeDb } from '@/lib/storeApi';
import { storeCurrency } from '@/lib/storeTypes';

export default function StoreProduct() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const book = useQuery({ queryKey: ['store', 'product', slug], queryFn: async () => {
    const { data, error } = await storeDb.from('store_products').select('*').eq('slug', slug!).eq('status', 'published').is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  }, enabled: !!slug });
  async function buy() {
    if (!user) { navigate(`/loja/entrar?next=${encodeURIComponent(`/loja/livro/${slug}`)}`); return; }
    if (!book.data) return;
    setBusy(true); setError('');
    try {
      const result = await storeAction<{ owned?: boolean; checkout_url?: string }>('checkout', { product_id: book.data.id });
      if (result.owned) navigate('/loja/pedidos');
      else if (result.checkout_url) window.location.assign(result.checkout_url);
      else throw new Error('Não foi possível abrir o pagamento. Tente novamente.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o pagamento.'); }
    finally { setBusy(false); }
  }
  return <StoreLayout><Link className="store-back" to="/loja"><ArrowLeft size={16} />Todos os livros</Link>
    {book.isPending ? <StoreMessage title="Carregando livro…" /> : book.isError ? <StoreMessage title="Não foi possível carregar o livro" error><button className="store-text-button" onClick={() => book.refetch()}>Tentar novamente</button></StoreMessage>
      : !book.data ? <StoreMessage title="Este livro não está disponível"><Link className="store-text-button" to="/loja">Conhecer outros livros</Link></StoreMessage>
      : <article className="store-product-detail"><BookCover product={book.data} large /><div className="store-product-copy"><span className="store-eyeline">Livro digital em PDF</span><h1>{book.data.title}</h1><p className="store-product-author">{book.data.author}</p><p className="store-product-price">{storeCurrency(book.data.price_cents)}</p>
        <button className="store-button" disabled={busy} onClick={buy}>{busy && <Loader2 size={17} className="animate-spin" />}{busy ? 'Preparando pagamento…' : 'Comprar livro'}</button>
        {error && <p className="store-error" role="alert">{error}</p>}
        <p className="store-product-note">Após a confirmação do pagamento, seu livro ficará em Meus pedidos. O PDF será identificado com o e-mail da sua conta, em uma margem reservada em todas as páginas.</p>
        <div className="store-description">{book.data.description}</div>
      </div></article>}
  </StoreLayout>;
}
