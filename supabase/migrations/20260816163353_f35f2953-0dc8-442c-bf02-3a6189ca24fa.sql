ALTER VIEW public.v_client_operational_state SET (security_invoker = on);
ALTER VIEW public.v_athlete_current_target_race SET (security_invoker = on);
REVOKE EXECUTE ON FUNCTION public.is_business_day(date, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_business_days(date, integer, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_client_operational(uuid) FROM anon;