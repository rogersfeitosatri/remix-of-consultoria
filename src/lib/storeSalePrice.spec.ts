import { describe, it, expect, vi } from 'vitest';
import { handleStoreApi } from '../../supabase/functions/store-api/handler';
import { couponCode, couponDiscount } from '../../supabase/functions/_shared/storeCoupons';
import { storePrice } from './storeTypes';
const id='12345678-1234-4234-8234-123456789abc';
const now=new Date('2026-10-12T12:00:00Z');
function fixture({sale=null,existing=null,sessionStatus='open',paymentLink=null,failExpire=false,loseSave=false,coupon=null}: {sale?:number|null;existing?:any;sessionStatus?:string;paymentLink?:string|null;failExpire?:boolean;loseSave?:boolean;coupon?:any}={}) {
 const product={id,current_file_id:id,title:'Livro',price_cents:3590,sale_price_cents:sale,payment_link_url:paymentLink};
 let order=existing;const writes:any[]=[];
 const db:any={auth:{getUser:async()=>({data:{user:{id,email:'buyer@example.test',email_confirmed_at:now.toISOString()}}})},from:(table:string)=>{
  let operation='read',value:any,head=false;const q:any={};
  for(const name of ['eq','in','is','gte','not','order','limit'])q[name]=()=>q;
  q.select=(_s:any,opts:any)=>{head=!!opts?.head;return q;};
  q.insert=(v:any)=>{operation='insert';value=v;return q;};q.update=(v:any)=>{operation='update';value=v;return q;};
  const result=()=>{
   if(table==='store_products')return {data:product};
   if(table==='store_coupons')return {data:coupon};
   if(head)return {count:0};
   if(operation!=='read'){
    writes.push(value);
    if(loseSave && value.checkout_url)return {data:null};
    order={...order,...value,id,updated_at:value.updated_at??'2026-10-12T11:00:00Z'};
   }
   return {data:order};
  };
  q.single=q.maybeSingle=async()=>result();q.then=(a:any,b:any)=>Promise.resolve(result()).then(a,b);return q;
 }};
 const fetcher=vi.fn(async (url:any,init:any)=>{
  if(String(url).endsWith('/expire'))return Response.json(failExpire?{error:{code:'session_completed'}}:{status:'expired'},{status:failExpire?400:200});
  if(init?.method==='GET')return Response.json({status:sessionStatus,payment_status:'unpaid'});
  return Response.json({id:'cs_live_new',url:'https://checkout.stripe.com/new',expires_at:now.getTime()/1000+3600});
 });
 const deps:any={db:()=>db,fetch:fetcher,now:()=>now,env:(key:string)=>key==='STRIPE_SECRET_KEY'?'sk_live_fixture':key==='STRIPE_WEBHOOK_SECRET'?'whsec_fixture':undefined};
 const run=(input:Record<string,unknown>={})=>handleStoreApi(new Request('https://example.test/store-api',{method:'POST',headers:{authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({action:'checkout',product_id:id,price_cents:1,sale_price_cents:1,...input})}),deps);
 return {run,fetcher,writes,get order(){return order;}};
}
const pending={id,price_cents:3590,is_live:true,status:'pending',updated_at:'2026-10-12T11:00:00Z',checkout_id:'cs_live_old',checkout_url:'https://checkout.stripe.com/old',checkout_expires_at:'2026-10-12T14:00:00Z'};
describe('optional promotional prices and checkout',()=>{
 it.each([null,2490])('charges the server price with promotion %s, ignoring forged browser amounts',async sale=>{
  const f=fixture({sale});expect((await f.run()).status).toBe(200);
  expect(f.order.price_cents).toBe(sale??3590);
  const form=new URLSearchParams(f.fetcher.mock.calls[0][1].body);
  expect(form.get('line_items[0][price_data][unit_amount]')).toBe(String(sale??3590));
 });
 it('uses automatic checkout for promotions even if an old Payment Link is configured',async()=>{
  const f=fixture({sale:2490,paymentLink:'https://buy.stripe.com/old'});const response=await f.run();
  expect((await response.json()).checkout_url).toBe('https://checkout.stripe.com/new');
  expect(f.fetcher).toHaveBeenCalledTimes(1);
 });
 it('expires a payable old session before refreshing the pending amount',async()=>{
  const f=fixture({sale:2490,existing:pending});expect((await f.run()).status).toBe(200);
  expect(f.fetcher.mock.calls.map(c=>c[0])).toEqual(['https://api.stripe.com/v1/checkout/sessions/cs_live_old','https://api.stripe.com/v1/checkout/sessions/cs_live_old/expire','https://api.stripe.com/v1/checkout/sessions']);
  expect(f.order.price_cents).toBe(2490);expect(f.order.checkout_id).toBe('cs_live_new');
 });
 it('restores the original price when the promotion is removed',async()=>{
  const f=fixture({existing:{...pending,price_cents:2490},sessionStatus:'expired'});expect((await f.run()).status).toBe(200);expect(f.order.price_cents).toBe(3590);
 });
 it('keeps pending asynchronous payments at the agreed amount',async()=>{
  const f=fixture({sale:2490,existing:pending,sessionStatus:'complete'});expect((await f.run()).status).toBe(409);expect(f.writes).toHaveLength(0);expect(f.fetcher).toHaveBeenCalledTimes(1);
 });
 it('does not reprice when the previous session cannot be expired',async()=>{
  const f=fixture({sale:2490,existing:pending,failExpire:true});expect((await f.run()).status).toBe(502);expect(f.writes).toHaveLength(0);
 });
 it('reuses same-price pending checkout and preserves paid ownership',async()=>{
  for(const existing of [pending,{...pending,status:'paid'}]){const f=fixture({existing});const response=await f.run();expect(response.status).toBe(200);expect(f.fetcher).not.toHaveBeenCalled();expect(f.writes).toHaveLength(0);}
 });
 it('expires an unsaved session after a conflicting order update',async()=>{
  const f=fixture({sale:2490,loseSave:true});expect((await f.run()).status).toBe(409);expect(f.fetcher.mock.calls.at(-1)![0]).toContain('/cs_live_new/expire');
 });
 it('leaves earlier Payment Link orders unchanged rather than repricing an outstanding link',async()=>{
  const f=fixture({sale:2490,existing:{...pending,checkout_id:null,checkout_url:'https://buy.stripe.com/old'}});expect((await f.run()).status).toBe(409);expect(f.writes).toHaveLength(0);
 });
 it('handles catalogs that have no promotion configured',()=>{
  expect(storePrice({price_cents:3590})).toBe(3590);expect(storePrice({price_cents:3590,sale_price_cents:null})).toBe(3590);expect(storePrice({price_cents:3590,sale_price_cents:1990})).toBe(1990);
 });
});

const coupon={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',code:'LEITURA10',discount_type:'percent' as const,discount_value:10,product_id:null,active:true,expires_at:null,deleted_at:null};
describe('coupons verified on the server',()=>{
 it('normalizes codes without accepting malformed or non-string input',()=>{
  expect(couponCode(' leitura10 ')).toBe('LEITURA10');
  for(const value of [[],{},'x','a'.repeat(33),'LEITURA%'])expect(()=>couponCode(value)).toThrow();
 });
 it.each([{sale:null,total:3231},{sale:2490,total:2241}])('applies 10 percent after catalog promotion $sale',async({sale,total})=>{
  const f=fixture({sale,coupon,paymentLink:'https://buy.stripe.com/fullprice'});
  expect((await f.run({coupon_code:' leitura10 ',discount_cents:999999,coupon_id:'forged'})).status).toBe(200);
  expect(f.order.price_cents).toBe(total);expect(f.order.coupon_id).toBe(coupon.id);expect(f.order.coupon_code).toBe('LEITURA10');
  const params=new URLSearchParams(f.fetcher.mock.calls[0][1].body);
  expect(params.get('line_items[0][price_data][unit_amount]')).toBe(String(total));
  expect(params.get('line_items[0][price_data][product_data][description]')).toContain('Cupom LEITURA10');
 });
 it('returns a read-only quote in cents without creating an order or revealing coupon configuration',async()=>{
  const f=fixture({coupon:{...coupon,discount_type:'fixed',discount_value:500}});
  const result=await f.run({action:'quote',coupon_code:'LEITURA10'});
  expect(await result.json()).toEqual({subtotal_cents:3590,discount_cents:500,total_cents:3090,coupon_code:'LEITURA10'});
  expect(f.writes).toHaveLength(0);expect(f.fetcher).not.toHaveBeenCalled();
 });
 it.each([null,{...coupon,active:false},{...coupon,deleted_at:now.toISOString()},{...coupon,expires_at:now.toISOString()},{...coupon,product_id:'other-book'}])('rejects unavailable coupons at checkout: %j',async coupon=>{
  const f=fixture({coupon});expect((await f.run({coupon_code:'LEITURA10'})).status).toBe(400);expect(f.writes).toHaveLength(0);expect(f.fetcher).not.toHaveBeenCalled();
 });
 it('revalidates eligibility after the quote and rejects a stale displayed total',async()=>{
  const active={...coupon};const f=fixture({coupon:active});
  expect((await f.run({action:'quote',coupon_code:'LEITURA10'})).status).toBe(200);
  active.active=false;expect((await f.run({coupon_code:'LEITURA10'})).status).toBe(400);
  const changed=fixture({coupon});expect((await changed.run({coupon_code:'LEITURA10',expected_total_cents:1})).status).toBe(409);expect(changed.fetcher).not.toHaveBeenCalled();
 });
 it('expires an old checkout before adding or explicitly removing a coupon',async()=>{
  const added=fixture({coupon,existing:pending});expect((await added.run({coupon_code:'LEITURA10'})).status).toBe(200);expect(added.order.price_cents).toBe(3231);expect(added.fetcher.mock.calls[1][0]).toContain('/expire');
  const existing={...pending,price_cents:3231,coupon_id:coupon.id,coupon_code:coupon.code,subtotal_cents:3590,discount_cents:359};
  const retained=fixture({coupon,existing});expect((await retained.run()).status).toBe(200);expect(retained.fetcher).not.toHaveBeenCalled();
  const removed=fixture({coupon,existing});expect((await removed.run({coupon_code:null})).status).toBe(200);expect(removed.order.price_cents).toBe(3590);expect(removed.order.coupon_id).toBeNull();expect(removed.order.discount_cents).toBe(0);
 });
 it('refreshes coupon attribution even when two codes yield the same total',async()=>{
  const f=fixture({coupon,existing:{...pending,price_cents:3231,coupon_id:'old-id',coupon_code:'OLD',discount_cents:359}});
  expect((await f.run({coupon_code:'LEITURA10'})).status).toBe(200);expect(f.order.coupon_code).toBe(coupon.code);expect(f.fetcher.mock.calls[1][0]).toContain('/expire');
 });
 it('never modifies an asynchronous payment already in progress',async()=>{
  const f=fixture({coupon,existing:pending,sessionStatus:'complete'});expect((await f.run({coupon_code:'LEITURA10'})).status).toBe(409);expect(f.writes).toHaveLength(0);
 });
 it('rounds percentage discounts to whole cents and enforces the R$1 minimum',()=>{
  expect(couponDiscount({...coupon,discount_value:33},id,3590,now)).toBe(1185);
  expect(couponDiscount({...coupon,discount_type:'fixed',discount_value:3490},id,3590,now)).toBe(3490);
  for(const invalid of [{...coupon,discount_value:99},{...coupon,discount_type:'fixed' as const,discount_value:3500},{...coupon,discount_value:100},{...coupon,discount_value:0}])expect(()=>couponDiscount(invalid,id,3590,now)).toThrow();
 });
});
