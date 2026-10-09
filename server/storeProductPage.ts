const SITE = 'https://www.rogersfeitosa.com.br';
export type PublicBook = {
  id: string; slug: string; title: string; description: string; author: string;
  price_cents: number; currency: string; cover_url: string | null; gallery_urls?: string[];
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const publicImage = (value: string | null | undefined) => {
  try { const url = new URL(value ?? ''); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
};

export function renderBookPage(template: string, book: PublicBook) {
  const canonical = `${SITE}/loja/livro/${encodeURIComponent(book.slug)}`;
  const title = `${book.title} — Livro digital | Loja RF`;
  const description = `Livro digital em PDF de ${book.author}. ${book.description.replace(/\s+/g, ' ').trim()}`.slice(0, 300);
  const images = [...new Set([book.cover_url, ...(book.gallery_urls ?? [])].map(publicImage).filter((url): url is string => !!url))];
  const price = (book.price_cents / 100).toFixed(2);
  const currency = book.currency.toUpperCase();
  const metadata = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:type" content="product">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:site_name" content="Loja RF">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="product:price:amount" content="${price}">`,
    `<meta property="product:price:currency" content="${escapeHtml(currency)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    ...images.map(image => `<meta property="og:image" content="${escapeHtml(image)}">`),
    ...(images.length ? [`<meta property="og:image:alt" content="${escapeHtml(`Capa de ${book.title}`)}">`, `<meta name="twitter:image" content="${escapeHtml(images[0])}">`] : []),
  ].join('\n');
  const structured = {
    '@context': 'https://schema.org', '@type': ['Product', 'Book'], '@id': `${canonical}#livro`,
    name: book.title, description, url: canonical, sku: book.id, image: images,
    bookFormat: 'https://schema.org/EBook', inLanguage: 'pt-BR',
    author: { '@type': 'Person', name: book.author },
    offers: { '@type': 'Offer', url: canonical, price, priceCurrency: currency, availability: 'https://schema.org/InStock', seller: { '@type': 'Organization', name: 'Loja RF' } },
  };
  const jsonLd = JSON.stringify(structured).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  // This content is delivered to everyone, not just crawlers. React replaces it
  // when the app starts. Digital format remains explicit in visible and machine data.
  const initialContent = `<main style="max-width:960px;margin:48px auto;padding:24px;font-family:Arial,sans-serif;color:#171717;background:#fff"><a href="/loja">Todos os livros</a><article style="margin-top:32px">${images[0] ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(`Capa de ${book.title}`)}" width="220" style="max-width:100%;height:auto">` : ''}<p>Livro digital em PDF</p><h1>${escapeHtml(book.title)}</h1><p>${escapeHtml(book.author)}</p><p>${escapeHtml(new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(book.price_cents / 100))}</p><a href="/loja/entrar?next=${encodeURIComponent(`/loja/livro/${book.slug}`)}">Comprar livro digital</a><p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(book.description)}</p></article><p><a href="/loja/termos">Termos e privacidade</a> · <a href="/loja/ajuda">Atendimento</a></p></main>`;
  return template
    .replace(/<html\b[^>]*>/i, '<html lang="pt-BR">')
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
    .replace('</head>', () => `${metadata}\n<script type="application/ld+json">${jsonLd}</script>\n</head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${initialContent}</div>`);
}

export async function getPublicBook(slug: string, config: { url: string; key: string }, request: typeof fetch = fetch): Promise<PublicBook | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return null;
  const url = new URL('/rest/v1/store_products', config.url);
  url.search = new URLSearchParams({ select: 'id,slug,title,description,author,price_cents,currency,cover_url,gallery_urls', slug: `eq.${slug}`, status: 'eq.published', deleted_at: 'is.null', limit: '1' }).toString();
  const response = await request(url, { headers: { apikey: config.key }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const data: PublicBook[] = await response.json();
  return data[0] ?? null;
}
