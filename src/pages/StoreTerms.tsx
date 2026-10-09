import { Link } from 'react-router-dom';
import { StoreLayout } from '@/components/store/StoreLayout';

const CONTACT = 'nutri.rogersfeitosa@gmail.com';

export default function StoreTerms() {
  return (
    <StoreLayout>
      <article className="store-help">
        <Link className="store-back" to="/loja">← Voltar à loja</Link>
        <h1>Termos e privacidade da loja</h1>
        <p>Atualizado em <time dateTime="2026-10-08">8 de outubro de 2026</time>.</p>
        <p>
          Estas condições se aplicam à compra de livros e publicações digitais na loja Rogers
          Feitosa, de responsabilidade de <strong>Rogers Leandro Feitosa</strong>. Para atendimento,
          solicitações sobre compras ou dados pessoais, escreva para{' '}
          <a className="break-all" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <section aria-labelledby="store-terms-purchase">
          <h2 id="store-terms-purchase">1. Produtos, preços e pagamento</h2>
          <div className="space-y-3">
            <p>
              Os livros desta loja são digitais, em PDF. Confira o título, a descrição e o preço
              antes de comprar. Os valores são apresentados em reais (BRL), e a compra é avulsa.
              Nenhum exemplar físico será enviado.
            </p>
            <p>
              O pagamento é processado pela Stripe, conforme as opções disponíveis no checkout.
              Para cartões emitidos no exterior, a aprovação, a conversão da moeda e eventuais
              encargos do cartão dependem do emissor. O acesso ao livro é liberado após a
              confirmação do pagamento.
            </p>
          </div>
        </section>

        <section aria-labelledby="store-terms-access">
          <h2 id="store-terms-access">2. Conta e acesso aos livros</h2>
          <div className="space-y-3">
            <p>
              O cadastro é gratuito. Use um e-mail válido, confirme sua conta e mantenha sua senha
              em segurança. As compras ficam vinculadas à conta utilizada ao iniciar o pedido.
            </p>
            <p>
              Após o pagamento ser confirmado, o download fica disponível em{' '}
              <Link to="/loja/pedidos">Meus pedidos</Link>. Cada cópia recebe o e-mail registrado
              na compra em uma margem adicional de todas as páginas, sem sobrepor o conteúdo do
              livro. Essa identificação permite associar a cópia ao comprador.
            </p>
            <p>
              Você pode baixar novamente a versão adquirida pela mesma conta. A retirada de um
              título da vitrine não cancela o acesso de quem já comprou. Se houver dificuldade de
              acesso ou falha no arquivo, consulte <Link to="/loja/ajuda">Atendimento e acesso</Link>{' '}
              ou escreva para o e-mail de atendimento, informando o título e o e-mail da compra.
            </p>
          </div>
        </section>

        <section aria-labelledby="store-terms-use">
          <h2 id="store-terms-use">3. Uso pessoal e direitos autorais</h2>
          <div className="space-y-3">
            <p>
              A compra concede uma licença de uso pessoal do livro. Você pode lê-lo em seus
              dispositivos e manter uma cópia para uso próprio. A compra não transfere os direitos
              autorais: revenda, distribuição, publicação do arquivo e compartilhamento público
              dependem de autorização do titular, respeitadas as exceções previstas em lei.
            </p>
            <p>
              As publicações têm finalidade educativa e informativa. A compra de um livro não
              inclui consulta, diagnóstico ou plano alimentar individualizado. Orientações sobre
              saúde e alimentação devem considerar suas necessidades e o acompanhamento de um
              profissional habilitado.
            </p>
          </div>
        </section>

        <section aria-labelledby="store-terms-refunds">
          <h2 id="store-terms-refunds">4. Cancelamento e reembolso</h2>
          <div className="space-y-3">
            <p>
              Nas compras online, você pode exercer o direito de arrependimento em até 7 dias,
              contados da contratação ou do recebimento do produto, conforme aplicável e nos
              termos do Código de Defesa do Consumidor. O download do arquivo, por si só, não
              afasta os direitos previstos em lei.
            </p>
            <p>
              Para solicitar o cancelamento ou relatar cobrança indevida, envie um e-mail para{' '}
              <a className="break-all" href={`mailto:${CONTACT}`}>{CONTACT}</a>, com o e-mail usado
              na compra e o título ou identificador do pedido. Você receberá as orientações para
              tratar a solicitação. Quando devido, o reembolso é solicitado pelo meio de
              pagamento original; o prazo de visualização do crédito depende da instituição
              financeira.
            </p>
            <p>
              Pagamentos reembolsados ou contestados têm o download bloqueado. Se identificar um
              bloqueio incorreto, entre em contato para revisão. Problemas no produto ou na entrega
              continuam sujeitos às garantias legais, inclusive após o prazo de arrependimento.
            </p>
          </div>
        </section>

        <section aria-labelledby="store-terms-data">
          <h2 id="store-terms-data">5. Dados pessoais e finalidades</h2>
          <div className="space-y-3">
            <p>
              Tratamos as informações da conta, como nome e e-mail, os dados dos pedidos, valores,
              situação do pagamento, identificadores da transação e registros de download. Esses
              dados são usados para autenticar seu acesso, processar a compra, disponibilizar e
              personalizar o PDF, prestar atendimento e proteger o serviço contra fraude e uso
              indevido.
            </p>
            <p>
              O e-mail incluído no PDF ficará visível a quem receber esse arquivo. Mantenha sua
              cópia em segurança. Os dados completos do cartão e o código de segurança são
              informados à Stripe no ambiente de pagamento e não são armazenados no banco de
              dados da loja.
            </p>
            <p>
              O tratamento considera as bases legais aplicáveis da LGPD, como a execução do
              contrato e de procedimentos relacionados à compra, o cumprimento de obrigações
              legais, o exercício regular de direitos e, quando cabível, o legítimo interesse na
              segurança e prevenção de fraude, observados os direitos do titular.
            </p>
          </div>
        </section>

        <section aria-labelledby="store-terms-providers">
          <h2 id="store-terms-providers">6. Fornecedores e armazenamento</h2>
          <div className="space-y-3">
            <p>
              Utilizamos fornecedores de infraestrutura e pagamento, incluindo Supabase para
              autenticação e armazenamento, Vercel para hospedagem e Stripe para processar
              pagamentos. Esses serviços podem tratar dados técnicos de acesso e operar fora do
              Brasil, observadas as regras e salvaguardas aplicáveis à proteção de dados.
            </p>
            <p>
              Consulte também as políticas de privacidade da{' '}
              <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase</a>,{' '}
              da <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">Vercel</a>{' '}
              e da <a href="https://stripe.com/br/privacy" target="_blank" rel="noreferrer">Stripe</a>.
            </p>
            <p>
              A loja utiliza armazenamento local do navegador para manter sua sessão. Serviços
              de autenticação, infraestrutura e pagamento também podem utilizar tecnologias
              necessárias ao funcionamento e à segurança. Apagar os dados do navegador pode
              exigir um novo login.
            </p>
            <p>
              Conservamos os dados pelo período necessário para disponibilizar o acesso,
              atender solicitações e cumprir obrigações legais e o exercício regular de
              direitos. Algumas informações de compras podem precisar ser mantidas mesmo após
              uma solicitação de exclusão de conta, quando houver fundamento legal.
            </p>
          </div>
        </section>

        <section aria-labelledby="store-terms-rights">
          <h2 id="store-terms-rights">7. Seus direitos e atendimento</h2>
          <div className="space-y-3">
            <p>
              Nos termos da LGPD, você pode solicitar confirmação do tratamento, acesso e
              correção dos dados, informações sobre compartilhamento, portabilidade quando
              aplicável, e anonimização, bloqueio ou eliminação nas hipóteses legais. Também
              pode apresentar oposição ao tratamento irregular e revogar consentimentos quando
              essa for a base utilizada.
            </p>
            <p>
              Encaminhe sua solicitação para{' '}
              <a className="break-all" href={`mailto:${CONTACT}`}>{CONTACT}</a>. Podemos precisar
              confirmar sua identidade para proteger sua conta. No atendimento, explicaremos
              os efeitos de uma exclusão sobre o acesso aos livros e a eventual manutenção de
              registros exigida por lei.
            </p>
            <p>
              Alterações deste documento serão identificadas pela data de atualização.
              Permanecem assegurados os direitos do consumidor e do titular de dados previstos
              na legislação aplicável.
            </p>
          </div>
        </section>
      </article>
    </StoreLayout>
  );
}
