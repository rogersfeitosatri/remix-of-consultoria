import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { handleStoreDownload } from '../../supabase/functions/store-download/handler';
import type { StoreDeps } from '../../supabase/functions/_shared/storeHttp';

const ORDER = '12345678-1234-4234-8234-123456789abc';
const FILE = '22345678-1234-4234-8234-123456789abc';
const USER = '32345678-1234-4234-8234-123456789abc';
function query(result: unknown) {
  const q: any = { then: (resolve: any) => Promise.resolve(result).then(resolve) };
  for (const method of ['select','eq','gte','insert']) q[method] = vi.fn(() => q);
  q.single = q.maybeSingle = vi.fn(async () => result);
  return q;
}
async function fixture(finalStatus = 'paid', initialStatus = 'paid') {
  const pdf = await PDFDocument.create();
  pdf.addPage([400,600]).drawText('Book page one');
  pdf.addPage([400,600]).drawText('Book page two');
  const original = await pdf.save();
  const bucket = {
    download: vi.fn(async () => ({ data: new Blob([original]), error:null })),
    upload: vi.fn(async () => ({ error:null })),
    createSignedUrl: vi.fn(async () => ({ data:{ signedUrl:'https://store.test/storage/v1/object/sign/store-deliveries/copy.pdf?token=fixture' }, error:null })),
  };
  let orderReads = 0;
  const db = {
    auth: { getUser: vi.fn(async () => ({ data:{ user:{ id:USER,email:'buyer@example.com',email_confirmed_at:'2026-01-01' } },error:null })) },
    from: vi.fn((table: string) => table === 'store_orders'
      ? query({ data:++orderReads === 1 ? { id:ORDER,file_id:FILE,buyer_email:'buyer@example.com',status:initialStatus } : { status:finalStatus },error:null })
      : table === 'store_product_files' ? query({ data:{ storage_path:'original.pdf' },error:null }) : query({ count:0,error:null })),
    storage:{ from:vi.fn(() => bucket) },
  };
  const deps = { db:()=>db,now:()=>new Date('2026-11-10T12:00:00Z'),env:()=>undefined,fetch } as unknown as StoreDeps;
  const request = (delivery?: string) => new Request('https://store.test/download',{ method:'POST',headers:{ authorization:'Bearer fixture' },body:JSON.stringify({ order_id:ORDER,delivery,email:'forged@example.com' }) });
  return { db,bucket,deps,request };
}
describe('HTTPS delivery for mobile browsers', () => {
  it('signs only a personalised private copy for 120 seconds after checking ownership twice', async () => {
    const { db,bucket,deps,request } = await fixture();
    const response = await handleStoreDownload(request('link'),deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ download_url:expect.stringContaining('https://'),expires_at:'2026-11-10T12:02:00.000Z' });
    expect(db.storage.from).toHaveBeenCalledWith('store-deliveries');
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(`${ORDER}/${FILE}.pdf`,120,{ download:'livro-12345678.pdf' });
    const bytes = bucket.upload.mock.calls[0][1] as Uint8Array;
    const marked = await PDFDocument.load(bytes);
    expect(marked.getPageCount()).toBe(2);
    const label = Buffer.from('Uso pessoal: buyer@example.com').toString('hex').toUpperCase();
    const streams = marked.context.enumerateIndirectObjects().map(([,o])=>o).filter(o=>o instanceof PDFRawStream).map(o=>Buffer.from(decodePDFRawStream(o as PDFRawStream).decode()).toString('latin1'));
    expect(streams.filter(s=>s.includes(label))).toHaveLength(2);
    const orderQueries = db.from.mock.results.filter((_,i)=>db.from.mock.calls[i][0]==='store_orders');
    expect(orderQueries).toHaveLength(2);
    for (const q of orderQueries) expect(q.value.eq).toHaveBeenCalledWith('user_id',USER);
  });
  it.each(['pending','refunded','disputed'])('does not issue a link for %s orders', async status => {
    const { bucket,deps,request } = await fixture(status,status);
    expect((await handleStoreDownload(request('link'),deps)).status).toBe(403);
    expect(bucket.upload).not.toHaveBeenCalled();
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });
  it('does not sign when a refund arrives during preparation', async () => {
    const { bucket,deps,request } = await fixture('refunded');
    expect((await handleStoreDownload(request('link'),deps)).status).toBe(403);
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });
  it('does not fall back to the original when storage upload fails', async () => {
    const { bucket,deps,request } = await fixture();
    bucket.upload.mockResolvedValueOnce({ error:new Error('storage unavailable') } as any);
    expect((await handleStoreDownload(request('link'),deps)).status).toBe(503);
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });
  it('keeps binary delivery working for already-open store pages', async () => {
    const { bucket,deps,request } = await fixture();
    const response = await handleStoreDownload(request(),deps);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect((await PDFDocument.load(await response.arrayBuffer())).getPageCount()).toBe(2);
    expect(bucket.upload).not.toHaveBeenCalled();
    expect(bucket.createSignedUrl).not.toHaveBeenCalled();
  });
});
