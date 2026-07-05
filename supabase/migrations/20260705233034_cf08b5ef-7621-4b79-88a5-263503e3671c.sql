
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS nutrition_support_whatsapp text;

CREATE OR REPLACE FUNCTION public.get_nutrition_support_whatsapp(_client_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.nutrition_support_whatsapp
  FROM public.clients c
  JOIN public.admin_settings s ON s.user_id = c.user_id
  WHERE c.id = _client_id
    AND (c.athlete_user_id = auth.uid() OR c.user_id = auth.uid())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_nutrition_support_whatsapp(uuid) TO authenticated;
