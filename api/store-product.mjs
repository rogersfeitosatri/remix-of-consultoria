import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPublicBook, renderBookPage } from '../server/storeProductPage.mjs';

export async function GET(request) {
  const url = new URL(request.url);
  const slug = url.pathname.match(/^\/loja\/livro\/([^/]+)\/?$/)?.[1] ?? url.searchParams.get('slug') ?? '';
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  let template = '';
  try {
    template = await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8');
    const projectUrl = process.env.VITE_STORE_SUPABASE_URL;
    const key = process.env.VITE_STORE_SUPABASE_PUBLISHABLE_KEY;
    if (!projectUrl || !key) throw new Error('Store public configuration missing');
    const book = await getPublicBook(slug, { url: projectUrl, key });
    if (!book) return new Response(template, { status: 404, headers: { ...headers, 'X-Robots-Tag': 'noindex' } });
    return new Response(renderBookPage(template, book), { headers });
  } catch (error) {
    console.error('Store product preview unavailable', error instanceof Error ? error.message : 'unknown');
    return new Response(template || 'Não foi possível carregar a loja. Tente novamente.', { status: 503, headers: { ...headers, 'Retry-After': '30', 'X-Robots-Tag': 'noindex' } });
  }
}
export const HEAD = GET;

// Use Vercel's Node request/response entry point; the implementation above is
// also exercised directly by tests. Native ESM avoids TypeScript runtime imports.
export default async function handler(req, res) {
  const response = await GET(new Request(new URL(req.url, 'https://www.rogersfeitosa.com.br')));
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(req.method === 'HEAD' ? undefined : await response.text());
}
