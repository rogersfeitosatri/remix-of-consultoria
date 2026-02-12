
-- =============================================
-- A) WHATSAPP MESSAGING CENTER - NEW TABLES
-- =============================================

-- 1. Contacts (non-athlete contacts)
CREATE TABLE public.whatsapp_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT,
  phone TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contacts" ON public.whatsapp_contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_whatsapp_contacts_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Broadcast messages (the "compose" entity)
CREATE TABLE public.whatsapp_broadcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  internal_title TEXT NOT NULL,
  body TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT, -- image, document, video, audio
  send_type TEXT NOT NULL DEFAULT 'immediate', -- immediate, scheduled
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, sending, sent, partial_failed, failed, cancelled
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own broadcasts" ON public.whatsapp_broadcasts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_whatsapp_broadcasts_updated_at
  BEFORE UPDATE ON public.whatsapp_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Broadcast recipients (per-recipient tracking)
CREATE TABLE public.whatsapp_broadcast_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES public.whatsapp_broadcasts(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, sent, failed
  provider_response JSONB,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own broadcast recipients" ON public.whatsapp_broadcast_recipients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_broadcasts wb
      WHERE wb.id = broadcast_id AND wb.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whatsapp_broadcasts wb
      WHERE wb.id = broadcast_id AND wb.user_id = auth.uid()
    )
  );

CREATE INDEX idx_broadcast_recipients_broadcast ON public.whatsapp_broadcast_recipients(broadcast_id);
CREATE INDEX idx_broadcast_recipients_status ON public.whatsapp_broadcast_recipients(status);

-- =============================================
-- C) CHECKIN MULTI-FORM SCHEDULES
-- =============================================

-- 4. Athlete checkin schedules (per athlete per form)
CREATE TABLE public.athlete_checkin_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  checkin_form_id UUID NOT NULL REFERENCES public.checkin_forms(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  frequency_type TEXT NOT NULL DEFAULT 'weekly', -- weekly, biweekly, monthly, custom
  weekly_days INTEGER[] DEFAULT '{1}', -- 0=Sun, 1=Mon, ...
  send_time TIME NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',
  due_in_hours INTEGER DEFAULT 48,
  due_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, checkin_form_id)
);

ALTER TABLE public.athlete_checkin_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checkin schedules" ON public.athlete_checkin_schedules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_athlete_checkin_schedules_updated_at
  BEFORE UPDATE ON public.athlete_checkin_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Checkin dispatches (individual send records)
CREATE TABLE public.checkin_dispatches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  checkin_form_id UUID NOT NULL REFERENCES public.checkin_forms(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.athlete_checkin_schedules(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'sent', -- sent, failed
  link_checkin TEXT,
  dispatch_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  provider_response JSONB,
  error_message TEXT,
  whatsapp_log_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checkin_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checkin dispatches" ON public.checkin_dispatches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_checkin_dispatches_schedule ON public.checkin_dispatches(schedule_id);
CREATE INDEX idx_checkin_dispatches_client ON public.checkin_dispatches(client_id);
CREATE INDEX idx_checkin_dispatches_token ON public.checkin_dispatches(dispatch_token);

-- Storage bucket for broadcast attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('broadcast-media', 'broadcast-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload broadcast media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'broadcast-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Broadcast media is publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'broadcast-media');
