
CREATE TABLE public.zn_integration_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zn_integration_api_keys TO authenticated;
GRANT ALL ON public.zn_integration_api_keys TO service_role;

ALTER TABLE public.zn_integration_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage integration api keys"
ON public.zn_integration_api_keys
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
