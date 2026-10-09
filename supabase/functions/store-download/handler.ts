import { realStoreDeps, requireUuid, StoreError, storeCors, storeFailure, storeJson, storeUser, type StoreDeps } from '../_shared/storeHttp.ts';
import { personaliseStorePdf } from '../_shared/storePdf.ts';

export async function handleStoreDownload(req: Request, deps: StoreDeps = realStoreDeps()) {
  if (req.method === 'OPTIONS') return new Response('ok',{ headers:storeCors(req) });
  if (req.method !== 'POST') return storeJson(req,{ error:'Método não permitido.' },405);
  try {
    const db = deps.db(); const user = await storeUser(req,db);
    const body = await req.json().catch(() => { throw new StoreError(400,'Solicitação inválida.'); });
    const orderId = requireUuid(body.order_id);
    const { data:order,error } = await db.from('store_orders').select('id,file_id,buyer_email,status').eq('id',orderId).eq('user_id',user.id).maybeSingle();
    if (error) throw error;
    if (!order || order.status !== 'paid') throw new StoreError(403,'Este livro ainda não está liberado para a sua conta.');
    const { count,error:rateError } = await db.from('store_downloads').select('id',{ count:'exact',head:true }).eq('user_id',user.id).gte('created_at',new Date(deps.now().getTime()-60000).toISOString());
    if (rateError) throw rateError;
    if ((count??0)>=6) throw new StoreError(429,'Aguarde um minuto antes de baixar novamente.');
    const { data:file,error:fileError } = await db.from('store_product_files').select('storage_path').eq('id',order.file_id).single();
    if (fileError || !file) throw new StoreError(404,'O arquivo não está disponível. Contate o atendimento.');
    const { error:logError } = await db.from('store_downloads').insert({ order_id:order.id,user_id:user.id });
    if (logError) throw logError;
    const { data:original,error:storageError } = await db.storage.from('store-originals').download(file.storage_path);
    if (storageError || !original) throw new StoreError(503,'Não foi possível acessar o livro. Tente novamente.');
    let marked: Uint8Array;
    try { marked = await personaliseStorePdf(new Uint8Array(await original.arrayBuffer()),order.buyer_email); }
    catch { throw new StoreError(422,'Não foi possível preparar sua cópia. Contate o atendimento para revisar o PDF.'); }
    // Recheck after processing: a refund can arrive while the PDF is being built.
    const { data:current,error:currentError } = await db.from('store_orders').select('status').eq('id',order.id).eq('user_id',user.id).single();
    if (currentError || current?.status !== 'paid') throw new StoreError(403,'O download deste pedido não está mais disponível.');
    return new Response(marked as unknown as BodyInit,{ headers:{ ...storeCors(req),'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="livro-${order.id.slice(0,8)}.pdf"`,'X-Content-Type-Options':'nosniff' } });
  } catch(e) { return storeFailure(req,e); }
}
