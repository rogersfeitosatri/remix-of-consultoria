-- Alterar coluna payment_day de integer para date (payment_date)
ALTER TABLE public.clients DROP COLUMN IF EXISTS payment_day;
ALTER TABLE public.clients ADD COLUMN payment_date date;