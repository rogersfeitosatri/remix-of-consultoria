
ALTER TABLE public.zn_integration_outbox
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS endpoint text,
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS response_body jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS zn_integration_outbox_idempotency_key_uidx
  ON public.zn_integration_outbox (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS zn_integration_outbox_retry_idx
  ON public.zn_integration_outbox (status, next_attempt_at)
  WHERE status = 'pending';
