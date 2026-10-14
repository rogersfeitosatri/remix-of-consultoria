import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { StoreLayout, StoreMessage } from '@/components/store/StoreLayout';
import { BookGallery } from '@/components/store/BookGallery';
import { storeDb } from '@/lib/storeApi';
import { BookPurchase } from '@/components/store/BookPurchase';

export default function StoreProduct() {
  const { slug } = useParams();
  const book = useQuery({ queryKey: ['store', 'product', slug], queryFn: async () => {
    const { data, error } = await storeDb.from('store_products').select('*').eq('slug', slug!).eq('status', 'published').is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  }, enabled: !!slug });
  return <StoreLayout><Link className="store-back" to="/loja"><ArrowLeft size={16} />Todos os livros</Link>
    {book.isPending ? <StoreMessage title="Carregando livro…" /> : book.isError ? <StoreMessage title="Não foi possível carregar o livro" error><button className="store-text-button" onClick={() => book.refetch()}>Tentar novamente</button></StoreMessage>
      : !book.data ? <StoreMessage title="Este livro não está disponível"><Link className="store-text-button" to="/loja">Conhecer outros livros</Link></StoreMessage>
      : <article className="store-product-detail"><BookGallery key={book.data.id} product={book.data} /><div className="store-product-copy"><span className="store-eyeline">Livro digital em PDF</span><h1>{book.data.title}</h1><p className="store-product-author">{book.data.author}</p><BookPurchase key={book.data.id} book={book.data} />
        <p className="store-product-note">Após a confirmação do pagamento, seu livro ficará em Meus pedidos.</p>
        <div className="store-description">{book.data.description}</div>
      </div></article>}
  </StoreLayout>;
}
