-- Create table for Google OAuth connections (user OAuth tokens for Meet creation)
CREATE TABLE IF NOT EXISTS public.google_oauth_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.google_oauth_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin users only
CREATE POLICY "Users can view their own OAuth connection"
ON public.google_oauth_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OAuth connection"
ON public.google_oauth_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OAuth connection"
ON public.google_oauth_connections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OAuth connection"
ON public.google_oauth_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_google_oauth_connections_updated_at
BEFORE UPDATE ON public.google_oauth_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add status column to appointments for pending_meet tracking
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS meet_status TEXT DEFAULT 'pending' 
CHECK (meet_status IN ('pending', 'created', 'failed', 'not_required'));