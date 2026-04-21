CREATE TABLE public.checkin_dispatch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  source text NOT NULL DEFAULT 'cron',
  total_analyzed integer NOT NULL DEFAULT 0,
  total_eligible integer NOT NULL DEFAULT 0,
  total_dispatched integer NOT NULL DEFAULT 0,
  total_failed integer NOT NULL DEFAULT 0,
  total_skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  details jsonb
);

ALTER TABLE public.checkin_dispatch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view dispatch runs"
ON public.checkin_dispatch_runs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert dispatch runs"
ON public.checkin_dispatch_runs FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can update dispatch runs"
ON public.checkin_dispatch_runs FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_checkin_dispatch_runs_started_at ON public.checkin_dispatch_runs(started_at DESC);