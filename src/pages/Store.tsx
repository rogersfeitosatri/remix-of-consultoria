import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { StoreLayout, StoreMessage } from '@/components/store/StoreLayout';
import { BookCover } from '@/components/store/BookCover';
import { storeDb } from '@/lib/storeApi';
import { storeCurrency } from '@/lib/storeTypes';

export default function Store() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const catalog = useQuery({ queryKey: ['store', 'catalog'], queryFn: async () => {
    const { data, error } = await storeDb.from('store_products').select('*').eq('status', 'published').is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }});
  const books = useMemo(() => {
    const result = (catalog.data ?? []).filter(p => `${p.title} ${p.author}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR').trim()));
    if (sort === 'price-asc') result.sort((a,b) => a.price_cents - b.price_cents);
    if (sort === 'price-desc') result.sort((a,b) => b.price_cents - a.price_cents);
    return result;
  }, [catalog.data, search, sort]);
  return <StoreLayout>
    <section className="store-intro"><h1>Loja digital</h1><p>Livros para a sua rotina de treinos.</p></section>
    <div className="store-catalog-bar">
      <span className="store-active-tab">Livros digitais</span>
      <div className="store-catalog-controls"><label className="store-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Buscar livro" placeholder="Buscar livro" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <select aria-label="Ordenar livros" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Mais recentes</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option></select></div>
    </div>
    {catalog.isPending ? <div className="store-grid" aria-label="Carregando livros" aria-busy="true">{[1,2,3].map(i => <div key={i} className="store-skeleton" />)}</div>
      : catalog.isError ? <StoreMessage title="Não foi possível carregar os livros" error><button className="store-text-button" onClick={() => catalog.refetch()}>Tentar novamente</button></StoreMessage>
      : !books.length ? <StoreMessage title={search ? 'Nenhum livro encontrado' : 'Novos livros estão a caminho'}><p>{search ? 'Tente buscar por outro título ou autor.' : 'Em breve, os primeiros títulos estarão disponíveis aqui.'}</p>{search && <button className="store-text-button" onClick={() => setSearch('')}>Limpar busca</button>}</StoreMessage>
      : <div className="store-grid">{books.map(book => <article key={book.id} className="store-book"><Link to={`/loja/livro/${book.slug}`}><BookCover product={book} /><div className="store-book-info"><span>Livro digital · PDF</span><h2>{book.title}</h2><p>{storeCurrency(book.price_cents)}</p></div></Link></article>)}</div>}
  </StoreLayout>;
}
