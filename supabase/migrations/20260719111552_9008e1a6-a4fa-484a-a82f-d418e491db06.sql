
CREATE TABLE public.plan_substitution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutritionist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  main_food_id uuid NOT NULL,
  sub_food_id uuid NOT NULL,
  uses_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nutritionist_id, main_food_id, sub_food_id)
);

CREATE INDEX plan_substitution_history_lookup_idx
  ON public.plan_substitution_history (nutritionist_id, main_food_id, uses_count DESC, last_used_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_substitution_history TO authenticated;
GRANT ALL ON public.plan_substitution_history TO service_role;

ALTER TABLE public.plan_substitution_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutri manages own substitution history"
  ON public.plan_substitution_history
  FOR ALL
  USING (auth.uid() = nutritionist_id)
  WITH CHECK (auth.uid() = nutritionist_id);
