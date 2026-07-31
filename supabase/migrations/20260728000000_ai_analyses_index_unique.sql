-- ============================================================
-- ai_analyses: performance + integridade
-- ============================================================
-- Contexto (Performance Advisor): as consultas mais lentas do sistema estavam
-- todas nesta tabela — SELECT ... WHERE client_id (média 42-48 ms, pico 700 ms).
-- Causa: NÃO existia nenhum índice em client_id, então toda leitura fazia
-- varredura sequencial. As demais 13.551 chamadas do sistema rodam em 0,09 ms.
--
-- Além disso não havia UNIQUE em client_id, mas o código assume UMA linha por
-- atleta e vários pontos usam .eq('client_id').maybeSingle(), que ERRA se
-- houver duplicata — quebrando a aba do plano alimentar daquele atleta.

-- 1) Índice que atende os dois padrões de leitura do app:
--    .eq(client_id)  e  .eq(client_id).order(updated_at desc).limit(1)
CREATE INDEX IF NOT EXISTS idx_ai_analyses_client_updated
  ON public.ai_analyses (client_id, updated_at DESC);

-- 2) Deduplicação defensiva antes do UNIQUE.
--    Mantém a linha MAIS RECENTE por client_id — que é exatamente a que o app
--    já considera hoje (order by updated_at desc limit 1). As antigas são
--    movidas para uma tabela de backup em vez de apagadas, para não haver
--    perda de dados irreversível.
CREATE TABLE IF NOT EXISTS public.ai_analyses_dedup_backup (
  LIKE public.ai_analyses INCLUDING DEFAULTS
);

INSERT INTO public.ai_analyses_dedup_backup
SELECT a.*
FROM public.ai_analyses a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (client_id) id
  FROM public.ai_analyses
  ORDER BY client_id, updated_at DESC, created_at DESC
);

DELETE FROM public.ai_analyses a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (client_id) id
  FROM public.ai_analyses
  ORDER BY client_id, updated_at DESC, created_at DESC
);

-- 3) Garante uma única análise por atleta daqui pra frente.
--    Torna seguro o .maybeSingle() e permite upsert por client_id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_analyses_client
  ON public.ai_analyses (client_id);
