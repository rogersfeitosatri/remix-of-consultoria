export type StorePrice = { price_cents: number; sale_price_cents?: number | null };
export function storePrice(product: StorePrice): number {
  return product.sale_price_cents ?? product.price_cents;
}
