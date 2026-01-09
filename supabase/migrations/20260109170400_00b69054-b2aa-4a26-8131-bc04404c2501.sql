-- Add reminder_sent_at column to track when reminder was sent
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;