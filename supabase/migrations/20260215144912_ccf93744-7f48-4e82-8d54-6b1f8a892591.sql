
-- Table to store admin layout customization settings
CREATE TABLE public.admin_layout_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  sidebar_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  brand_name text DEFAULT 'Rogers Feitosa',
  brand_subtitle text DEFAULT 'Nutrição & Treinamento',
  logo_url text DEFAULT NULL,
  avatar_url text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_layout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own layout settings"
  ON public.admin_layout_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own layout settings"
  ON public.admin_layout_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own layout settings"
  ON public.admin_layout_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_admin_layout_settings_updated_at
  BEFORE UPDATE ON public.admin_layout_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
