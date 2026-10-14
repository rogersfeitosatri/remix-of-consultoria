import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useStoreAuth } from '@/hooks/useStoreAuth';
import { storeAction } from '@/lib/storeApi';
import { storeCurrency, storePrice, type StoreProduct, type StoreQuote } from '@/lib/storeTypes';
import { BookPrice } from './BookPrice';

export function BookPurchase({ book }: { book: StoreProduct }) {
  const { user } = useStoreAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [code,setCode] = useState(() => (params.get('cupom') ?? '').slice(0,32));
  const [quote,setQuote] = useState<StoreQuote | null>(null);
  const [busy,setBusy] = useState<'apply' | 'buy' | null>(null);
  const [error,setError] = useState('');
  function signIn() {
    const next = `/loja/livro/${book.slug}${code.trim() ? `?cupom=${encodeURIComponent(code.trim())}` : ''}`;
    navigate(`/loja/entrar?next=${encodeURIComponent(next)}`);
  }
  async function apply(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setError(''); setQuote(null);
    if (!code.trim()) { setError('Digite o código do cupom.'); return; }
    if (!user) { signIn(); return; }
    setBusy('apply');
    try { setQuote(await storeAction<StoreQuote>('quote',{product_id:book.id,coupon_code:code})); }
    catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível aplicar o cupom.'); }
    finally { setBusy(null); }
  }
  async function buy() {
    if (busy) return;
    if (!user) { signIn(); return; }
    setError('');
    if (code.trim() && !quote) { setError('Toque em Aplicar para validar o cupom ou remova o código para comprar sem ele.'); return; }
    setBusy('buy');
    try {
      const result = await storeAction<{owned?:boolean;checkout_url?:string}>('checkout',{product_id:book.id,coupon_code:quote?.coupon_code ?? null,expected_total_cents:quote?.total_cents ?? storePrice(book)});
      if (result.owned) navigate('/loja/pedidos');
      else if (result.checkout_url) window.location.assign(result.checkout_url);
      else throw new Error('Não foi possível abrir o pagamento. Tente novamente.');
    } catch(e) {
      setQuote(null); void qc.invalidateQueries({queryKey:['store','product',book.slug]});
      setError(e instanceof Error ? e.message : 'Não foi possível abrir o pagamento.');
    } finally { setBusy(null); }
  }
  return <>
    <p className="store-product-price"><BookPrice product={book} /></p>
    <form className="store-coupon" onSubmit={apply} aria-label="Aplicar cupom">
      <label htmlFor="book-coupon">Cupom de desconto</label>
      <div className="store-coupon-entry"><input id="book-coupon" value={code} maxLength={32} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Digite o código" disabled={!!busy} onChange={e => {setCode(e.target.value.toUpperCase());setQuote(null);setError('');}} /><button type="submit" className="store-coupon-apply" disabled={!!busy}>{busy === 'apply' ? 'Aplicando…' : 'Aplicar'}</button></div>
      {!!code && <button type="button" className="store-coupon-remove" disabled={!!busy} onClick={() => {setCode('');setQuote(null);setError('');}}>Remover cupom</button>}
      {!user && <p className="store-coupon-help">Entre na sua conta para aplicar o cupom.</p>}
      {quote?.coupon_code && <div className="store-coupon-summary" role="status" aria-live="polite"><p>Cupom <strong>{quote.coupon_code}</strong> aplicado</p><dl><div><dt>Preço do livro</dt><dd>{storeCurrency(quote.subtotal_cents)}</dd></div><div><dt>Desconto do cupom</dt><dd>− {storeCurrency(quote.discount_cents)}</dd></div><div className="store-coupon-total"><dt>Total</dt><dd>{storeCurrency(quote.total_cents)}</dd></div></dl></div>}
    </form>
    {error && <p className="store-error" role="alert">{error}</p>}
    <button className="store-button" disabled={!!busy} onClick={buy}>{busy === 'buy' && <Loader2 size={17} className="animate-spin" />}{busy === 'buy' ? 'Preparando pagamento…' : 'Comprar livro digital'}</button>
  </>;
}
