-- Create a secure function to validate email for booking access
-- This function is SECURITY DEFINER so it bypasses RLS
CREATE OR REPLACE FUNCTION public.validate_booking_email(p_token text, p_email text)
RETURNS TABLE (
  valid boolean,
  client_id uuid,
  client_name text,
  admin_user_id uuid,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx record;
  v_client record;
BEGIN
  -- Validate token first
  SELECT * INTO v_ctx
  FROM public.get_public_booking_context(p_token)
  LIMIT 1;
  
  IF v_ctx IS NULL OR v_ctx.admin_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, 'Link inválido ou expirado.'::text;
    RETURN;
  END IF;
  
  -- Get client info
  SELECT c.id, c.email, c.name, c.eligible_for_booking, c.is_active
  INTO v_client
  FROM public.clients c
  WHERE c.id = v_ctx.client_id
  LIMIT 1;
  
  IF v_client IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, 'Cliente não encontrado.'::text;
    RETURN;
  END IF;
  
  -- Check email match (case insensitive)
  IF lower(trim(v_client.email)) != lower(trim(p_email)) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, 'E-mail não autorizado. Verifique se digitou corretamente.'::text;
    RETURN;
  END IF;
  
  -- Check eligibility
  IF NOT v_client.eligible_for_booking AND NOT v_client.is_active THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, 'Acesso não autorizado. Entre em contato com o suporte.'::text;
    RETURN;
  END IF;
  
  -- Success
  RETURN QUERY SELECT true, v_ctx.client_id, v_ctx.client_name, v_ctx.admin_user_id, NULL::text;
END;
$$;