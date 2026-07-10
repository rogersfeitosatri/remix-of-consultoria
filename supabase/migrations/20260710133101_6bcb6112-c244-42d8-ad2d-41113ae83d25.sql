
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_status text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS asaas_payment_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url text;

CREATE INDEX IF NOT EXISTS idx_clients_asaas_customer ON public.clients(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_clients_asaas_subscription ON public.clients(asaas_subscription_id);
