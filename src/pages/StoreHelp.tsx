import { Link } from 'react-router-dom';
import { StoreLayout } from '@/components/store/StoreLayout';
export default function StoreHelp() {
  return <StoreLayout><section className="store-help"><h1>Seus livros, sem complicação.</h1>
    <h2>Como recebo meu livro?</h2><p>Crie sua conta na loja, escolha o livro e conclua o pagamento na Stripe. Após a confirmação, o botão Baixar livro aparece em <Link to="/loja/pedidos">Meus pedidos</Link>. Os livros são digitais, em PDF.</p>
    <h2>Posso acessar novamente?</h2><p>Sim. Entre com o mesmo e-mail usado na compra e acesse Meus pedidos para baixar seu livro novamente.</p>
    <h2>Por que o PDF tem meu e-mail?</h2><p>O arquivo é preparado para uso pessoal. Seu e-mail é colocado em uma margem própria em cada página, preservando o texto e a apresentação do livro.</p>
    <h2>Paguei e o download ainda não apareceu.</h2><p>A confirmação pode levar alguns instantes. Em Meus pedidos, escolha Atualizar pagamentos. Se precisar de ajuda, entre em contato pelos canais de atendimento no <Link to="/bio">site do Rogers Feitosa</Link>, informando o e-mail e o título da compra.</p>
    <h2>Esqueci minha senha.</h2><p>Na página <Link to="/loja/entrar">Entrar</Link>, escolha Esqueci minha senha para receber um link de recuperação.</p>
  </section></StoreLayout>;
}
