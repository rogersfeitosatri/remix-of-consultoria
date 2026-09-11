-- Categoria do link na página pública /bio.
--
-- O valor decide duas coisas na tela: a etiqueta em maiúsculas acima do título
-- e o ícone do cartão. A tradução de valor para etiqueta e ícone mora em
-- src/lib/linkBioCategories.ts; um valor nulo ou desconhecido cai no padrão,
-- que é ícone genérico e nenhuma etiqueta. Por isso a coluna é livre, sem
-- CHECK: um valor novo nunca quebra a página.

alter table public.link_bio_items
  add column if not exists category text;

comment on column public.link_bio_items.category is
  'Rótulo curto do link na página /bio. Define a etiqueta em maiúsculas e o ícone. Valores usados hoje: assessoria, ferramenta, parceria, produto, contato, conteudo. Nulo cai no ícone e no rótulo padrão.';
