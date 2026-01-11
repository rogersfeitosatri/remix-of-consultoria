-- Add columns for continuation/migration mode on clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS onboarding_type text DEFAULT 'new' CHECK (onboarding_type IN ('new', 'continuation'));

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS remaining_consultations integer;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS last_consultation_at date;

-- Create admin_settings table for feature flags (if not exists)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enable_continuation_mode boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on admin_settings
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_settings
CREATE POLICY "Users can view their own settings"
ON public.admin_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.admin_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.admin_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Update trigger for admin_settings
CREATE OR REPLACE FUNCTION update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_settings_timestamp
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW EXECUTE FUNCTION update_admin_settings_updated_at();