export interface StoreProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  price_cents: number;
  currency: string;
  cover_url: string | null;
  gallery_urls: string[];
  payment_link_url: string | null;
  status: 'draft' | 'published' | 'archived';
  current_file_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface StoreFile {
  id: string;
  product_id: string;
  storage_path: string;
  original_name: string;
  size_bytes: number;
  page_count: number;
  created_at: string;
}
export interface StoreOrder {
  id: string;
  user_id: string;
  product_id: string;
  file_id: string;
  buyer_email: string;
  product_title: string;
  price_cents: number;
  currency: string;
  status: 'pending' | 'paid' | 'refunded' | 'disputed' | 'cancelled';
  provider: string;
  checkout_id: string | null;
  checkout_url: string | null;
  checkout_expires_at: string | null;
  provider_payment_id: string | null;
  is_live: boolean | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}
type Table<T> = { Row: { [K in keyof T]: T[K] }; Insert: { [K in keyof T]?: T[K] }; Update: { [K in keyof T]?: T[K] }; Relationships: [] };
export interface StoreDatabase {
  public: {
    Tables: { store_products: Table<StoreProduct>; store_product_files: Table<StoreFile>; store_orders: Table<StoreOrder>; store_admins: Table<{ user_id: string; created_at: string }> };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
export const storeCurrency = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export function storeSlug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}
export function safeStoreNext(value: string | null): string {
  return value && /^\/loja(?:\/|$)/.test(value) && !/[\\\r\n]/.test(value) ? value : '/loja/pedidos';
}
export function stripeLink(value: string): string | null {
  if (!value.trim()) return null;
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com' || url.username || url.password || !/^\/[\w/-]+$/.test(url.pathname)) throw new Error('Use um link de pagamento https://buy.stripe.com/…');
  return `${url.origin}${url.pathname}`;
}
