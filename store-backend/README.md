# Supabase exclusivo da loja

Este diretório contém somente o banco e a configuração da loja. A consultoria
continua usando `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Projeto configurado

Em 9 de outubro de 2026, a estrutura foi instalada no projeto **Loja RF**,
`waorkzagibttftzvwukv`, informado pelo proprietário. O projeto estava vazio,
sem usuários, buckets, tabelas públicas ou funções antes da instalação.

- Migração aplicada; três Edge Functions publicadas e ativas.
- Teste transacional `store_access.sql` aprovado no Supabase real.
- Advisor de segurança sem alertas. O de desempenho informa apenas
  [índices ainda sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index),
  esperado no banco novo; índices de consultas e FKs foram mantidos.
- HTTP real: catálogo anônimo permitido; pedidos privados e funções sem usuário
  válido negados. Cadastro por e-mail está habilitado com confirmação obrigatória.
- Webhook responde 503 por configuração Stripe incompleta; vendas ainda não estão
  prontas. Endpoint: `https://waorkzagibttftzvwukv.supabase.co/functions/v1/store-stripe-webhook`.
- Variáveis `VITE_STORE_*` cadastradas apenas no preview da branch
  `feat/loja-supabase-independente` na Vercel. Produção continua no projeto anterior.

Pendente: criação/validação da conta administrativa indicada pelo proprietário,
permissão em `store_admins`, SMTP e redirects, secrets Stripe, validação do fluxo
completo e confirmação de eventual conteúdo/compras a transferir. O acesso ao
projeto anterior segue indisponível pela conexão Supabase.

## Antes da troca em produção

1. Criar um projeto novo e confirmar seu ID com o proprietário. Não aplicar estas
   migrações ao banco da consultoria nem a outro projeto existente.
2. Conferir se houve cadastro de livros, arquivos ou compras no projeto anterior.
   Se houver, preparar a transferência de dados e acessos antes da troca.
3. Aplicar `supabase/migrations` **deste diretório**, usando o ID explícito do
   projeto novo. Não executar as migrações da raiz do repositório nesse projeto.
4. Executar `supabase/tests/store_access.sql` no novo projeto e revisar os advisors.
   O teste usa uma transação e desfaz seus dados ao terminar.
5. Publicar apenas `store-api`, `store-download` e `store-stripe-webhook` no novo
   projeto. Os links em `supabase/functions` apontam para os fontes compartilhados
   do repositório. Não republicar essas versões no projeto anterior: elas usam
   a tabela independente `store_admins`.

Os handlers de API e download validam o Bearer token com `auth.getUser(token)` e
exigem e-mail confirmado. `verify_jwt = false` desativa apenas o verificador
legado do gateway, compatibilizando projetos com assinatura assimétrica. O
webhook verifica a assinatura Stripe sobre o corpo original da requisição.

## Cadastro, e-mail e administrador

No painel Authentication do projeto novo:

- Habilitar cadastro por e-mail/senha, confirmação de e-mail e senha mínima de
  oito caracteres. Manter cadastro anônimo desativado.
- Site URL: `https://www.rogersfeitosa.com.br/loja/entrar`.
- Permitir os redirects de confirmação e recuperação nas duas origens canônicas:
  `https://www.rogersfeitosa.com.br/loja/entrar` e
  `https://rogersfeitosa.com.br/loja/entrar`, incluindo seus parâmetros (`?**`).
  Não liberar redirects genéricos para domínios de terceiros.
- Configurar SMTP próprio e validar a confirmação de conta e recuperação de
  senha com um endereço externo à equipe. O SMTP padrão do Supabase é restrito
  e não atende ao cadastro público em produção.

O proprietário deve cadastrar e confirmar sua conta da loja. Após confirmar
com ele a identidade e o UUID dessa conta, um operador confiável insere esse UUID
em `public.store_admins`. Não há promoção automática pelo primeiro cadastro,
por e-mail informado no formulário ou por `user_metadata`. Clientes só podem
consultar a própria associação; nunca criá-la ou alterá-la.

Administração: `/loja/admin`. O atalho antigo `/admin/loja` redireciona para essa
rota. O login da consultoria não concede acesso administrativo à loja.

## Stripe e publicação

1. Salvar `STRIPE_SECRET_KEY` (produção, `sk_live_…`) nas Edge Function Secrets
   **do projeto novo**. Não colocar chaves secretas na Vercel ou em variáveis VITE.
2. Criar o destino de eventos de produção na Stripe:
   `https://NOVO_ID.supabase.co/functions/v1/store-stripe-webhook`.
3. Selecionar `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `charge.refunded` e
   `charge.dispute.created`.
4. Salvar a chave de assinatura desse destino como `STRIPE_WEBHOOK_SECRET`
   no projeto novo.
5. Configurar na Vercel `VITE_STORE_SUPABASE_URL` e
   `VITE_STORE_SUPABASE_PUBLISHABLE_KEY`, sem alterar as variáveis da consultoria.
   A chave publicável (`sb_publishable_…`) pertence ao frontend. Nunca usar
   `service_role` ou `sb_secret_…` ali.
6. Publicar somente depois de validar banco, arquivos, administrador, e-mails,
   Stripe e qualquer transferência necessária. O painel Pagamentos mostra o
   webhook calculado a partir do projeto configurado.
7. Verificar em produção cadastro/entrada, criação de pedido, confirmação assinada
   de pagamento e download do PDF com o e-mail em todas as páginas. O retorno do
   checkout no navegador, sozinho, não libera arquivos. Uma compra real de
   validação deve ser feita conscientemente pelo proprietário.

Sem a nova configuração, as rotas da loja mostram uma página de preparação e
nunca recorrem ao banco da consultoria. Não mesclar/publicar essa troca enquanto
o projeto novo estiver pendente. Depois de receber vendas, uma reversão precisa
preservar os pedidos e acessos criados no novo banco.

## Validação local realizada

- TypeScript, build Vite e suíte Vitest (incluindo configuração isolada e
  autorização das funções).
- Deno check das três funções.
- PostgreSQL 17 em contêiner sem rede: migração completa e teste transacional
  com contratos mínimos de Auth/Storage. Isso valida SQL e RLS, mas não substitui
  o teste no Supabase real e seus advisors.
- Navegador com APIs simuladas: catálogo, cadastro, administração, upload,
  pagamento pendente/pago/reembolsado, download, login separado, saída sem afetar
  a consultoria e recuperação de senha isolada.

O banco Supabase real e seus advisors já foram verificados. Envio de e-mails,
integração Stripe e o fluxo de compra completo continuam pendentes de configuração
e validação com o proprietário.
