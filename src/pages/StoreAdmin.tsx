import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { StoreLayout } from '@/components/store/StoreLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getStoreConnection } from '@/integrations/supabase/storeClient';
import { storeAction, storeDb } from '@/lib/storeApi';
import { storeCurrency, storeSlug, stripeLink, type StoreProduct } from '@/lib/storeTypes';

type Form = { id: string; title: string; slug: string; description: string; author: string; price: string; coverUrl: string; paymentLink: string; published: boolean; fileId: string | null; existing: boolean };
function formFor(p?: StoreProduct): Form {
  return { id: p?.id ?? crypto.randomUUID(), title: p?.title ?? '', slug: p?.slug ?? '', description: p?.description ?? '', author: p?.author ?? 'Rogers Feitosa', price: p ? (p.price_cents / 100).toFixed(2) : '', coverUrl: p?.cover_url ?? '', paymentLink: p?.payment_link_url ?? '', published: p?.status === 'published', fileId: p?.current_file_id ?? null, existing: !!p };
}
type Integration = { provider: string; secret_key: boolean; webhook_secret: boolean; ready: boolean; mode: string; webhook_url: string };
export default function StoreAdmin() {
  const qc = useQueryClient();
  const connection = getStoreConnection();
  const { toast } = useToast();
  const [tab, setTab] = useState<'books' | 'orders' | 'payments'>('books');
  const [form, setForm] = useState<Form | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const products = useQuery({ queryKey: ['store', 'admin', 'products'], queryFn: async () => {
    const { data, error } = await storeDb.from('store_products').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw error; return data;
  }});
  const orders = useQuery({ queryKey: ['store', 'admin', 'orders'], queryFn: async () => {
    const { data, error } = await storeDb.from('store_orders').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error; return data;
  }, enabled: tab === 'orders' });
  const integration = useQuery({ queryKey: ['store', 'admin', 'integration'], queryFn: () => storeAction<Integration>('integration-status'), enabled: tab === 'payments', retry: false });
  const currentFile = useQuery({ queryKey: ['store', 'file', form?.fileId], enabled: !!form?.fileId, queryFn: async () => {
    const { data, error } = await storeDb.from('store_product_files').select('*').eq('id', form!.fileId!).single(); if (error) throw error; return data;
  }});
  function edit(product?: StoreProduct) { setForm(formFor(product)); setPdf(null); setCover(null); setError(''); }
  function field<K extends keyof Form>(key: K, value: Form[K]) { setForm(f => f ? { ...f, [key]: value } : null); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!form || busy) return; setError(''); setBusy('Salvando…');
    let working = { ...form };
    try {
      const price = Number(working.price.replace(',', '.'));
      if (!Number.isFinite(price) || price < 1 || price > 99999.99) throw new Error('Informe um preço entre R$ 1,00 e R$ 99.999,99.');
      const title = working.title.trim(); const slug = storeSlug(working.slug || title);
      if (!title || !slug) throw new Error('Informe o título e um endereço válido para o livro.');
      const paymentLink = stripeLink(working.paymentLink);
      if (working.published && !working.fileId && !pdf) throw new Error('Importe o PDF antes de publicar o livro.');
      let pdfPages = 0;
      if (pdf) {
        setBusy('Validando o PDF…');
        if (pdf.size > 25 * 1024 * 1024) throw new Error('O PDF deve ter até 25 MB.');
        if (!pdf.name.toLowerCase().endsWith('.pdf')) throw new Error('Escolha um arquivo PDF.');
        const { PDFDocument } = await import('pdf-lib');
        const doc = await PDFDocument.load(await pdf.arrayBuffer()).catch(() => { throw new Error('Não foi possível ler o PDF. Envie um arquivo válido, sem senha.'); });
        pdfPages = doc.getPageCount();
        if (pdfPages < 1 || pdfPages > 600) throw new Error('O PDF deve ter entre 1 e 600 páginas.');
      }
      if (cover && (!['image/jpeg','image/png','image/webp'].includes(cover.type) || cover.size > 5 * 1024 * 1024)) throw new Error('Use uma capa JPG, PNG ou WebP de até 5 MB.');
      const values = { title, slug, description: working.description.trim(), author: working.author.trim() || 'Rogers Feitosa', price_cents: Math.round(price * 100), payment_link_url: paymentLink, updated_at: new Date().toISOString() };
      if (!working.existing) {
        const { error } = await storeDb.from('store_products').insert({ ...values, id: working.id, status: 'draft' });
        if (error) throw error;
        working.existing = true; setForm(f => f ? { ...f, existing: true } : null);
      }
      if (cover) {
        setBusy('Enviando capa…');
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[cover.type];
        const path = `${working.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await storeDb.storage.from('store-covers').upload(path, cover, { contentType: cover.type, upsert: false });
        if (error) throw error;
        working.coverUrl = storeDb.storage.from('store-covers').getPublicUrl(path).data.publicUrl;
        setForm(f => f ? { ...f, coverUrl: working.coverUrl } : null); setCover(null);
      }
      if (pdf) {
        setBusy('Enviando PDF privado…');
        const id = crypto.randomUUID(); const path = `${working.id}/${id}.pdf`;
        const { error } = await storeDb.storage.from('store-originals').upload(path, pdf, { contentType: 'application/pdf', upsert: false });
        if (error) throw error;
        const { error: fileError } = await storeDb.from('store_product_files').insert({ id, product_id: working.id, storage_path: path, original_name: pdf.name, size_bytes: pdf.size, page_count: pdfPages });
        if (fileError) throw fileError;
        working.fileId = id; setForm(f => f ? { ...f, fileId: id } : null); setPdf(null);
      }
      setBusy('Finalizando…');
      const { error } = await storeDb.from('store_products').update({ ...values, cover_url: working.coverUrl || null, current_file_id: working.fileId, status: working.published ? 'published' : 'draft' }).eq('id', working.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['store'] }); setForm(null);
      toast({ title: working.published ? 'Livro publicado na loja' : 'Rascunho salvo' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível salvar o livro.';
      setError(message.includes('duplicate key') ? 'Esse endereço já está em uso. Escolha outro endereço para o livro.' : message);
      await qc.invalidateQueries({ queryKey: ['store', 'admin', 'products'] });
    } finally { setBusy(''); }
  }
  async function remove(product: StoreProduct) {
    if (!window.confirm(`Excluir “${product.title}” da loja? Quem já comprou continuará com acesso ao PDF.`)) return;
    setBusy(product.id);
    const { error } = await storeDb.from('store_products').update({ status: 'archived', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', product.id);
    if (error) toast({ title: 'Não foi possível excluir', description: error.message, variant: 'destructive' });
    else { await qc.invalidateQueries({ queryKey: ['store'] }); toast({ title: 'Livro retirado da loja' }); }
    setBusy('');
  }
  return <StoreLayout><div className="mx-auto max-w-6xl space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">Loja digital</h1><p className="mt-1 text-sm text-muted-foreground">Gerencie seus livros e acompanhe as compras.</p></div><div className="flex gap-3"><Button variant="outline" asChild><Link to="/loja" target="_blank">Ver loja<ExternalLink className="ml-2 h-4 w-4" /></Link></Button><Button onClick={() => edit()}><Plus className="mr-2 h-4 w-4" />Cadastrar livro</Button></div></div>
    <div className="flex gap-6 border-b" role="tablist" aria-label="Administração da loja">{([['books','Livros'],['orders','Pedidos'],['payments','Pagamentos']] as const).map(([key,label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`min-h-11 border-b-2 px-1 pb-3 text-sm ${tab === key ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground'}`}>{label}</button>)}</div>
    {tab === 'books' && <section aria-label="Livros cadastrados">{products.isPending ? <p>Carregando livros…</p> : products.isError ? <p role="alert">Não foi possível carregar. <button className="underline" onClick={() => products.refetch()}>Tentar novamente</button></p> : !products.data?.length ? <div className="rounded-xl border border-dashed py-16 text-center"><BookOpen className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h2 className="font-medium">Cadastre seu primeiro livro</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Adicione título, preço, capa e o PDF. Você decide quando ele aparece na loja.</p><Button className="mt-5" onClick={() => edit()}>Cadastrar livro</Button></div>
      : <div className="divide-y rounded-xl border">{products.data.map(product => <div key={product.id} className="flex flex-wrap items-center gap-4 p-4"><div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">{product.cover_url ? <img src={product.cover_url} alt="" className="h-full w-full object-contain" /> : <BookOpen className="h-5 w-5 text-muted-foreground" />}</div><div className="min-w-0 flex-1"><h2 className="font-medium">{product.title}</h2><p className="text-sm text-muted-foreground">{storeCurrency(product.price_cents)} · {product.status === 'published' ? 'Publicado' : 'Rascunho'}{!product.current_file_id ? ' · PDF pendente' : ''}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(product)}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button size="icon" variant="ghost" aria-label={`Excluir ${product.title}`} disabled={!!busy} onClick={() => remove(product)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}</section>}
    {tab === 'orders' && <section aria-label="Pedidos da loja"><p className="mb-4 text-sm text-muted-foreground">Últimos 200 pedidos. A liberação é feita pela confirmação de pagamento.</p>{orders.isPending ? <p>Carregando pedidos…</p> : orders.isError ? <p role="alert">Não foi possível carregar os pedidos.</p> : !orders.data?.length ? <p className="py-10 text-muted-foreground">Os pedidos aparecerão aqui após a primeira compra.</p> : <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{['Livro','Comprador','Valor','Status','Data'].map(h => <th className="p-3 font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{orders.data.map(o => <tr key={o.id} className="border-t"><td className="p-3">{o.product_title}</td><td className="p-3">{o.buyer_email}</td><td className="whitespace-nowrap p-3">{storeCurrency(o.price_cents)}</td><td className="p-3">{{ pending:'Pendente', paid:'Pago', refunded:'Reembolsado', disputed:'Contestado', cancelled:'Cancelado' }[o.status]}{o.is_live === false && ' (teste)'}</td><td className="p-3">{new Date(o.created_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table></div>}</section>}
    {tab === 'payments' && <section className="max-w-3xl space-y-5"><h2 className="text-lg font-medium">Stripe</h2><p className="text-sm text-muted-foreground">Cobranças em reais, com cartões brasileiros e internacionais. Você pode cadastrar um Payment Link da Stripe por livro ou deixar o campo vazio para gerar um checkout exclusivo para cada pedido.</p>
      {integration.isPending ? <p>Verificando configuração…</p> : integration.isError ? <p role="alert" className="text-sm">Não foi possível verificar a configuração. <button className="underline" onClick={() => integration.refetch()}>Tentar novamente</button></p> : <div className="space-y-3 rounded-lg border p-5"><p className="font-medium">{integration.data?.ready ? `Configuração disponível · ${integration.data.mode === 'live' ? 'produção' : 'modo de teste'}` : 'Configuração pendente'}</p><p className="text-sm">Chave da Stripe: {integration.data?.secret_key ? 'configurada' : 'pendente'}<br />Assinatura do webhook: {integration.data?.webhook_secret ? 'configurada' : 'pendente'}</p><Button size="sm" variant="outline" onClick={() => integration.refetch()}>Verificar novamente</Button></div>}
      <details className="rounded-lg border p-5"><summary className="cursor-pointer font-medium">Como ativar os pagamentos</summary><div className="mt-4 space-y-4 text-sm text-muted-foreground"><p>1. No painel da Stripe, obtenha a chave secreta da sua conta. No Supabase, salve-a como <code>STRIPE_SECRET_KEY</code>.</p><p>2. Crie um webhook na Stripe com este endereço:</p><p className="break-all rounded bg-muted p-3 font-mono text-xs">{integration.data?.webhook_url || connection.webhookUrl}</p><p>3. Ative os eventos <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code>, <code>checkout.session.async_payment_failed</code>, <code>charge.refunded</code> e <code>charge.dispute.created</code>.</p><p>4. Salve a chave de assinatura do webhook como <code>STRIPE_WEBHOOK_SECRET</code> nas secrets do Supabase. Use chaves de teste para testar e chaves de produção para vender.</p><div className="flex flex-wrap gap-4"><a className="underline" href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer">Abrir Stripe</a><a className="underline" href={connection.secretsUrl} target="_blank" rel="noreferrer">Abrir secrets do Supabase</a></div></div></details>
    </section>}
    <Dialog open={!!form} onOpenChange={open => { if (!open && !busy) setForm(null); }}><DialogContent className="max-h-[90svh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{form?.existing ? 'Editar livro' : 'Cadastrar livro'}</DialogTitle><DialogDescription>O PDF original fica privado. Cada comprador recebe uma cópia com seu e-mail na margem de todas as páginas.</DialogDescription></DialogHeader>
      {form && <form onSubmit={save} className="space-y-5"><div className="space-y-2"><Label htmlFor="book-title">Título</Label><Input id="book-title" value={form.title} maxLength={160} required onChange={e => field('title', e.target.value)} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="book-author">Autor</Label><Input id="book-author" value={form.author} maxLength={160} onChange={e => field('author', e.target.value)} /></div><div className="space-y-2"><Label htmlFor="book-price">Preço (R$)</Label><Input id="book-price" type="number" step="0.01" min="1" max="99999.99" value={form.price} required onChange={e => field('price', e.target.value)} /></div></div>
        <div className="space-y-2"><Label htmlFor="book-description">Descrição</Label><Textarea id="book-description" rows={4} value={form.description} maxLength={12000} onChange={e => field('description', e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="book-slug">Endereço do livro</Label><Input id="book-slug" value={form.slug} placeholder={storeSlug(form.title) || 'nome-do-livro'} onChange={e => field('slug', e.target.value)} /><p className="break-all text-xs text-muted-foreground">rogersfeitosa.com.br/loja/livro/{storeSlug(form.slug || form.title)}</p></div>
        <div className="space-y-2"><Label htmlFor="book-link">Link de pagamento Stripe (opcional)</Label><Input id="book-link" type="url" value={form.paymentLink} placeholder="https://buy.stripe.com/…" onChange={e => field('paymentLink', e.target.value)} /><p className="text-xs text-muted-foreground">Se cadastrar um link, use o mesmo preço em reais informado acima, sem descontos ou taxas extras no checkout. Sem link, a loja gera o pagamento automaticamente pelo preço cadastrado.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="book-cover">Capa</Label><Input id="book-cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setCover(e.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB.</p>{form.coverUrl && <img src={form.coverUrl} alt="Capa atual" className="h-24 rounded object-contain" />}</div><div className="space-y-2"><Label htmlFor="book-pdf">Arquivo PDF</Label><Input id="book-pdf" type="file" accept="application/pdf,.pdf" onChange={e => setPdf(e.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">Sem senha. Até 25 MB e 600 páginas.</p>{currentFile.data && <p className="break-all text-xs text-muted-foreground">Atual: {currentFile.data.original_name} ({currentFile.data.page_count} páginas)</p>}</div></div>
        <label className="flex items-start gap-3 rounded-lg border p-4"><input type="checkbox" className="mt-1 h-4 w-4" checked={form.published} onChange={e => field('published', e.target.checked)} /><span className="text-sm"><span className="font-medium">Publicar na loja</span><br /><span className="text-muted-foreground">Desmarque para manter como rascunho.</span></span></label>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={!!busy} onClick={() => setForm(null)}>Cancelar</Button><Button type="submit" disabled={!!busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy || 'Salvar livro'}</Button></div>
      </form>}
    </DialogContent></Dialog>
  </div></StoreLayout>;
}
