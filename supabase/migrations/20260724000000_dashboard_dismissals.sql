-- Persiste (por usuário) os itens do dashboard marcados como "Concluído".
-- Antes ficava só em localStorage, então o item voltava em outro acesso/dispositivo
-- ou ao atualizar a página. Agora fica no banco e some permanentemente.
CREATE TABLE IF NOT EXISTS public.dashboard_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);

ALTER TABLE public.dashboard_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own dashboard dismissals"
  ON public.dashboard_dismissals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insert own dashboard dismissals"
  ON public.dashboard_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own dashboard dismissals"
  ON public.dashboard_dismissals FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_dismissals_user
  ON public.dashboard_dismissals (user_id);
