import { StoreError, type Env, type StoreDeps } from './storeHttp.ts';

const SITE = 'https://www.rogersfeitosa.com.br';
export const stripeMode = (env: Env) => /^(sk|rk)_live_/.test(env('STRIPE_SECRET_KEY') ?? '') ? 'live' : 'test';
export function requireStripe(env: Env) {
  if (!env('STRIPE_SECRET_KEY') || !env('STRIPE_WEBHOOK_SECRET')) throw new StoreError(503, 'As compras estão temporariamente indisponíveis. Tente novamente mais tarde.');
}
export async function stripeRequest(path: string, deps: Pick<StoreDeps,'env'|'fetch'>, form?: URLSearchParams, idempotencyKey?: string) {
  const key = deps.env('STRIPE_SECRET_KEY');
  if (!key) throw new StoreError(503, 'O pagamento está temporariamente indisponível.');
  const response = await deps.fetch(`https://api.stripe.com/v1${path}`, { method: form ? 'POST' : 'GET', headers: {
    Authorization: `Bearer ${key}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  }, body: form?.toString(), signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    console.error('store stripe request failed', response.status, data?.error?.code ?? 'unknown');
    throw new StoreError(502, 'Não foi possível consultar o pagamento. Tente novamente em instantes.');
  }
  return data;
}
export function checkoutForm(order: { id: string; buyer_email: string; product_title: string; price_cents: number }) {
  return new URLSearchParams({
    mode: 'payment', client_reference_id: `loja_${order.id}`, customer_email: order.buyer_email,
    // Stripe manages available methods in Dashboard; explicit method types are
    // rejected by the current Checkout API. Payment still requires server confirmation.
    'line_items[0][price_data][currency]': 'brl',
    'line_items[0][price_data][unit_amount]': String(order.price_cents),
    'line_items[0][price_data][product_data][name]': order.product_title,
    'line_items[0][quantity]': '1', 'metadata[store_order_id]': order.id,
    'payment_intent_data[metadata][store_order_id]': order.id,
    success_url: `${SITE}/loja/pedidos?checkout=success`, cancel_url: `${SITE}/loja/pedidos?checkout=cancelled`,
    locale: 'pt-BR', 'adaptive_pricing[enabled]': 'false',
  });
}
export function paymentLinkForOrder(link: string, order: { id: string; buyer_email: string }) {
  const url = new URL(link);
  if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com' || url.username || url.password) throw new StoreError(400, 'O link de pagamento deste livro precisa ser atualizado.');
  url.search = ''; url.hash = '';
  url.searchParams.set('client_reference_id', `loja_${order.id}`);
  url.searchParams.set('prefilled_email', order.buyer_email);
  url.searchParams.set('locale', 'pt-BR');
  return url.toString();
}
export function orderFromSession(session: Record<string, any>): string | null {
  const ref = String(session.client_reference_id ?? '');
  const match = ref.match(/^loja_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  return match?.[1] ?? null;
}
export async function verifyStripeSignature(body: string, header: string | null, secret: string, nowSeconds: number): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map(v => v.trim().split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  const signatures = parts.filter(([key,value]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(value)).map(([,value]) => value);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  for (const signature of signatures) {
    const bytes = Uint8Array.from(signature.match(/.{2}/g)!, byte => parseInt(byte, 16));
    if (await crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`${timestamp}.${body}`))) return true;
  }
  return false;
}

/** Re-fetch authoritative state: a browser return URL is never proof of payment. */
export async function reconcileStripeSession(sessionId: string, eventId: string, eventType: string, deps: StoreDeps, expectedOrderId?: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new StoreError(400, 'Sessão inválida.');
  const session = await stripeRequest(`/checkout/sessions/${sessionId}?expand[]=payment_intent.latest_charge`, deps);
  const orderId = orderFromSession(session);
  if (!orderId) return { ignored: true };
  if (expectedOrderId && orderId !== expectedOrderId) throw new StoreError(403, 'O pagamento não pertence a este pedido.');
  if (session.mode !== 'payment' || session.livemode !== (stripeMode(deps.env) === 'live')) throw new StoreError(400, 'Configuração de pagamento incompatível.');
  const intent = session.payment_intent;
  const paymentId = typeof intent === 'string' ? intent : intent?.id;
  if (!paymentId || session.payment_status !== 'paid') return { pending: true };
  const charge = typeof intent === 'object' ? intent.latest_charge : null;
  const status = charge?.disputed ? 'disputed' : charge?.refunded || charge?.amount_refunded > 0 ? 'refunded' : 'paid';
  const db = deps.db();
  const { data: order, error: orderError } = await db.from('store_orders').select('id,checkout_id').eq('id', orderId).maybeSingle();
  if (orderError) throw orderError;
  if (!order) return { ignored: true };
  // A valid payment from an older session may arrive after a retry created a
  // new one. The signed order reference + amount and the payment-id lock decide
  // ownership; session recency must not discard a legitimate delayed payment.
  const { data, error } = await db.rpc('store_record_payment', { p_event_id: eventId, p_event_type: eventType, p_order_id: orderId, p_payment_id: paymentId, p_status: status, p_amount: session.amount_total, p_currency: session.currency, p_is_live: session.livemode });
  if (error) throw error;
  const { error: saveError } = await db.from('store_orders').update({ checkout_id: session.id }).eq('id', orderId).eq('provider_payment_id', paymentId);
  if (saveError) throw saveError;
  return { status: data };
}
