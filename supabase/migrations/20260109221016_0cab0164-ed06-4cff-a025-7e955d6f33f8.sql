-- Add buffer_minutes to scheduling_settings for interval between appointments
ALTER TABLE public.scheduling_settings 
ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.scheduling_settings.buffer_minutes IS 'Buffer time in minutes between appointments. Slot step = slot_duration_minutes + buffer_minutes';

-- Add eligible_for_booking to clients for public booking validation
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS eligible_for_booking boolean NOT NULL DEFAULT false;

-- Set existing active clients as eligible (optional, you can adjust later)
UPDATE public.clients SET eligible_for_booking = true WHERE is_active = true;