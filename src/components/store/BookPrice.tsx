import { storeCurrency, storePrice } from '@/lib/storeTypes';
import type { StorePrice } from '../../../supabase/functions/_shared/storePricing';

export function BookPrice({ product, className = '' }: { product: StorePrice; className?: string }) {
  const discounted = product.sale_price_cents != null;
  return <span className={`store-price ${className}`}>
    {discounted && <span className="store-price-original">De <s>{storeCurrency(product.price_cents)}</s></span>}
    <span className="store-price-current">{discounted && <span className="store-price-prefix">Por </span>}{storeCurrency(storePrice(product))}</span>
  </span>;
}
