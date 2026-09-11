-- Reescrita do conteúdo dos links da /bio junto com o design "Grafite".
--
-- Os títulos estavam em CAIXA ALTA e dois traziam espaço sobrando no fim; as
-- descrições tinham quatro linhas e eram cortadas com reticências. O design
-- novo pede título em caixa normal e descrição de uma linha.
--
-- Isto é conteúdo de produção, endereçado por id. Num banco novo, montado a
-- partir desta pasta, as linhas não existem e todos os comandos abaixo são
-- no-op — o que importa para o schema é a migração anterior, que cria a coluna.

update public.link_bio_items set
  title = 'Zona Nutri',
  description = 'Plano que acompanha o treino, com suporte 24h',
  category = 'assessoria'
where id = 'e1a9f4a1-1be5-4a34-adf2-f8a542ddddcb';

update public.link_bio_items set
  title = 'Estratégia do Longão',
  description = 'Carboidrato, sódio e cafeína da sessão',
  category = 'ferramenta'
where id = '3062f367-d708-4e36-8332-2406708ea334';

update public.link_bio_items set
  title = 'Cupom Pace It',
  description = 'NUTRIROGERSFEITOSA nos hidrogéis',
  category = 'parceria'
where id = '49e4ab5c-ee2a-4c0c-838a-890ca49d7e2c';

-- Links desligados: só a categoria, para já saírem certos se forem religados.
update public.link_bio_items set category = 'produto'    where id = '8a0cc61b-f6bd-48a8-b6ad-1643283b8318';
update public.link_bio_items set category = 'assessoria' where id = 'a668f133-4eff-40f0-855b-8a3d061c6823';
update public.link_bio_items set category = 'contato'    where id = 'c04d144f-99df-4a10-a8be-ea35eff3f8e3';
update public.link_bio_items set category = 'conteudo'   where id = '599c2015-9f64-4c72-91f8-0226aa432d28';
