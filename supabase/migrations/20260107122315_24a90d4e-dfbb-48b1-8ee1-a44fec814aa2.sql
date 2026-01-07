-- Create scheduling settings table for admin
CREATE TABLE public.scheduling_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  working_days jsonb NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb, -- 0=Sunday, 1=Monday, etc.
  working_hours_start time NOT NULL DEFAULT '08:00:00',
  working_hours_end time NOT NULL DEFAULT '18:00:00',
  slot_duration_minutes integer NOT NULL DEFAULT 60,
  booking_link_slug text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create blocked dates/times table
CREATE TABLE public.scheduling_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  block_type text NOT NULL DEFAULT 'full_day', -- 'full_day', 'time_range'
  block_date date NOT NULL,
  start_time time, -- null for full day blocks
  end_time time, -- null for full day blocks
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create appointments table for confirmed bookings
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL, -- the admin/consultant
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  consultation_schedule_id uuid REFERENCES public.consultation_schedules(id) ON DELETE SET NULL,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'confirmed', -- 'pending', 'confirmed', 'cancelled', 'completed'
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add scheduled_time column to consultation_schedules to store actual booked time
ALTER TABLE public.consultation_schedules 
ADD COLUMN scheduled_time time,
ADD COLUMN booking_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN booking_expires_at timestamp with time zone;

-- Enable RLS
ALTER TABLE public.scheduling_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduling_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheduling_settings
CREATE POLICY "Users can view their own scheduling settings" 
ON public.scheduling_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduling settings" 
ON public.scheduling_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduling settings" 
ON public.scheduling_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduling settings" 
ON public.scheduling_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Public policy for booking page (read-only by slug)
CREATE POLICY "Anyone can view scheduling settings by slug" 
ON public.scheduling_settings 
FOR SELECT 
USING (booking_link_slug IS NOT NULL);

-- RLS policies for scheduling_blocks
CREATE POLICY "Users can view their own scheduling blocks" 
ON public.scheduling_blocks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduling blocks" 
ON public.scheduling_blocks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduling blocks" 
ON public.scheduling_blocks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduling blocks" 
ON public.scheduling_blocks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Public policy for booking page
CREATE POLICY "Anyone can view scheduling blocks by user" 
ON public.scheduling_blocks 
FOR SELECT 
USING (true);

-- RLS policies for appointments
CREATE POLICY "Users can view their own appointments" 
ON public.appointments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments" 
ON public.appointments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments" 
ON public.appointments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Athletes can view their own appointments
CREATE POLICY "Athletes can view their own appointments" 
ON public.appointments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.clients 
  WHERE clients.id = appointments.client_id 
  AND clients.athlete_user_id = auth.uid()
));

-- Anyone can insert appointments (for public booking)
CREATE POLICY "Anyone can insert appointments for booking" 
ON public.appointments 
FOR INSERT 
WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_scheduling_settings_updated_at
BEFORE UPDATE ON public.scheduling_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();