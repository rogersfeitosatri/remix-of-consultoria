-- Criar tabela para configurações da landing page
CREATE TABLE public.landing_page_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, setting_key)
);

-- Enable RLS
ALTER TABLE public.landing_page_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage their own settings"
ON public.landing_page_settings
FOR ALL
USING (auth.uid() = user_id);

-- Política para leitura pública (landing page precisa ler sem auth)
CREATE POLICY "Anyone can read landing settings"
ON public.landing_page_settings
FOR SELECT
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_landing_page_settings_updated_at
BEFORE UPDATE ON public.landing_page_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();