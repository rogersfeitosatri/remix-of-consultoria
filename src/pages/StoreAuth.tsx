import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StoreLayout } from '@/components/store/StoreLayout';
import { safeStoreNext } from '@/lib/storeTypes';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
export default function StoreAuth() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(() => params.get('reset') === '1' ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const next = safeStoreNext(params.get('next'));
  useEffect(() => {
    if (!loading && user && mode !== 'reset') navigate(next, { replace: true });
  }, [loading, user, mode, next, navigate]);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') setMode('reset'); });
    return () => subscription.unsubscribe();
  }, []);
  const changeMode = (value: Mode) => { setMode(value); setError(''); setNotice(''); setPassword(''); };
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/loja/entrar?next=${encodeURIComponent(next)}`,
        }});
        if (error) throw error;
        if (data.session) navigate(next, { replace: true });
        else setNotice('Confira seu e-mail para confirmar a conta. Depois, entre aqui para continuar. Se já tiver uma conta, use Entrar ou recupere sua senha.');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate(next, { replace: true });
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/loja/entrar?reset=1` });
        if (error) throw error;
        setNotice('Se houver uma conta com esse e-mail, você receberá o link para definir uma nova senha.');
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        navigate('/loja/pedidos', { replace: true });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(/Invalid login/i.test(message) ? 'E-mail ou senha incorretos.' : /Email not confirmed/i.test(message) ? 'Confirme seu e-mail antes de entrar.' : /rate limit|too many/i.test(message) ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' : /signup.*disabled/i.test(message) ? 'O cadastro está temporariamente indisponível. Tente novamente mais tarde.' : mode === 'reset' ? 'Não foi possível alterar a senha. Solicite um novo link de recuperação.' : 'Não foi possível continuar. Confira os dados e tente novamente.');
    } finally { setBusy(false); }
  }
  const title = { login: 'Entre na sua conta', signup: 'Crie sua conta', forgot: 'Recupere sua senha', reset: 'Defina uma nova senha' }[mode];
  return <StoreLayout><section className="store-auth"><h1>{title}</h1><p>{mode === 'signup' ? 'Cadastre-se gratuitamente para comprar e acessar seus livros.' : mode === 'login' ? 'Seus livros e pedidos, em um só lugar.' : 'Use o e-mail cadastrado na loja.'}</p>
    <form className="store-form" onSubmit={submit}>
      {mode === 'signup' && <label>Seu nome<input autoComplete="name" value={name} maxLength={120} required onChange={e => setName(e.target.value)} /></label>}
      {mode !== 'reset' && <label>E-mail<input type="email" autoComplete="email" value={email} required maxLength={254} onChange={e => setEmail(e.target.value)} /></label>}
      {mode !== 'forgot' && <label>{mode === 'reset' ? 'Nova senha' : 'Senha'}<input type="password" aria-label={mode === 'reset' ? 'Nova senha' : 'Senha'} aria-describedby={mode !== 'login' ? 'store-password-help' : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} maxLength={128} value={password} required onChange={e => setPassword(e.target.value)} />{mode !== 'login' && <small id="store-password-help">Use pelo menos 8 caracteres.</small>}</label>}
      {error && <p className="store-error" role="alert">{error}</p>}{notice && <p className="store-notice" role="status">{notice}</p>}
      <button className="store-button" disabled={busy || (mode === 'reset' && !user)}>{busy && <Loader2 size={17} className="animate-spin" />}{mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : mode === 'forgot' ? 'Enviar link de recuperação' : 'Salvar nova senha'}</button>
    </form>
    {mode === 'login' ? <><p className="store-form-switch">Ainda não tem conta?<button className="store-text-button" onClick={() => changeMode('signup')}>Criar conta</button></p><button className="store-text-button" onClick={() => changeMode('forgot')}>Esqueci minha senha</button></>
      : <p className="store-form-switch"><button className="store-text-button" onClick={() => changeMode('login')}>Voltar para entrar</button></p>}
    <p className="store-product-note">Ao criar sua conta, você concorda com os <Link className="store-text-button" to="/termos">termos de uso e privacidade</Link>.</p>
  </section></StoreLayout>;
}
