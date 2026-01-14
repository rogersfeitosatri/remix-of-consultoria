-- Add new columns to payments table for financial independence
-- These columns store financial data separately from the client record

ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'pix',
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS plan_start_date date,
ADD COLUMN IF NOT EXISTS plan_end_date date;

-- Add comment to explain the new structure
COMMENT ON COLUMN public.payments.payment_method IS 'Payment method: pix, card, transfer, etc.';
COMMENT ON COLUMN public.payments.notes IS 'Optional notes about the payment';
COMMENT ON COLUMN public.payments.plan_start_date IS 'Copied from client plan start date for reference';
COMMENT ON COLUMN public.payments.plan_end_date IS 'Copied from client plan end date for expiry tracking';