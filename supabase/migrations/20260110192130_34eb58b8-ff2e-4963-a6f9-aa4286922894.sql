-- Add has_zona_nutri_access column to clients table
ALTER TABLE public.clients 
ADD COLUMN has_zona_nutri_access boolean DEFAULT false;