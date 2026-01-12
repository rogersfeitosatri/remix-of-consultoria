-- Add last_consultation_index column to clients table
-- This stores which consultation number was the last one completed (1, 2, 3, etc.)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS last_consultation_index integer DEFAULT NULL;