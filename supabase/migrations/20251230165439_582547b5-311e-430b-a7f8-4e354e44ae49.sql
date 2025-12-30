-- Add payment_type column to clients table
ALTER TABLE public.clients 
ADD COLUMN payment_type text DEFAULT 'pix';