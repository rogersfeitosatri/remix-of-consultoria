-- Criar função que invoca a edge function de processamento de links
-- Esta função será chamada pelo pg_cron

CREATE OR REPLACE FUNCTION public.invoke_booking_links_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending_count integer;
BEGIN
  -- Verifica se há invites pendentes
  SELECT COUNT(*) INTO v_pending_count
  FROM public.get_pending_booking_invites();
  
  IF v_pending_count > 0 THEN
    -- Log para debug
    RAISE NOTICE 'Found % pending booking invites to process', v_pending_count;
    
    -- A edge function será chamada por um cron externo ou webhook
    -- Aqui apenas marcamos que há pendências
    UPDATE public.consultation_schedule_rules
    SET updated_at = now()
    WHERE is_enabled = true
      AND next_link_send_date IS NOT NULL
      AND next_link_send_date <= CURRENT_DATE
      AND (last_link_sent_at IS NULL OR last_link_sent_at::date < CURRENT_DATE);
  END IF;
END;
$$;

-- Atualizar o job do cron para chamar a função corretamente
SELECT cron.unschedule('send-weekly-booking-links');

SELECT cron.schedule(
  'send-weekly-booking-links',
  '0 10 * * 1', -- Segunda às 10:00 UTC = 07:00 BRT
  $$SELECT public.invoke_booking_links_processor()$$
);