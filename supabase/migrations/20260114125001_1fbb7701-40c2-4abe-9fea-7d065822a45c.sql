-- 1. Add reminder_15m_sent_at to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS reminder_15m_sent_at timestamptz;

-- 2. Create whatsapp_templates table for dynamic message templates
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_key text NOT NULL,
  template_name text NOT NULL,
  body text NOT NULL,
  is_active boolean DEFAULT true,
  default_timing text, -- e.g., '-15m', 'monday 07:00'
  variables text[], -- available variables like {nome}, {data}, {hora}, {link}
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, template_key)
);

-- Enable RLS on whatsapp_templates
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_templates
CREATE POLICY "Users can view their own templates" 
ON public.whatsapp_templates FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates" 
ON public.whatsapp_templates FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" 
ON public.whatsapp_templates FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" 
ON public.whatsapp_templates FOR DELETE 
USING (auth.uid() = user_id);

-- 3. Create whatsapp_message_logs for audit
CREATE TABLE public.whatsapp_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id),
  appointment_id uuid REFERENCES public.appointments(id),
  message_type text NOT NULL, -- booking_confirmation, reminder_15m, weekly_booking_link, etc.
  template_key text,
  to_phone text NOT NULL,
  payload_preview text, -- final message sent (truncated if needed)
  status text NOT NULL DEFAULT 'pending', -- pending, success, failed, skipped
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on whatsapp_message_logs
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_message_logs
CREATE POLICY "Users can view their own logs" 
ON public.whatsapp_message_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert logs" 
ON public.whatsapp_message_logs FOR INSERT 
WITH CHECK (true);

-- 4. Create athlete_whatsapp_settings for per-athlete overrides
CREATE TABLE public.athlete_whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  disabled_all boolean DEFAULT false,
  disabled_template_keys text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id)
);

-- Enable RLS on athlete_whatsapp_settings
ALTER TABLE public.athlete_whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies - admin can manage settings for their clients
CREATE POLICY "Users can view settings for their clients" 
ON public.athlete_whatsapp_settings FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.clients c 
  WHERE c.id = athlete_whatsapp_settings.client_id 
  AND c.user_id = auth.uid()
));

CREATE POLICY "Users can insert settings for their clients" 
ON public.athlete_whatsapp_settings FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clients c 
  WHERE c.id = athlete_whatsapp_settings.client_id 
  AND c.user_id = auth.uid()
));

CREATE POLICY "Users can update settings for their clients" 
ON public.athlete_whatsapp_settings FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.clients c 
  WHERE c.id = athlete_whatsapp_settings.client_id 
  AND c.user_id = auth.uid()
));

CREATE POLICY "Users can delete settings for their clients" 
ON public.athlete_whatsapp_settings FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.clients c 
  WHERE c.id = athlete_whatsapp_settings.client_id 
  AND c.user_id = auth.uid()
));

-- 5. Create trigger for updated_at on whatsapp_templates
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Create trigger for updated_at on athlete_whatsapp_settings
CREATE TRIGGER update_athlete_whatsapp_settings_updated_at
BEFORE UPDATE ON public.athlete_whatsapp_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Create indexes for performance
CREATE INDEX idx_whatsapp_logs_client_id ON public.whatsapp_message_logs(client_id);
CREATE INDEX idx_whatsapp_logs_appointment_id ON public.whatsapp_message_logs(appointment_id);
CREATE INDEX idx_whatsapp_logs_created_at ON public.whatsapp_message_logs(created_at DESC);
CREATE INDEX idx_whatsapp_logs_status ON public.whatsapp_message_logs(status);
CREATE INDEX idx_appointments_reminder_15m ON public.appointments(appointment_date, appointment_time) 
WHERE reminder_15m_sent_at IS NULL AND status = 'confirmed';

-- 8. Create cron job for 15-minute reminders (runs every 2 minutes)
SELECT cron.schedule(
  'send-reminder-15m',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-reminder-15m',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);