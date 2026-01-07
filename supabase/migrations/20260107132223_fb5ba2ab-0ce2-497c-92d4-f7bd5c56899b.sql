-- Create table for support materials (admin content for athletes)
CREATE TABLE public.support_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('onboarding', 'dieta', 'material_suporte')),
  title VARCHAR(255),
  content TEXT,
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('text', 'youtube_video')),
  youtube_url VARCHAR(500),
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_materials ENABLE ROW LEVEL SECURITY;

-- RLS policies for support_materials
CREATE POLICY "Admins can manage their own support materials"
ON public.support_materials
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Athletes can view active support materials from their nutritionist"
ON public.support_materials
FOR SELECT
USING (
  is_active = true AND
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.user_id = support_materials.user_id 
    AND clients.athlete_user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_support_materials_updated_at
BEFORE UPDATE ON public.support_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for diet app configuration (per admin)
CREATE TABLE public.diet_app_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  app_download_instructions TEXT,
  app_code VARCHAR(100),
  support_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.diet_app_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for diet_app_config
CREATE POLICY "Admins can manage their own diet app config"
ON public.diet_app_config
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Athletes can view diet app config from their nutritionist"
ON public.diet_app_config
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.user_id = diet_app_config.user_id 
    AND clients.athlete_user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_diet_app_config_updated_at
BEFORE UPDATE ON public.diet_app_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add multiple time blocks support to scheduling_settings
-- First, let's create a table for time blocks per day
CREATE TABLE public.scheduling_time_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settings_id UUID NOT NULL REFERENCES public.scheduling_settings(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduling_time_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own time blocks"
ON public.scheduling_time_blocks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.scheduling_settings 
    WHERE scheduling_settings.id = scheduling_time_blocks.settings_id 
    AND scheduling_settings.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view time blocks for public booking"
ON public.scheduling_time_blocks
FOR SELECT
USING (true);