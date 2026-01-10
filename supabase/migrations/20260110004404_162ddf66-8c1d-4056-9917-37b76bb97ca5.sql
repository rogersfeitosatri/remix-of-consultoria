-- Remove overloaded signature that causes ambiguous function resolution
DROP FUNCTION IF EXISTS public.create_public_booking_appointment(text, date, text);

-- Ensure the remaining function signature is the text-based one
-- (kept as-is): public.create_public_booking_appointment(text, text, text)