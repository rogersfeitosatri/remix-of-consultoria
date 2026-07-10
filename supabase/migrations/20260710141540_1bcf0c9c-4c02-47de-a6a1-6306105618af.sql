
CREATE TABLE public.zn_integration_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  source_system TEXT,
  status_code INT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  duration_ms INT,
  request_payload JSONB,
  response_payload JSONB,
  athlete_id UUID,
  subscription_id UUID
);

GRANT SELECT ON public.zn_integration_api_logs TO authenticated;
GRANT ALL ON public.zn_integration_api_logs TO service_role;

ALTER TABLE public.zn_integration_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read integration api logs"
ON public.zn_integration_api_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_zn_integration_api_logs_created_at ON public.zn_integration_api_logs (created_at DESC);
CREATE INDEX idx_zn_integration_api_logs_endpoint ON public.zn_integration_api_logs (endpoint);
