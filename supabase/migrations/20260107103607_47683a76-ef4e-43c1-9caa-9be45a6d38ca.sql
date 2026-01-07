-- Create table for scheduled checkin sends
CREATE TABLE public.scheduled_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  form_id UUID REFERENCES public.checkin_forms(id) ON DELETE SET NULL,
  scheduled_send_date DATE NOT NULL,
  scheduled_send_time TIME DEFAULT '07:00:00',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'completed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  response_id UUID REFERENCES public.checkin_responses(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_checkins ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own scheduled checkins"
ON public.scheduled_checkins FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled checkins"
ON public.scheduled_checkins FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled checkins"
ON public.scheduled_checkins FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled checkins"
ON public.scheduled_checkins FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_checkins_updated_at
BEFORE UPDATE ON public.scheduled_checkins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient queries
CREATE INDEX idx_scheduled_checkins_client_id ON public.scheduled_checkins(client_id);
CREATE INDEX idx_scheduled_checkins_scheduled_date ON public.scheduled_checkins(scheduled_send_date);
CREATE INDEX idx_scheduled_checkins_status ON public.scheduled_checkins(status);

-- Add index on checkin_responses for efficient athlete history queries
CREATE INDEX IF NOT EXISTS idx_checkin_responses_client_id ON public.checkin_responses(client_id);
CREATE INDEX IF NOT EXISTS idx_checkin_responses_submitted_at ON public.checkin_responses(submitted_at DESC);