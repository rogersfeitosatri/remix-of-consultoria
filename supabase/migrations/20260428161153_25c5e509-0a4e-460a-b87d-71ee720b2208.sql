ALTER TABLE public.checkin_forms
  ADD COLUMN IF NOT EXISTS is_periodization boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_checkin_forms_is_periodization
  ON public.checkin_forms(user_id, is_periodization);

COMMENT ON COLUMN public.checkin_forms.is_periodization IS
  'Marca formulários de check-in dedicados à Preparação de Prova (NutriPeriodiza). Quando true, o link público usa /np-checkin e renderiza o bloco de métricas core (GI, energia, sono, aderência) acima das perguntas dinâmicas.';