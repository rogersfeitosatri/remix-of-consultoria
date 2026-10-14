import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { storeDb } from '@/lib/storeApi';
import { storeCurrency, type StoreCoupon, type StoreProduct } from '@/lib/storeTypes';

type Form = { id?: string; code: string; type: 'percent' | 'fixed'; value: string; product: string; expires: string; active: boolean };
function localDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}
function formFor(c?: StoreCoupon): Form {
  return { id:c?.id, code:c?.code ?? '', type:c?.discount_type ?? 'percent', value:c ? String(c.discount_type === 'fixed' ? (c.discount_value / 100).toFixed(2) : c.discount_value) : '', product:c?.product_id ?? '', expires:localDate(c?.expires_at ?? null), active:c?.active ?? true };
}
export function StoreCoupons({ products }: { products: StoreProduct[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const coupons = useQuery({ queryKey:['store','admin','coupons'], queryFn:async () => {
    const { data, error } = await storeDb.from('store_coupons').select('*').is('deleted_at',null).order('created_at',{ascending:false});
    if (error) throw error; return data;
  }});
  function edit(c?: StoreCoupon) { setError(''); setForm(formFor(c)); }
  function field<K extends keyof Form>(key: K, value: Form[K]) { setForm(f => f ? { ...f, [key]:value } : null); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!form || busy) return; setBusy(true); setError('');
    try {
      const code = form.code.trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) throw new Error('Use de 3 a 32 letras sem acentos, números, hífen ou sublinhado.');
      const value = Number(form.value.replace(',','.'));
      if (!Number.isFinite(value) || (form.type === 'percent' ? !Number.isInteger(value) || value < 1 || value > 99 : value < 1 || value > 99999.99)) throw new Error(form.type === 'percent' ? 'Informe uma porcentagem inteira de 1 a 99.' : 'Informe um desconto entre R$ 1,00 e R$ 99.999,99.');
      const expires = form.expires ? new Date(form.expires) : null;
      if (expires && (!Number.isFinite(expires.getTime()) || (form.active && expires.getTime() <= Date.now()))) throw new Error('Escolha uma validade futura para um cupom ativo.');
      const values = { code, discount_type:form.type, discount_value:form.type === 'fixed' ? Math.round(value * 100) : value, product_id:form.product || null, expires_at:expires?.toISOString() ?? null, active:form.active, updated_at:new Date().toISOString() };
      const result = form.id ? await storeDb.from('store_coupons').update(values).eq('id',form.id).select('id').single() : await storeDb.from('store_coupons').insert(values).select('id').single();
      if (result.error) throw new Error(result.error.code === '23505' ? 'Este código já foi utilizado. Escolha outro código para o cupom.' : 'Não foi possível salvar o cupom. Tente novamente.');
      await qc.invalidateQueries({queryKey:['store','admin','coupons']}); setForm(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar o cupom.'); }
    finally { setBusy(false); }
  }
  async function remove(c: StoreCoupon) {
    if (!window.confirm(`Excluir o cupom ${c.code}? Os pedidos anteriores serão preservados.`)) return;
    setBusy(true); setError('');
    const { error } = await storeDb.from('store_coupons').update({active:false,deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',c.id).select('id').single();
    if (error) setError('Não foi possível excluir o cupom. Tente novamente.');
    else await qc.invalidateQueries({queryKey:['store','admin','coupons']});
    setBusy(false);
  }
  return <section aria-label="Cupons da loja" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-medium">Cupons de desconto</h2><p className="mt-1 text-sm text-muted-foreground">Um cupom por compra, aplicado sobre o preço vigente, inclusive promocional.</p></div><Button onClick={() => edit()} disabled={busy}><Plus className="mr-2 h-4 w-4" />Criar cupom</Button></div>
    {error && !form && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {coupons.isPending ? <p>Carregando cupons…</p> : coupons.isError ? <p role="alert">Não foi possível carregar os cupons. <button className="underline" onClick={() => coupons.refetch()}>Tentar novamente</button></p> : !coupons.data?.length ? <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Crie seu primeiro cupom e compartilhe o código com os compradores.</p> : <div className="divide-y rounded-lg border">{coupons.data.map(c => {
      const expired = c.expires_at && Date.parse(c.expires_at) <= Date.now();
      return <div key={c.id} className="flex flex-wrap items-center gap-4 p-4"><div className="min-w-0 flex-1"><h3 className="break-all font-semibold">{c.code}</h3><p className="text-sm">{c.discount_type === 'percent' ? `${c.discount_value}%` : storeCurrency(c.discount_value)} de desconto · {!c.active ? 'Inativo' : expired ? 'Expirado' : 'Ativo'}</p><p className="mt-1 text-xs text-muted-foreground">{c.product_id ? products.find(p => p.id === c.product_id)?.title ?? 'Livro específico' : 'Todos os livros'} · {c.expires_at ? `Até ${new Date(c.expires_at).toLocaleString('pt-BR')}` : 'Sem prazo de validade'}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} aria-label={`Editar cupom ${c.code}`} onClick={() => edit(c)}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button size="icon" variant="ghost" disabled={busy} aria-label={`Excluir cupom ${c.code}`} onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button></div></div>;
    })}</div>}
    <Dialog open={!!form} onOpenChange={open => { if (!open && !busy) setForm(null); }}><DialogContent className="max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{form?.id ? 'Editar cupom' : 'Criar cupom'}</DialogTitle><DialogDescription>O desconto será calculado automaticamente na compra. O total após o cupom deve ser de pelo menos R$ 1,00.</DialogDescription></DialogHeader>
      {form && <form onSubmit={save} className="space-y-5"><fieldset disabled={busy} className="min-w-0 space-y-4">
        <div className="space-y-2"><Label htmlFor="coupon-code-admin">Código do cupom</Label><Input id="coupon-code-admin" value={form.code} onChange={e => field('code',e.target.value.toUpperCase())} maxLength={32} minLength={3} required placeholder="LEITURA10" autoComplete="off" /><p className="text-xs text-muted-foreground">Letras sem acentos, números, hífen ou sublinhado.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="coupon-type">Tipo de desconto</Label><select id="coupon-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.type} onChange={e => { field('type',e.target.value as Form['type']); field('value',''); }}><option value="percent">Porcentagem (%)</option><option value="fixed">Valor em reais (R$)</option></select></div><div className="space-y-2"><Label htmlFor="coupon-value">{form.type === 'percent' ? 'Desconto (%)' : 'Desconto (R$)'}</Label><Input id="coupon-value" type="number" inputMode="decimal" min="1" max={form.type === 'percent' ? '99' : '99999.99'} step={form.type === 'percent' ? '1' : '0.01'} value={form.value} required onChange={e => field('value',e.target.value)} /></div></div>
        <div className="space-y-2"><Label htmlFor="coupon-product">Válido para</Label><select id="coupon-product" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.product} onChange={e => field('product',e.target.value)}><option value="">Todos os livros</option>{products.map(p => <option value={p.id} key={p.id}>{p.title}</option>)}{form.product && !products.some(p=>p.id===form.product) && <option value={form.product}>Livro indisponível</option>}</select></div>
        <div className="space-y-2"><Label htmlFor="coupon-expires">Válido até (opcional)</Label><Input id="coupon-expires" type="datetime-local" value={form.expires} onChange={e => field('expires',e.target.value)} /><p className="text-xs text-muted-foreground">Horário do seu dispositivo. Vazio significa sem prazo.</p></div>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.active} onChange={e => field('active',e.target.checked)} />Cupom ativo</label>
      </fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy} className="w-full">{busy ? 'Salvando…' : 'Salvar cupom'}</Button></form>}
    </DialogContent></Dialog>
  </section>;
}
