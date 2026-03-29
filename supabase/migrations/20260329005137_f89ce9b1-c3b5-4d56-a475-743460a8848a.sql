
ALTER TABLE public.whatsapp_broadcasts 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT null,
ADD COLUMN IF NOT EXISTS recurrence_days integer[] DEFAULT null,
ADD COLUMN IF NOT EXISTS recurrence_time text DEFAULT null,
ADD COLUMN IF NOT EXISTS recurrence_end_date date DEFAULT null,
ADD COLUMN IF NOT EXISTS last_recurrence_at timestamptz DEFAULT null,
ADD COLUMN IF NOT EXISTS parent_broadcast_id uuid REFERENCES public.whatsapp_broadcasts(id) DEFAULT null;
