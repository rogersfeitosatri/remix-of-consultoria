-- Allow public access to scheduling_settings when fetching for public booking (by user_id)
CREATE POLICY "Public can view scheduling settings for booking" 
ON public.scheduling_settings 
FOR SELECT 
USING (true);

-- Drop the restrictive old policy that required booking_link_slug
DROP POLICY IF EXISTS "Anyone can view scheduling settings by slug" ON public.scheduling_settings;

-- Allow public to read client basic info from booking_links join
CREATE POLICY "Public can view client info for active booking links" 
ON public.clients 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM booking_links bl 
    WHERE bl.client_id = clients.id 
    AND bl.active = true
  )
);