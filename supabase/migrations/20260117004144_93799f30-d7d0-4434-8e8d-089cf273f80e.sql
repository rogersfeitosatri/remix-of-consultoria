-- Add 'title' column to whatsapp_templates (editable title separate from template_name)
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Set default title values based on template_key
UPDATE public.whatsapp_templates 
SET title = CASE 
  WHEN template_key = 'reminder_15m' THEN '⏰ Lembrete de Consulta'
  WHEN template_key = 'booking_confirmed' THEN '✅ Consulta Confirmada'
  WHEN template_key = 'weekly_booking_link' THEN '📅 Agende sua Consulta'
  WHEN template_key = 'checkin_reminder' THEN '📋 Check-in Semanal'
  ELSE template_name
END
WHERE title IS NULL;

-- Create whatsapp_scheduled_messages table for scheduled messages that store template_key + context
CREATE TABLE IF NOT EXISTS public.whatsapp_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  context_data JSONB NOT NULL DEFAULT '{}',
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  scheduled_checkin_id UUID REFERENCES public.scheduled_checkins(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_user_id ON public.whatsapp_scheduled_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_status ON public.whatsapp_scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_scheduled_for ON public.whatsapp_scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_messages_template_key ON public.whatsapp_scheduled_messages(template_key);

-- Enable RLS
ALTER TABLE public.whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins can see their own scheduled messages
CREATE POLICY "Admins can view their own scheduled messages"
ON public.whatsapp_scheduled_messages
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can create scheduled messages"
ON public.whatsapp_scheduled_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update their own scheduled messages"
ON public.whatsapp_scheduled_messages
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete their own scheduled messages"
ON public.whatsapp_scheduled_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_scheduled_messages_updated_at
BEFORE UPDATE ON public.whatsapp_scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();