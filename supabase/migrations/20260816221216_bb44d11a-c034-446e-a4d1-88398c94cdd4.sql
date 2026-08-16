-- ETAPA 6A — infraestrutura de segurança: segredo interno, rate limit e log de segurança.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS private.internal_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.internal_secrets FROM PUBLIC;
REVOKE ALL ON private.internal_secrets FROM anon, authenticated;

INSERT INTO private.internal_secrets(name, value)
VALUES ('cron_secret',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_internal_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.internal_secrets s
    WHERE s.name = 'cron_secret' AND s.value = p_secret
  );
$$;
REVOKE ALL ON FUNCTION public.verify_internal_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_internal_secret(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_internal_secret(text) TO service_role;

-- Rate limit básico para endpoints públicos
CREATE TABLE IF NOT EXISTS public.public_rate_limits (
  bucket text NOT NULL,
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, key, window_start)
);
ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_rate_limits FROM anon, authenticated;
GRANT ALL ON public.public_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.hit_rate_limit(
  p_bucket text, p_key text, p_max integer, p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_count integer;
BEGIN
  v_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  INSERT INTO public.public_rate_limits(bucket, key, window_start, count)
  VALUES (p_bucket, p_key, v_start, 1)
  ON CONFLICT (bucket, key, window_start)
  DO UPDATE SET count = public.public_rate_limits.count + 1
  RETURNING count INTO v_count;

  DELETE FROM public.public_rate_limits WHERE window_start < now() - interval '1 day';
  RETURN v_count <= p_max;
END;
$$;
REVOKE ALL ON FUNCTION public.hit_rate_limit(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hit_rate_limit(text, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, text, integer, integer) TO service_role;

-- Log de eventos de segurança (usa operational_events, sem guardar segredos)
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_function_name text,
  p_client_id uuid DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT c.user_id INTO v_user_id FROM public.clients c WHERE c.id = p_client_id;
  IF v_user_id IS NULL THEN
    SELECT ur.user_id INTO v_user_id FROM public.user_roles ur
    WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
  END IF;
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.operational_events(user_id, client_id, entity_type, entity_id,
    event_type, actor_user_id, source, metadata)
  VALUES (v_user_id, p_client_id, 'security', p_entity_id, p_event_type, NULL, 'edge',
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('function', p_function_name));
END;
$$;
REVOKE ALL ON FUNCTION public.log_security_event(text, text, uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_security_event(text, text, uuid, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, uuid, uuid, jsonb) TO service_role;