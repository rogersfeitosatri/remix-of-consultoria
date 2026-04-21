
-- Helper: cria dispatch ANTES do envio, retorna o id para vincular no log
CREATE OR REPLACE FUNCTION public.create_checkin_dispatch_for_send(
  p_client_id uuid,
  p_user_id uuid,
  p_link_checkin text,
  p_source text DEFAULT 'manual'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_form_id uuid;
  v_dispatch_id uuid;
BEGIN
  -- Buscar schedule ativo do atleta
  SELECT id, checkin_form_id INTO v_schedule
  FROM athlete_checkin_schedules
  WHERE client_id = p_client_id AND user_id = p_user_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  v_form_id := v_schedule.checkin_form_id;

  -- Fallback: form ativo do admin
  IF v_form_id IS NULL THEN
    SELECT id INTO v_form_id
    FROM checkin_forms
    WHERE user_id = p_user_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_form_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum formulário de check-in ativo encontrado para registrar o dispatch.';
  END IF;

  INSERT INTO checkin_dispatches (
    user_id, client_id, checkin_form_id, schedule_id,
    status, sent_at, link_checkin, error_message
  ) VALUES (
    p_user_id, p_client_id, v_form_id, v_schedule.id,
    'pending', now(), p_link_checkin, 'source:' || p_source
  )
  RETURNING id INTO v_dispatch_id;

  RETURN v_dispatch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_checkin_dispatch_for_send(uuid, uuid, text, text) TO authenticated, service_role;

-- View de auditoria: envios via Z-API sem dispatch correspondente
CREATE OR REPLACE VIEW public.checkin_send_audit
WITH (security_invoker=on) AS
SELECT
  l.id AS log_id,
  l.user_id,
  l.client_id,
  c.name AS client_name,
  l.to_phone,
  l.created_at AS sent_at,
  l.status AS log_status,
  d.id AS dispatch_id,
  CASE 
    WHEN d.id IS NULL THEN 'missing_dispatch'
    ELSE 'ok'
  END AS audit_status
FROM whatsapp_message_logs l
LEFT JOIN clients c ON c.id = l.client_id
LEFT JOIN checkin_dispatches d ON d.whatsapp_log_id = l.id
WHERE l.template_key = 'checkin_reminder'
  AND l.status = 'sent';
