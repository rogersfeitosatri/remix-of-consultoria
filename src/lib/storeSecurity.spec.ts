import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts, degrees, rgb, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { personaliseStorePdf, PDF_MARGIN } from '../../supabase/functions/_shared/storePdf';
import { checkoutForm, orderFromSession, paymentLinkForOrder, reconcileStripeSession, verifyStripeSignature } from '../../supabase/functions/_shared/storeStripe';
import { handleStoreDownload } from '../../supabase/functions/store-download/handler';
import { handleStoreStripeWebhook } from '../../supabase/functions/store-stripe-webhook/handler';
import { handleStoreApi } from '../../supabase/functions/store-api/handler';
import { safeStoreNext, stripeLink } from './storeTypes';
import type { StoreDeps } from '../../supabase/functions/_shared/storeHttp';

const ORDER = '12345678-1234-4234-8234-123456789abc';
const USER = '98765432-1234-4234-8234-123456789abc';
const now = new Date('2026-10-09T12:00:00Z');
const secret = 'whsec_test_fixture_not_a_real_key';
const env = (name: string) => ({ STRIPE_SECRET_KEY:'sk_test_fixture_not_a_real_key', STRIPE_WEBHOOK_SECRET:secret }[name]);
async function signature(body: string, timestamp = Math.floor(now.getTime()/1000)) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{ name:'HMAC',hash:'SHA-256' },false,['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}.${body}`)));
  return `t=${timestamp},v1=${Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}`;
}
function builder(result: unknown) {
  const q: any = {};
  for (const method of ['select','eq','in','is','gte','limit','order','not','update','insert']) q[method]=vi.fn(()=>q);
  q.single=vi.fn(async()=>result);q.maybeSingle=vi.fn(async()=>result);
  q.then=(resolve: (v:unknown)=>unknown,reject: (e:unknown)=>unknown)=>Promise.resolve(result).then(resolve,reject);
  return q;
}
function depsFor(db: any, fetcher = vi.fn()) { return { db:()=>db,fetch:fetcher as unknown as typeof fetch,env,now:()=>now } as StoreDeps; }
function request(body: unknown, auth=true) { return new Request('https://example.test/store',{ method:'POST',headers:{ 'content-type':'application/json',...(auth?{ authorization:'Bearer test-user-token' }:{}) },body:JSON.stringify(body) }); }
function authDb() { return { auth:{ getUser:vi.fn(async()=>({ data:{ user:{ id:USER,email:'buyer@example.com',email_confirmed_at:now.toISOString() } },error:null })) } }; }

describe('store payment authentication and association',()=>{
  it('accepts the exact Stripe payload and rejects modifications, old timestamps, absent secrets and wrong schemes',async()=>{
    const body='{"type":"checkout.session.completed"}';const sig=await signature(body);const time=now.getTime()/1000;
    expect(await verifyStripeSignature(body,sig,secret,time)).toBe(true);
    expect(await verifyStripeSignature(body+' ',sig,secret,time)).toBe(false);
    expect(await verifyStripeSignature(body,await signature(body,time-301),secret,time)).toBe(false);
    expect(await verifyStripeSignature(body,await signature(body,time+301),secret,time)).toBe(false);
    expect(await verifyStripeSignature(body,sig,'',time)).toBe(false);
    expect(await verifyStripeSignature(body,sig.replace('v1=','v0='),secret,time)).toBe(false);
    expect(await verifyStripeSignature(body,`${sig},v1=${'0'.repeat(64)}`,secret,time)).toBe(true);
  });
  it('binds both generated checkouts and Payment Links to a server-owned order, never payer-entered identity',()=>{
    const order={ id:ORDER,buyer_email:'buyer+books@example.com',product_title:'Livro',price_cents:1990 };
    const params=checkoutForm(order);
    expect(params.get('client_reference_id')).toBe(`loja_${ORDER}`);
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('1990');
    expect(params.get('line_items[0][price_data][currency]')).toBe('brl');
    expect(params.get('payment_intent_data[metadata][store_order_id]')).toBe(ORDER);
    const url=new URL(paymentLinkForOrder('https://buy.stripe.com/test_example?client_reference_id=attacker',order));
    expect(url.searchParams.get('client_reference_id')).toBe(`loja_${ORDER}`);
    expect(url.searchParams.get('prefilled_email')).toBe(order.buyer_email);
    expect(orderFromSession({ client_reference_id:`loja_${ORDER}` })).toBe(ORDER);
    expect(orderFromSession({ customer_email:order.buyer_email })).toBeNull();
  });
  it('rejects external redirects and arbitrary payment hosts',()=>{
    expect(safeStoreNext('https://evil.test')).toBe('/loja/pedidos');
    expect(safeStoreNext('//evil.test')).toBe('/loja/pedidos');
    expect(safeStoreNext('/loja\\evil')).toBe('/loja/pedidos');
    expect(safeStoreNext('/loja/livro/nutricao')).toBe('/loja/livro/nutricao');
    expect(()=>stripeLink('https://buy.stripe.com.evil.test/x')).toThrow();
    expect(()=>stripeLink('javascript:alert(1)')).toThrow();
    expect(()=>stripeLink('https://user:password@buy.stripe.com/x')).toThrow();
    expect(stripeLink('https://buy.stripe.com/test_123?tracking=x')).toBe('https://buy.stripe.com/test_123');
  });
  it('never grants access from an unsigned browser-style success request',async()=>{
    const db=authDb();const deps=depsFor(db);
    const response=await handleStoreStripeWebhook(request({ type:'checkout.session.completed',data:{ object:{ id:'cs_test_forged' } } },false),deps);
    expect(response.status).toBe(400);expect(deps.fetch).not.toHaveBeenCalled();
  });
  it('does not trust editable user metadata to access payment settings',async()=>{
    const db={...authDb(),from:vi.fn(()=>builder({ data:[],error:null }))};
    db.auth.getUser.mockResolvedValueOnce({data:{user:{id:USER,email:'buyer@example.com',email_confirmed_at:now.toISOString(),user_metadata:{role:'admin'}}},error:null} as any);
    const res=await handleStoreApi(request({action:'integration-status'}),depsFor(db));
    expect(res.status).toBe(403);
    expect(db.from).toHaveBeenCalledWith('store_admins');
  });
  it('returns 503 when the payment integration is incomplete',async()=>{
    const deps=depsFor(authDb());deps.env=()=>undefined;
    const res=await handleStoreApi(request({action:'checkout',product_id:ORDER}),deps);
    expect(res.status).toBe(503);expect(deps.fetch).not.toHaveBeenCalled();
  });
  it.each(['unpaid','no_payment_required'])('does not release a session with payment_status %s',async paymentStatus=>{
    const db={rpc:vi.fn()};const fetcher=vi.fn(async()=>new Response(JSON.stringify({id:'cs_test_123',client_reference_id:`loja_${ORDER}`,mode:'payment',livemode:false,payment_status:paymentStatus,payment_intent:'pi_123'}),{status:200}));
    await reconcileStripeSession('cs_test_123','evt_1','checkout.session.completed',depsFor(db,fetcher));
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('checks the Stripe order association during manual refresh',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({client_reference_id:`loja_${ORDER}`}),{status:200}));
    await expect(reconcileStripeSession('cs_test_123','evt_1','sync',depsFor({},fetcher),USER)).rejects.toThrow('não pertence');
  });
  it.each([{charge:{},status:'paid'},{charge:{amount_refunded:100},status:'refunded'},{charge:{disputed:true},status:'disputed'}])('applies authoritative $status state and original amount through the atomic RPC',async({charge,status})=>{
    const db={from:vi.fn(()=>builder({data:{id:ORDER,checkout_id:'cs_test_older'},error:null})),rpc:vi.fn(async()=>({data:status,error:null}))};
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({id:'cs_test_123',client_reference_id:`loja_${ORDER}`,mode:'payment',livemode:false,payment_status:'paid',amount_total:1990,currency:'brl',payment_intent:{id:'pi_123',latest_charge:charge}}),{status:200}));
    await reconcileStripeSession('cs_test_123','evt_1','checkout.session.completed',depsFor(db,fetcher));
    expect(db.rpc).toHaveBeenCalledWith('store_record_payment',expect.objectContaining({p_order_id:ORDER,p_status:status,p_amount:1990,p_currency:'brl',p_payment_id:'pi_123'}));
  });
});

describe('private PDF delivery',()=>{
  it('requires authentication before looking up an order',async()=>{
    const db={...authDb(),from:vi.fn()};
    const response=await handleStoreDownload(request({order_id:ORDER},false),depsFor(db));
    expect(response.status).toBe(401);expect(db.from).not.toHaveBeenCalled();
  });
  it.each([null,{status:'pending'},{status:'refunded'},{status:'disputed'}])('refuses missing or unpaid ownership: %j',async order=>{
    const query=builder({data:order,error:null});const db={...authDb(),from:vi.fn(()=>query),storage:{from:vi.fn()}};
    const response=await handleStoreDownload(request({order_id:ORDER,user_id:'someone-else',email:'forged@example.com'}),depsFor(db));
    expect(response.status).toBe(403);expect(query.eq).toHaveBeenCalledWith('user_id',USER);expect(db.storage.from).not.toHaveBeenCalled();
  });
  it('requires email confirmation even when a session exists',async()=>{
    const db={...authDb(),from:vi.fn()};db.auth.getUser.mockResolvedValueOnce({data:{user:{id:USER,email:'x@example.com',email_confirmed_at:null}},error:null} as any);
    const response=await handleStoreDownload(request({order_id:ORDER}),depsFor(db));
    expect(response.status).toBe(403);expect(db.from).not.toHaveBeenCalled();
  });
  it('personalises all mixed-size and rotated pages outside the original content',async()=>{
    const source=await PDFDocument.create();const font=await source.embedFont(StandardFonts.Helvetica);
    for(const angle of [0,90,180,270]){const page=source.addPage([620,820]);page.setCropBox(10,20,600,780);page.setRotation(degrees(angle));page.drawRectangle({x:10,y:20,width:600,height:780,color:rgb(.2,.3,.4)});page.drawText(`Source page ${angle}`,{x:40,y:400,font});}
    const original=await source.save();const email='long.buyer+books@example.com';
    const marked=await PDFDocument.load(await personaliseStorePdf(original,email));
    expect(marked.getPageCount()).toBe(4);
    for(const [i,page] of marked.getPages().entries()){const sideways=i%2===1;expect(page.getWidth()).toBe(sideways?780:600);expect(page.getHeight()).toBe((sideways?600:780)+PDF_MARGIN);}
    const hex=Buffer.from(`Uso pessoal: ${email}`,'latin1').toString('hex').toUpperCase();
    const streams=marked.context.enumerateIndirectObjects().map(([,obj])=>obj).filter(obj=>obj instanceof PDFRawStream).map(obj=>Buffer.from(decodePDFRawStream(obj as PDFRawStream).decode()).toString('latin1'));
    expect(streams.filter(s=>s.includes(hex))).toHaveLength(4);
    expect((await PDFDocument.load(original)).getPages()[0].getHeight()).toBe(820);
  });
  it('fails closed for unreadable PDFs and missing buyer identity',async()=>{
    await expect(personaliseStorePdf(new Uint8Array([1,2,3]),'buyer@example.com')).rejects.toThrow();
    const doc=await PDFDocument.create();doc.addPage();
    await expect(personaliseStorePdf(await doc.save(),'')).rejects.toThrow('invalid_buyer_email');
  });
  it('fits a maximum-length email inside the added strip',async()=>{
    const doc=await PDFDocument.create();doc.addPage([200,300]).drawText('Original');
    const email='a'.repeat(64)+'@'+'b'.repeat(63)+'.'+'c'.repeat(63)+'.'+'d'.repeat(57)+'.com';
    const marked=await PDFDocument.load(await personaliseStorePdf(await doc.save(),email));
    expect(marked.getPageCount()).toBe(1);expect(marked.getPages()[0].getHeight()).toBe(320);
  });
});
