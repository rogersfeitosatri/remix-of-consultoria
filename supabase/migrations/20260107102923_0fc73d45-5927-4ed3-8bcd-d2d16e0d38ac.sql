-- Add registration_source column to track where the client came from (manual or kiwify)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS registration_source TEXT DEFAULT 'manual';

-- Add constraint to validate values
ALTER TABLE public.clients
ADD CONSTRAINT check_registration_source 
CHECK (registration_source IN ('manual', 'kiwify'));

-- Update existing clients to be 'manual' source
UPDATE public.clients SET registration_source = 'manual' WHERE registration_source IS NULL;

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_clients_registration_source ON public.clients(registration_source);

-- Add comment explaining the field
COMMENT ON COLUMN public.clients.registration_source IS 'Origin of the client registration: manual (admin created) or kiwify (webhook automated)';