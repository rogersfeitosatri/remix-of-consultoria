-- Add new columns for plan duration and consultations
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS plan_duration text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS has_consultations boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS consultation_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS consultation_frequency text DEFAULT null,
ADD COLUMN IF NOT EXISTS first_consultation_date date DEFAULT null;

-- Create table for consultation schedule
CREATE TABLE IF NOT EXISTS public.consultation_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scheduled_date date NOT NULL,
  send_link_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on consultation_schedules
ALTER TABLE public.consultation_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for consultation_schedules
CREATE POLICY "Users can view their own consultation schedules"
ON public.consultation_schedules
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consultation schedules"
ON public.consultation_schedules
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consultation schedules"
ON public.consultation_schedules
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own consultation schedules"
ON public.consultation_schedules
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at on consultation_schedules
CREATE TRIGGER update_consultation_schedules_updated_at
BEFORE UPDATE ON public.consultation_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();