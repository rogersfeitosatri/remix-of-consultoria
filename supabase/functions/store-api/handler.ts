import { couponQuote } from '../_shared/storeCoupons.ts';
import { realStoreDeps, requireUuid, StoreError, storeCors, storeFailure, storeIsAdmin, storeJson, storeUser, type StoreDeps } from '../_shared/storeHttp.ts';
import { checkoutForm, paymentLinkForOrder, reconcileStripeSession, requireStripe, stripeMode, stripeRequest } from '../_shared/storeStripe.ts';

export async function handleStoreApi(req: Request, deps: StoreDeps = realStoreDeps()) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: storeCors(req) });
  if (req.method !== 'POST') return storeJson(req, { error: 'Método não permitido.' }, 405);
  try {
    const db = deps.db(); const user = await storeUser(req, db);
    const body = await req.json().catch(() => { throw new StoreError(400, 'Solicitação inválida.'); });
    if (body.action === 'integration-status') {
      if (!await storeIsAdmin(db, user.id)) throw new StoreError(403, 'Acesso restrito ao administrador.');
      const secret_key = !!deps.env('STRIPE_SECRET_KEY'); const webhook_secret = !!deps.env('STRIPE_WEBHOOK_SECRET');
      return storeJson(req, { provider: 'stripe', secret_key, webhook_secret, ready: secret_key && webhook_secret, mode: stripeMode(deps.env), webhook_url: `${deps.env('SUPABASE_URL')}/functions/v1/store-stripe-webhook` });
    }
    if (body.action === 'sync-orders') {
      requireStripe(deps.env);
      const { data, error } = await db.from('store_orders').select('id,checkout_id').eq('user_id', user.id).eq('status','pending').not('checkout_id','is',null).order('created_at', { ascending: false }).limit(5);
      if (error) throw error;
      for (const order of data ?? []) await reconcileStripeSession(order.checkout_id, `sync:${order.checkout_id}`, 'checkout.sync', deps, order.id);
      return storeJson(req, { ok: true });
    }
    if (!['checkout','quote'].includes(body.action)) throw new StoreError(400, 'Ação inválida.');
    if (body.action === 'checkout') requireStripe(deps.env);
    const productId = requireUuid(body.product_id);
    const live = stripeMode(deps.env) === 'live';
    if (body.action === 'checkout' && !live && !await storeIsAdmin(db, user.id)) throw new StoreError(503, 'As compras estarão disponíveis em breve.');
    const { data: existing, error: existingError } = body.action === 'quote' ? { data:null, error:null } : await db.from('store_orders').select('*').eq('user_id', user.id).eq('product_id', productId).in('status',['paid','pending']).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === 'paid') return storeJson(req, { owned: true });
    const { data: product, error: productError } = await db.from('store_products').select('*').eq('id',productId).eq('status','published').is('deleted_at',null).maybeSingle();
    if (productError) throw productError;
    if (!product?.current_file_id) throw new StoreError(404, 'Este livro não está disponível para compra.');
    // An omitted code (Meus pedidos) retains the previous choice. Explicit null
    // removes it. Browser-supplied amounts never determine the actual charge.
    const requestedCode = body.action === 'checkout' && !Object.hasOwn(body, 'coupon_code') ? existing?.coupon_code : body.coupon_code;
    const quote = await couponQuote(db, product, requestedCode, deps.now());
    if (body.action === 'quote') {
      const { coupon_id: _id, ...publicQuote } = quote;
      return storeJson(req, publicQuote);
    }
    if (body.expected_total_cents !== undefined && body.expected_total_cents !== quote.total_cents) throw new StoreError(409, 'O valor mudou. Confira o preço e aplique o cupom novamente antes de pagar.');
    const currentPrice = quote.total_cents;
    const priceValues = { price_cents:currentPrice, subtotal_cents:quote.subtotal_cents, discount_cents:quote.discount_cents, coupon_id:quote.coupon_id, coupon_code:quote.coupon_code };
    const sameCoupon = (o: { coupon_id?: string | null; coupon_code?: string | null; discount_cents?: number }) => (o.coupon_id ?? null) === quote.coupon_id && (o.coupon_code ?? null) === quote.coupon_code && (o.discount_cents ?? 0) === quote.discount_cents;
    let order = existing;
    if (order && order.is_live !== live) throw new StoreError(409, 'Este pedido pertence a outro modo de pagamento. Contate o atendimento.');
    if (order && (order.price_cents !== currentPrice || !sameCoupon(order))) {
      // Never change the amount of a session that can still be paid, or of a
      // completed asynchronous payment awaiting confirmation (e.g. Pix).
      if (order.checkout_id) {
        const session = await stripeRequest(`/checkout/sessions/${order.checkout_id}`, deps);
        if (session.payment_status === 'paid') {
          const result = await reconcileStripeSession(order.checkout_id, `sync:${order.checkout_id}`, 'checkout.sync', deps, order.id);
          if (result.status === 'paid') return storeJson(req, { owned: true });
          throw new StoreError(409, 'Consulte a situação deste pagamento em Meus pedidos.');
        }
        if (session.status === 'open') {
          const expired = await stripeRequest(`/checkout/sessions/${order.checkout_id}/expire`, deps, new URLSearchParams());
          if (expired.status !== 'expired') throw new StoreError(409, 'Aguarde a confirmação do pagamento anterior em Meus pedidos.');
        } else if (session.status !== 'expired') {
          throw new StoreError(409, 'O pagamento anterior está em processamento. Acompanhe em Meus pedidos.');
        }
      } else if (order.checkout_url) {
        throw new StoreError(409, 'Este pedido tem um link de pagamento anterior. Contate o atendimento para atualizar o valor.');
      }
      const { data: refreshed, error: refreshError } = await db.from('store_orders').update({ ...priceValues, checkout_url:null, checkout_id:null, checkout_expires_at:null, updated_at:deps.now().toISOString() }).eq('id',order.id).eq('status','pending').eq('price_cents',order.price_cents).eq('updated_at',order.updated_at).select('*').maybeSingle();
      if (refreshError) throw refreshError;
      if (!refreshed) throw new StoreError(409, 'O pedido foi atualizado. Tente novamente.');
      order = refreshed;
    }
    if (order?.checkout_url && (!order.checkout_expires_at || Date.parse(order.checkout_expires_at) > deps.now().getTime() + 60000)) return storeJson(req, { checkout_url: order.checkout_url, order_id: order.id });
    if (!order) {
      const { count, error: rateError } = await db.from('store_orders').select('id', { count: 'exact', head: true }).eq('user_id',user.id).gte('created_at', new Date(deps.now().getTime()-3600000).toISOString());
      if (rateError) throw rateError;
      if ((count ?? 0) >= 20) throw new StoreError(429, 'Aguarde alguns minutos antes de iniciar outra compra.');
      const { data, error } = await db.from('store_orders').insert({ user_id:user.id, product_id:product.id, file_id:product.current_file_id, buyer_email:user.email, product_title:product.title, ...priceValues, currency:'brl', is_live:live }).select('*').single();
      if (error?.code === '23505') {
        const { data: concurrent, error: concurrentError } = await db.from('store_orders').select('*').eq('user_id',user.id).eq('product_id',productId).in('status',['pending','paid']).single();
        if (concurrentError) throw concurrentError; order = concurrent;
      } else if (error) throw error; else order = data;
    }
    if (order.status === 'paid') return storeJson(req, { owned:true });
    if (order.is_live !== live) throw new StoreError(409, 'Este pedido pertence a outro modo de pagamento. Contate o atendimento.');
    if (order.price_cents !== currentPrice || !sameCoupon(order)) throw new StoreError(409, 'O preço foi atualizado. Tente novamente.');
    let checkoutUrl: string; let checkoutId: string | null = null; let expires: string | null = null;
    if (product.payment_link_url && product.sale_price_cents == null && !quote.coupon_id) {
      // Stripe sends client_reference_id in the signed Checkout Session webhook.
      // Never use payer-entered e-mail to locate or grant another user's order.
      if (order.price_cents !== currentPrice) throw new StoreError(409, 'O preço deste livro mudou. Contate o atendimento para atualizar seu pedido.');
      checkoutUrl = paymentLinkForOrder(product.payment_link_url, order);
    } else {
      const day = Math.floor(deps.now().getTime()/86400000);
      const session = await stripeRequest('/checkout/sessions', deps, checkoutForm(order), `loja-${order.id}-${order.price_cents}-${order.updated_at}-${day}`);
      if (typeof session.url !== 'string' || !session.url.startsWith('https://checkout.stripe.com/')) throw new StoreError(502, 'Não foi possível abrir o pagamento.');
      checkoutUrl = session.url; checkoutId = session.id; expires = new Date(session.expires_at*1000).toISOString();
    }
    const { data: saved, error: saveError } = await db.from('store_orders').update({ checkout_url:checkoutUrl, checkout_id:checkoutId, checkout_expires_at:expires, updated_at:deps.now().toISOString() }).eq('id',order.id).eq('status','pending').eq('price_cents',order.price_cents).eq('updated_at',order.updated_at).select('id').maybeSingle();
    if (saveError) throw saveError;
    if (!saved) {
      const { data: latest, error: latestError } = await db.from('store_orders').select('*').eq('id',order.id).single();
      if (latestError) throw latestError;
      // Concurrent requests can share the same Stripe idempotency result.
      // Do not expire a session already saved by the other request.
      if (latest?.status === 'paid') return storeJson(req, { owned:true });
      if (latest?.status === 'pending' && latest.price_cents === order.price_cents && latest.checkout_url === checkoutUrl) return storeJson(req, { checkout_url:checkoutUrl, order_id:order.id });
      if (checkoutId) await stripeRequest(`/checkout/sessions/${checkoutId}/expire`, deps, new URLSearchParams());
      throw new StoreError(409, 'O pedido foi atualizado. Tente novamente.');
    }
    return storeJson(req, { checkout_url:checkoutUrl, order_id:order.id });
  } catch(e) { return storeFailure(req,e); }
}
