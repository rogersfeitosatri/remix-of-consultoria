ALTER TABLE public.onboarding_payment_settings
  ADD COLUMN IF NOT EXISTS anamnese_form_id uuid REFERENCES public.anamnese_forms(id) ON DELETE SET NULL;