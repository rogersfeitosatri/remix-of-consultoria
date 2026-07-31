CREATE INDEX IF NOT EXISTS idx_ai_analyses_client_updated
  ON public.ai_analyses (client_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_analyses_dedup_backup (
  LIKE public.ai_analyses INCLUDING DEFAULTS
);

GRANT ALL ON public.ai_analyses_dedup_backup TO service_role;
ALTER TABLE public.ai_analyses_dedup_backup ENABLE ROW LEVEL SECURITY;

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

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_analyses_client
  ON public.ai_analyses (client_id);