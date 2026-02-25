
-- Add freeze/pause columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_frozen_days integer NOT NULL DEFAULT 0;
