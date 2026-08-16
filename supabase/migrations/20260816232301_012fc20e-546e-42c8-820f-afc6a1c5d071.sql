CREATE OR REPLACE FUNCTION public.trg_log_client_lifecycle_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_archive_changed boolean := (NEW.archived_at IS DISTINCT FROM OLD.archived_at);
BEGIN
  IF coalesce(NEW.is_frozen,false) IS DISTINCT FROM coalesce(OLD.is_frozen,false) THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.id, 'client', NEW.id,
      CASE WHEN NEW.is_frozen THEN 'client_frozen' ELSE 'client_unfrozen' END,
      'db', jsonb_build_object('frozen_at', NEW.frozen_at, 'end_date', NEW.end_date));
  END IF;

  IF v_archive_changed THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.id, 'client', NEW.id,
      CASE WHEN NEW.archived_at IS NOT NULL THEN 'client_archived' ELSE 'client_unarchived' END,
      'db', jsonb_build_object('archived_at', NEW.archived_at));
  END IF;

  -- Arquivar também desativa: não duplicamos o evento de encerramento.
  IF NOT v_archive_changed
     AND coalesce(NEW.is_active,true) IS DISTINCT FROM coalesce(OLD.is_active,true) THEN
    PERFORM public.log_operational_event(
      NEW.user_id, NEW.id, 'client', NEW.id,
      CASE WHEN NEW.is_active THEN 'client_reactivated' ELSE 'client_ended' END,
      'db', jsonb_build_object('is_active', NEW.is_active, 'ended_at', NEW.ended_at));
  END IF;

  RETURN NEW;
END;
$$;
