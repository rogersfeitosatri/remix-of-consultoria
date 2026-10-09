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
    if (body.action !== 'checkout') throw new StoreError(400, 'Ação inválida.');
    requireStripe(deps.env);
    const productId = requireUuid(body.product_id);
    const live = stripeMode(deps.env) === 'live';
    if (!live && !await storeIsAdmin(db, user.id)) throw new StoreError(503, 'As compras estarão disponíveis em breve.');
    const { data: existing, error: existingError } = await db.from('store_orders').select('*').eq('user_id', user.id).eq('product_id', productId).in('status',['paid','pending']).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === 'paid') return storeJson(req, { owned: true });
    const { data: product, error: productError } = await db.from('store_products').select('*').eq('id',productId).eq('status','published').is('deleted_at',null).maybeSingle();
    if (productError) throw productError;
    if (!product?.current_file_id) throw new StoreError(404, 'Este livro não está disponível para compra.');
    if (existing?.checkout_url && existing.is_live === live && (!existing.checkout_expires_at || Date.parse(existing.checkout_expires_at) > deps.now().getTime() + 60000)) return storeJson(req, { checkout_url: existing.checkout_url, order_id: existing.id });
    let order = existing;
    if (!order) {
      const { count, error: rateError } = await db.from('store_orders').select('id', { count: 'exact', head: true }).eq('user_id',user.id).gte('created_at', new Date(deps.now().getTime()-3600000).toISOString());
      if (rateError) throw rateError;
      if ((count ?? 0) >= 20) throw new StoreError(429, 'Aguarde alguns minutos antes de iniciar outra compra.');
      const { data, error } = await db.from('store_orders').insert({ user_id:user.id, product_id:product.id, file_id:product.current_file_id, buyer_email:user.email, product_title:product.title, price_cents:product.price_cents, currency:'brl', is_live:live }).select('*').single();
      if (error?.code === '23505') {
        const { data: concurrent, error: concurrentError } = await db.from('store_orders').select('*').eq('user_id',user.id).eq('product_id',productId).in('status',['pending','paid']).single();
        if (concurrentError) throw concurrentError; order = concurrent;
      } else if (error) throw error; else order = data;
    }
    if (order.status === 'paid') return storeJson(req, { owned:true });
    if (order.is_live !== live) throw new StoreError(409, 'Este pedido pertence a outro modo de pagamento. Contate o atendimento.');
    let checkoutUrl: string; let checkoutId: string | null = null; let expires: string | null = null;
    if (product.payment_link_url) {
      // Stripe sends client_reference_id in the signed Checkout Session webhook.
      // Never use payer-entered e-mail to locate or grant another user's order.
      if (order.price_cents !== product.price_cents) throw new StoreError(409, 'O preço deste livro mudou. Contate o atendimento para atualizar seu pedido.');
      checkoutUrl = paymentLinkForOrder(product.payment_link_url, order);
    } else {
      const day = Math.floor(deps.now().getTime()/86400000);
      const session = await stripeRequest('/checkout/sessions', deps, checkoutForm(order), `loja-${order.id}-${day}`);
      if (typeof session.url !== 'string' || !session.url.startsWith('https://checkout.stripe.com/')) throw new StoreError(502, 'Não foi possível abrir o pagamento.');
      checkoutUrl = session.url; checkoutId = session.id; expires = new Date(session.expires_at*1000).toISOString();
    }
    const { error: saveError } = await db.from('store_orders').update({ checkout_url:checkoutUrl, checkout_id:checkoutId, checkout_expires_at:expires, updated_at:deps.now().toISOString() }).eq('id',order.id).eq('status','pending');
    if (saveError) throw saveError;
    return storeJson(req, { checkout_url:checkoutUrl, order_id:order.id });
  } catch(e) { return storeFailure(req,e); }
}
