import type { StoreProduct } from '@/lib/storeTypes';
export function BookCover({ product, large = false }: { product: Pick<StoreProduct, 'title' | 'cover_url' | 'author'>; large?: boolean }) {
  return <div className={`store-cover${large ? ' store-cover-large' : ''}`}>
    {product.cover_url ? <img src={product.cover_url} alt={`Capa de ${product.title}`} loading={large ? 'eager' : 'lazy'} />
      : <div className="store-cover-placeholder" aria-label={`Capa de ${product.title}`}><span>{product.title}</span><small>{product.author}</small><svg viewBox="0 0 200 100" aria-hidden="true"><rect x="8" y="10" width="182" height="80" rx="40"/><rect x="15" y="17" width="168" height="66" rx="33"/><rect x="22" y="24" width="154" height="52" rx="26"/></svg></div>}
  </div>;
}
