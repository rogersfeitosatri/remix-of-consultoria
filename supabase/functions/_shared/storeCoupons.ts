import { StoreError, type StoreClient } from './storeHttp.ts';
import { storePrice, type StorePrice } from './storePricing.ts';

export type Coupon = { id: string; code: string; discount_type: 'percent' | 'fixed'; discount_value: number; product_id: string | null; active: boolean; deleted_at: string | null; expires_at: string | null };
export function couponCode(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') throw new StoreError(400, 'Informe um código de cupom válido.');
  const code = value.trim().toUpperCase();
  if (code && !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) throw new StoreError(400, 'Informe um código de cupom válido.');
  return code;
}
export function couponDiscount(coupon: Coupon, productId: string, subtotal: number, now: Date): number {
  if (!coupon.active || coupon.deleted_at || (coupon.expires_at && Date.parse(coupon.expires_at) <= now.getTime())) throw new StoreError(400, 'Cupom inválido, inativo ou expirado.');
  if (coupon.product_id && coupon.product_id !== productId) throw new StoreError(400, 'Este cupom não é válido para este livro.');
  if (!Number.isInteger(coupon.discount_value) || (coupon.discount_type === 'percent' ? coupon.discount_value < 1 || coupon.discount_value > 99 : coupon.discount_type !== 'fixed' || coupon.discount_value < 100 || coupon.discount_value > 9999999)) throw new StoreError(400, 'Cupom inválido.');
  const discount = coupon.discount_type === 'percent' ? Math.round(subtotal * coupon.discount_value / 100) : coupon.discount_value;
  if (discount < 1 || subtotal - discount < 100) throw new StoreError(400, 'Este cupom não pode ser aplicado: o total da compra deve ser de pelo menos R$ 1,00.');
  return discount;
}
export async function couponQuote(db: StoreClient, product: StorePrice & { id: string }, value: unknown, now: Date) {
  const code = couponCode(value);
  const subtotal_cents = storePrice(product);
  if (!code) return { subtotal_cents, discount_cents:0, total_cents:subtotal_cents, coupon_id:null, coupon_code:null };
  const { data, error } = await db.from('store_coupons').select('id,code,discount_type,discount_value,product_id,active,deleted_at,expires_at').eq('code',code).maybeSingle();
  if (error) throw error;
  if (!data) throw new StoreError(400, 'Cupom inválido, inativo ou expirado.');
  const discount_cents = couponDiscount(data, product.id, subtotal_cents, now);
  return { subtotal_cents, discount_cents, total_cents:subtotal_cents-discount_cents, coupon_id:data.id as string, coupon_code:data.code as string };
}
