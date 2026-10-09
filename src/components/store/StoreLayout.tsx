import { Link, useLocation } from 'react-router-dom';
import { BookOpen, LogOut, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/store.css';

export function StoreLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  return <div className="rf-store">
    <a className="store-skip" href="#store-main">Ir para o conteúdo</a>
    <header className="store-header store-container">
      <Link className="store-brand" to="/loja" aria-label="Rogers Feitosa — loja">
        <span className="store-monogram" aria-hidden="true">RF</span><span>Rogers Feitosa</span>
      </Link>
      <nav aria-label="Navegação da loja">
        <Link className="store-home-link" to="/">Voltar ao site</Link>
        <Link to="/loja/pedidos" aria-current={pathname === '/loja/pedidos' ? 'page' : undefined}><BookOpen size={19} aria-hidden="true" /><span>Meus pedidos</span></Link>
        {user ? <button className="store-icon-button" onClick={() => signOut()} aria-label="Sair da conta" title="Sair da conta"><LogOut size={19} /></button>
          : <Link className="store-account-link" to="/loja/entrar" aria-label="Entrar na conta"><UserRound size={19} aria-hidden="true" /><span>Entrar</span></Link>}
      </nav>
    </header>
    <main id="store-main" className="store-main store-container" tabIndex={-1}>{children}</main>
    <footer className="store-footer store-container"><span>© {new Date().getFullYear()} Rogers Feitosa</span><nav aria-label="Informações da loja"><Link to="/loja/ajuda">Atendimento e acesso</Link><Link to="/termos">Termos e privacidade</Link></nav></footer>
  </div>;
}

export function StoreMessage({ title, children, error = false }: { title: string; children?: ReactNode; error?: boolean }) {
  return <div className="store-message" role={error ? 'alert' : 'status'}><h2>{title}</h2>{children && <div>{children}</div>}</div>;
}
