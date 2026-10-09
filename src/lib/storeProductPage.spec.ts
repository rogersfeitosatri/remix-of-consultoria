import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicBook, renderBookPage } from '../../server/storeProductPage.mjs';
import handler, { GET } from '../../api/store-product.mjs';
const template = '<html lang="en"><head><title>Consultoria</title><meta name="description" content="Consultoria"><meta property="og:title" content="Consultoria"><meta property="og:image" content="https://example.com/old.jpg"><meta name="twitter:title" content="Consultoria"></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
const book = { id:'book-id',slug:'o-ciclo-da-maratona',title:'O Ciclo da Maratona',description:'Textos sobre o ciclo.',author:'Rogers Feitosa',price_cents:3590,currency:'brl',cover_url:'https://example.com/cover.png',gallery_urls:['https://example.com/page.png'] };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('public product HTML', () => {
 it('contains current title, cover, price and explicit digital format without running JavaScript', () => {
  const html=renderBookPage(template,book);
  expect(html).toContain('<html lang="pt-BR">');
  expect(html).toContain('<h1>O Ciclo da Maratona</h1>');
  expect(html).toContain('property="product:price:amount" content="35.90"');
  expect(html).toContain('https://example.com/cover.png');
  expect(html).not.toContain('old.jpg');
  expect(html.match(/property="og:title"/g)).toHaveLength(1);
  const data=JSON.parse(html.match(/application\/ld\+json">(.*?)<\/script>/s)![1]);
  expect(data.bookFormat).toBe('https://schema.org/EBook');
  expect(data.offers.price).toBe('35.90');
  expect(data.offers.priceCurrency).toBe('BRL');
  expect(html).toContain('/assets/app.js');
 });
 it('escapes injected HTML, JSON script terminators and replacement-string dollar sequences', () => {
  const hostile={...book,title:'$& <img src=x onerror=alert(1)>',description:'</script><script>alert(1)</script>',cover_url:'javascript:alert(1)'};
  const html=renderBookPage(template,hostile);
  expect(html).not.toContain('<img src=x');
  expect(html).not.toContain('<script>alert(1)');
  expect(html).not.toContain('javascript:');
  expect(html).toContain('$&amp; &lt;img');
  const data=JSON.parse(html.match(/application\/ld\+json">(.*?)<\/script>/s)![1]);
  expect(data.name).toBe(hostile.title);
 });
 it('queries only published, non-deleted books through the public API with an explicit projection', async () => {
  const mock=vi.fn().mockResolvedValue(Response.json([book]));
  expect(await getPublicBook(book.slug,{url:'https://storeproject.supabase.co',key:'public-key'},mock)).toEqual(book);
  const url=mock.mock.calls[0][0] as URL;
  expect(url.searchParams.get('status')).toBe('eq.published');
  expect(url.searchParams.get('deleted_at')).toBe('is.null');
  expect(url.searchParams.get('select')).not.toContain('current_file_id');
  expect(mock.mock.calls[0][1].headers).toEqual({apikey:'public-key'});
 });
 it('rejects invalid slugs without a backend request', async () => {
  const mock=vi.fn();expect(await getPublicBook('../admin',{url:'https://storeproject.supabase.co',key:'public-key'},mock)).toBeNull();expect(mock).not.toHaveBeenCalled();
 });
 it('does not fabricate a product on API failure', async () => {
  await expect(getPublicBook(book.slug,{url:'https://storeproject.supabase.co',key:'public-key'},vi.fn().mockResolvedValue(new Response('',{status:503})))).rejects.toThrow('Catalog HTTP 503');
 });
 it('serves equivalent HTML for visitors and Meta crawlers, resolving the path before query parameters', async () => {
  vi.stubEnv('VITE_STORE_SUPABASE_URL','https://storeproject.supabase.co');vi.stubEnv('VITE_STORE_SUPABASE_PUBLISHABLE_KEY','public-key');
  const mock=vi.fn().mockImplementation(()=>Promise.resolve(Response.json([book])));vi.stubGlobal('fetch',mock);
  const url='https://www.rogersfeitosa.com.br/loja/livro/'+book.slug+'?slug=another-book';
  const human=await GET(new Request(url));const crawler=await GET(new Request(url,{headers:{'User-Agent':'facebookexternalhit/1.1'}}));
  expect(human.status).toBe(200);expect(await human.text()).toBe(await crawler.text());
  expect(mock.mock.calls[0][0].searchParams.get('slug')).toBe('eq.'+book.slug);
 });
 it('handles native Node requests and sends no body on HEAD', async () => {
  vi.stubEnv('VITE_STORE_SUPABASE_URL','https://storeproject.supabase.co');vi.stubEnv('VITE_STORE_SUPABASE_PUBLISHABLE_KEY','public-key');
  vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>Promise.resolve(Response.json([book]))));
  const response={statusCode:0,setHeader:vi.fn(),end:vi.fn()};
  await handler({url:'/api/store-product?slug='+book.slug,method:'GET'},response);
  expect(response.statusCode).toBe(200);
  expect(response.end.mock.calls[0][0]).toContain('<h1>O Ciclo da Maratona</h1>');
  response.end.mockClear();
  await handler({url:'/api/store-product?slug='+book.slug,method:'HEAD'},response);
  expect(response.end).toHaveBeenCalledWith(undefined);
 });
 it('returns noindex and 404 for unpublished or missing books', async () => {
  vi.stubEnv('VITE_STORE_SUPABASE_URL','https://storeproject.supabase.co');vi.stubEnv('VITE_STORE_SUPABASE_PUBLISHABLE_KEY','public-key');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json([])));
  const response=await GET(new Request('https://www.rogersfeitosa.com.br/loja/livro/missing'));
  expect(response.status).toBe(404);expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
 });
});
