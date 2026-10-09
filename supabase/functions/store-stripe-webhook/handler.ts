import { realStoreDeps, StoreError, storeFailure, storeJson, type StoreDeps } from '../_shared/storeHttp.ts';
import { reconcileStripeSession, requireStripe, stripeMode, stripeRequest, verifyStripeSignature } from '../_shared/storeStripe.ts';

export async function handleStoreStripeWebhook(req: Request, deps: StoreDeps = realStoreDeps()) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status:405 });
  try {
    requireStripe(deps.env);
    const body = await req.text();
    if (body.length > 1000000) throw new StoreError(413,'Evento muito grande.');
    if (!await verifyStripeSignature(body,req.headers.get('stripe-signature'),deps.env('STRIPE_WEBHOOK_SECRET')!,Math.floor(deps.now().getTime()/1000))) throw new StoreError(400,'Assinatura inválida.');
    const event = JSON.parse(body);
    if (typeof event.id !== 'string' || typeof event.type !== 'string' || event.livemode !== (stripeMode(deps.env)==='live')) throw new StoreError(400,'Evento incompatível.');
    const object = event.data?.object;
    if (['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type)) {
      if (typeof object?.id !== 'string') throw new StoreError(400,'Sessão ausente.');
      const result = await reconcileStripeSession(object.id,event.id,event.type,deps);
      return storeJson(req,{ received:true,...result });
    }
    if (['charge.refunded','charge.dispute.created'].includes(event.type)) {
      const paymentId = typeof object?.payment_intent === 'string' ? object.payment_intent : object?.payment_intent?.id;
      if (!/^pi_[A-Za-z0-9]+$/.test(paymentId ?? '')) return storeJson(req,{ received:true,ignored:true });
      // The payment's authoritative session also carries Payment Link references.
      // Works even when refund delivery arrives before the checkout webhook.
      const sessions = await stripeRequest(`/checkout/sessions?payment_intent=${encodeURIComponent(paymentId)}&limit=1`,deps);
      if (!sessions.data?.[0]?.id) return storeJson(req,{ received:true,ignored:true });
      const result = await reconcileStripeSession(sessions.data[0].id,event.id,event.type,deps);
      return storeJson(req,{ received:true,...result });
    }
    return storeJson(req,{ received:true,ignored:true });
  } catch(e) { return storeFailure(req,e); }
}
