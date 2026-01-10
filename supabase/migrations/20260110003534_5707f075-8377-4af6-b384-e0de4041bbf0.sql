-- Drop the problematic RLS policy that causes infinite recursion
DROP POLICY IF EXISTS "Public can view client info for active booking links" ON public.clients;

-- Create a simpler policy that doesn't cause recursion
-- The booking link validation will happen in application code or RPC functions instead
-- For now, we keep the existing policies that work correctly:
-- 1. Athletes can view their own record
-- 2. Users (admins) can view their clients
-- 3. Users can insert/update/delete their clients

-- If we need public access for booking, use the RPC function (get_public_booking_context) instead