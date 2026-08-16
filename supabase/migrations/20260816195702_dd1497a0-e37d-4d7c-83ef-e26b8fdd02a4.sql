ALTER TABLE public.consultation_schedules
  ADD COLUMN IF NOT EXISTS link_sent_source text,
  ADD COLUMN IF NOT EXISTS link_sent_channel text,
  ADD COLUMN IF NOT EXISTS link_sent_by uuid;

COMMENT ON COLUMN public.consultation_schedules.link_sent_source IS 'system_sent | manual_in_app | external_manual';