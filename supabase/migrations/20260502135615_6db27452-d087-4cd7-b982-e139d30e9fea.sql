-- Remove triggers duplicados (versões antigas trigger_*)
-- Mantemos apenas a versão nova com prefixo trg_*
DROP TRIGGER IF EXISTS trigger_link_appointment_to_schedule ON public.appointments;
DROP TRIGGER IF EXISTS trigger_link_appointment_to_schedule_update ON public.appointments;
DROP TRIGGER IF EXISTS trigger_sync_schedule_on_appointment_change ON public.appointments;
DROP TRIGGER IF EXISTS trigger_update_consultation_journey ON public.appointments;
DROP TRIGGER IF EXISTS trigger_sync_pipeline_on_plan_change ON public.clients;
DROP TRIGGER IF EXISTS trigger_sync_remaining_on_schedule_complete ON public.consultation_schedules;