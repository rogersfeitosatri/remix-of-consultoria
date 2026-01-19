CREATE OR REPLACE FUNCTION public.validate_booking_email_v2(p_token text, p_email text)
RETURNS TABLE(
  valid boolean,
  client_id uuid,
  client_name text,
  admin_user_id uuid,
  error_message text,
  onboarding_type text,
  anamnese_completed boolean,
  eligible_for_booking boolean,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx record;
  v_client record;
  v_profile record;
  v_anamnese_ok boolean;
BEGIN
  -- Validate token first
  SELECT * INTO v_ctx
  FROM public.get_public_booking_context(p_token)
  LIMIT 1;

  IF v_ctx IS NULL OR v_ctx.admin_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, 'Link inválido ou expirado.'::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean;
    RETURN;
  END IF;

  -- Get client info
  SELECT c.id, c.email, c.name, c.eligible_for_booking, c.is_active, c.onboarding_type
    INTO v_client
  FROM public.clients c
  WHERE c.id = v_ctx.client_id
  LIMIT 1;

  IF v_client IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, 'Cliente não encontrado.'::text, NULL::text, NULL::boolean, NULL::boolean, NULL::boolean;
    RETURN;
  END IF;

  -- Check email match (case insensitive)
  IF lower(trim(v_client.email)) != lower(trim(p_email)) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, 'E-mail não autorizado. Verifique se digitou corretamente.'::text, NULL::text, NULL::boolean, v_client.eligible_for_booking::boolean, v_client.is_active::boolean;
    RETURN;
  END IF;

  -- Check eligibility (keep same logic as v1)
  IF NOT v_client.eligible_for_booking AND NOT v_client.is_active THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::uuid, 'Acesso não autorizado. Entre em contato com o suporte.'::text, v_client.onboarding_type::text, NULL::boolean, v_client.eligible_for_booking::boolean, v_client.is_active::boolean;
    RETURN;
  END IF;

  -- Compute anamnese status (used by public booking UI to avoid RLS reads)
  SELECT ap.anamnese_completed, ap.anamnese_submitted_at
    INTO v_profile
  FROM public.athlete_profiles ap
  WHERE ap.client_id = v_ctx.client_id
  LIMIT 1;

  v_anamnese_ok := (v_profile.anamnese_completed IS TRUE) OR (v_profile.anamnese_submitted_at IS NOT NULL);

  -- Success
  RETURN QUERY
    SELECT
      true,
      v_ctx.client_id,
      v_ctx.client_name,
      v_ctx.admin_user_id,
      NULL::text,
      v_client.onboarding_type::text,
      v_anamnese_ok,
      v_client.eligible_for_booking::boolean,
      v_client.is_active::boolean;
END;
$function$;