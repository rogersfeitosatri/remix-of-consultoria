
-- 1) Trigger para desativação de template
CREATE OR REPLACE FUNCTION public.cancel_scheduled_on_template_deactivate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.whatsapp_scheduled_messages
       SET status = 'cancelled',
           error_message = COALESCE(error_message, '') || ' [auto-cancelled: template inativado]',
           updated_at = now()
     WHERE user_id = NEW.user_id
       AND template_key = NEW.template_key
       AND status = 'scheduled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_scheduled_on_template_deactivate ON public.whatsapp_templates;
CREATE TRIGGER trg_cancel_scheduled_on_template_deactivate
AFTER UPDATE OF is_active ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.cancel_scheduled_on_template_deactivate();

-- 2) Trigger para inativação/congelamento de cliente
CREATE OR REPLACE FUNCTION public.cancel_sends_on_client_inactive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  became_inactive boolean := (COALESCE(OLD.is_active, true) = true AND COALESCE(NEW.is_active, true) = false);
  became_frozen   boolean := (COALESCE(OLD.is_frozen, false) = false AND COALESCE(NEW.is_frozen, false) = true);
BEGIN
  IF became_inactive OR became_frozen THEN
    -- Cancel pending whatsapp scheduled messages
    UPDATE public.whatsapp_scheduled_messages
       SET status = 'cancelled',
           error_message = COALESCE(error_message, '') || ' [auto-cancelled: atleta inativo/congelado]',
           updated_at = now()
     WHERE client_id = NEW.id
       AND status = 'scheduled';

    -- Disable athlete check-in schedules
    UPDATE public.athlete_checkin_schedules
       SET is_active = false,
           updated_at = now()
     WHERE client_id = NEW.id
       AND is_active = true;

    -- Mark pending check-in dispatches as cancelled
    UPDATE public.checkin_dispatches
       SET status = 'cancelled',
           error_message = COALESCE(error_message, '') || ' [auto-cancelled: atleta inativo/congelado]'
     WHERE client_id = NEW.id
       AND status IN ('scheduled', 'queued', 'pending');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_sends_on_client_inactive ON public.clients;
CREATE TRIGGER trg_cancel_sends_on_client_inactive
AFTER UPDATE OF is_active, is_frozen ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.cancel_sends_on_client_inactive();
