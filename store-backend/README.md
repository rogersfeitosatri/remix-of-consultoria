# Supabase exclusivo da loja

Este diretório contém somente o banco e a configuração da loja. A consultoria
continua usando `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Projeto configurado

A estrutura está instalada no projeto **Loja RF**, `waorkzagibttftzvwukv`,
informado pelo proprietário. Estado conferido em 9 de outubro de 2026:

- Migração, RLS e três Edge Functions da loja instaladas; testes de acesso
  aprovados. Originais em bucket privado e capas em bucket público.
- Conta administrativa `nutri.rogersfeitosa@gmail.com` criada, confirmada e
  associada a `store_admins` pelo UUID `074538fb-0006-49e9-9f74-ac5c74490a59`.
- Chave Stripe de produção autenticada: consultas a Checkout Sessions,
  Payment Intents, Charges, Products, Prices, Payment Links e Webhook Endpoints
  retornaram HTTP 200. Não houve cobrança nem teste de escrita/compra real.
- Webhook Stripe `we_1UOenlECI23X8v43LAigVcPu` ativo em produção, apontando para
  `https://waorkzagibttftzvwukv.supabase.co/functions/v1/store-stripe-webhook`,
  com os cinco eventos previstos. Secret de assinatura presente; a correspondência
  com a Stripe e a entrega real ainda precisam de validação com evento assinado.
- Cópia de **O Ciclo da Maratona** preparada como **rascunho**, pelo mesmo ID e
  slug do catálogo atual, com descrição, capa copiada e preço de **R$ 35,90**.
  PDF fornecido pelo proprietário no chat: 145 páginas, 391.811 bytes,
  SHA-256 `70dd4d539767c0d505ce20cd16d229b1fb49e1c51144f84bd5f3d86a85ca2645`.
  Conteúdo armazenado conferido por SHA-256; download público do original não
  foi habilitado. Não foi possível comparar com o original privado do projeto antigo.
- Funções temporárias `store-payment-link-setup` e `store-migration-upload`
  desativadas após uso: corpo responde 404, verificação JWT habilitada e acesso
  sem credenciais responde 401. Não contêm operações administrativas ativas.
- Variáveis `VITE_STORE_*` cadastradas apenas no preview da branch
  `feat/loja-supabase-independente`. A produção continua no Supabase antigo
  `ikjntlmpnilxyugidhoz`, cujo acesso administrativo pelo conector está indisponível.

Pendente: proprietário confirmar existência de clientes/compras antigos;
configurar **Resend SMTP** (provedor escolhido pelo proprietário), domínio de
remetente e redirects; testar cadastro e recuperação com e-mail externo;
concluir transferência de quaisquer acessos/pedidos existentes; validar checkout,
confirmação Stripe e PDF timbrado antes de concluir a troca em produção.

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
