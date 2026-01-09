-- ============================================
-- SISTEMA DE CONSULTAS COM GOOGLE CALENDAR
-- ============================================

-- 1) Adicionar novas colunas à tabela appointments existente
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS google_calendar_event_id text,
ADD COLUMN IF NOT EXISTS google_meet_link text,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Fortaleza',
ADD COLUMN IF NOT EXISTS notes_admin text,
ADD COLUMN IF NOT EXISTS created_by uuid;

-- Atualizar o campo status para incluir novos valores
-- (mantém os existentes, apenas adiciona possibilidades)

-- 2) Criar tabela booking_links
CREATE TABLE IF NOT EXISTS public.booking_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_sent_at timestamp with time zone,
  usage_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone
);

-- Índices para booking_links
CREATE INDEX IF NOT EXISTS idx_booking_links_client_id ON public.booking_links(client_id);
CREATE INDEX IF NOT EXISTS idx_booking_links_token ON public.booking_links(token);
CREATE INDEX IF NOT EXISTS idx_booking_links_active ON public.booking_links(active);

-- RLS para booking_links
ALTER TABLE public.booking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all booking links"
ON public.booking_links FOR ALL
USING (EXISTS (
  SELECT 1 FROM clients c 
  WHERE c.id = booking_links.client_id AND c.user_id = auth.uid()
));

CREATE POLICY "Athletes can view their own booking link"
ON public.booking_links FOR SELECT
USING (EXISTS (
  SELECT 1 FROM clients c 
  WHERE c.id = booking_links.client_id AND c.athlete_user_id = auth.uid()
));

CREATE POLICY "Public can view active booking links by token"
ON public.booking_links FOR SELECT
USING (active = true);

-- Trigger updated_at
CREATE TRIGGER update_booking_links_updated_at
BEFORE UPDATE ON public.booking_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Criar tabela consultation_schedule_rules
CREATE TABLE IF NOT EXISTS public.consultation_schedule_rules (
  client_id uuid NOT NULL PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  cadence_weeks integer NOT NULL DEFAULT 4 CHECK (cadence_weeks IN (4, 6)),
  next_invite_date date,
  is_enabled boolean NOT NULL DEFAULT true,
  last_appointment_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS para consultation_schedule_rules
ALTER TABLE public.consultation_schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage consultation rules for their clients"
ON public.consultation_schedule_rules FOR ALL
USING (EXISTS (
  SELECT 1 FROM clients c 
  WHERE c.id = consultation_schedule_rules.client_id AND c.user_id = auth.uid()
));

CREATE POLICY "Athletes can view their own consultation rules"
ON public.consultation_schedule_rules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM clients c 
  WHERE c.id = consultation_schedule_rules.client_id AND c.athlete_user_id = auth.uid()
));

-- Trigger updated_at
CREATE TRIGGER update_consultation_schedule_rules_updated_at
BEFORE UPDATE ON public.consultation_schedule_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Criar tabela consult_automation_settings (config global, 1 registro por admin)
CREATE TABLE IF NOT EXISTS public.consult_automation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  send_day_of_week integer NOT NULL DEFAULT 1 CHECK (send_day_of_week BETWEEN 1 AND 7),
  send_time time NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'America/Fortaleza',
  message_template_booking text DEFAULT 'Olá {nome}! Hora de agendar sua consulta. Escolha seu melhor horário aqui: {booking_link}',
  message_template_confirmation text DEFAULT 'Consulta confirmada para {data} às {hora}. Link da videochamada: {meet_link}',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS para consult_automation_settings
ALTER TABLE public.consult_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own automation settings"
ON public.consult_automation_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_consult_automation_settings_updated_at
BEFORE UPDATE ON public.consult_automation_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Criar tabela availability_rules (grade de disponibilidade)
CREATE TABLE IF NOT EXISTS public.availability_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 60 CHECK (slot_minutes IN (30, 45, 60, 90)),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_day_time UNIQUE (user_id, day_of_week, start_time)
);

-- RLS para availability_rules
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own availability"
ON public.availability_rules FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can view availability"
ON public.availability_rules FOR SELECT
USING (is_enabled = true);

-- Trigger updated_at
CREATE TRIGGER update_availability_rules_updated_at
BEFORE UPDATE ON public.availability_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Criar tabela consult_invite_logs (histórico de envios)
CREATE TABLE IF NOT EXISTS public.consult_invite_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'sent',
  message_type text NOT NULL DEFAULT 'booking_invite',
  error_message text,
  metadata jsonb
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_consult_invite_logs_client_id ON public.consult_invite_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_consult_invite_logs_sent_at ON public.consult_invite_logs(sent_at);

-- RLS para consult_invite_logs
ALTER TABLE public.consult_invite_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invite logs for their clients"
ON public.consult_invite_logs FOR ALL
USING (EXISTS (
  SELECT 1 FROM clients c 
  WHERE c.id = consult_invite_logs.client_id AND c.user_id = auth.uid()
));

-- 7) Criar tabela google_calendar_connections (conexão do admin com Google)
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  calendar_id text,
  service_account_email text,
  service_account_key_encrypted text,
  is_connected boolean NOT NULL DEFAULT false,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS para google_calendar_connections
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own Google connection"
ON public.google_calendar_connections FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_google_calendar_connections_updated_at
BEFORE UPDATE ON public.google_calendar_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Adicionar coluna has_consultations_access na tabela clients (para controlar acesso a consultas)
-- Usaremos plan_type = 'premium' como indicador, mas adicionamos um campo explícito para override
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS has_agenda_access boolean DEFAULT false;