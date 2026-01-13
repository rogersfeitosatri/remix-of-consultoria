-- Migration to fix existing payments where paid_at was set incorrectly
-- The paid_at should match the due_date (payment date registered during client creation)
-- instead of the registration date (created_at)

UPDATE public.payments
SET 
  paid_at = due_date::timestamp with time zone,
  updated_at = now()
WHERE 
  status = 'paid' 
  AND paid_at IS NOT NULL
  AND DATE(paid_at) != due_date;