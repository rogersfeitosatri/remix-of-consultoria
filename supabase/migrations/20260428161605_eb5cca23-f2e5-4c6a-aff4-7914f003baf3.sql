ALTER TABLE public.np_periodization_checkins
  ADD COLUMN IF NOT EXISTS dynamic_form_id uuid REFERENCES public.checkin_forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dynamic_responses jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_np_checkins_dynamic_form
  ON public.np_periodization_checkins(dynamic_form_id);