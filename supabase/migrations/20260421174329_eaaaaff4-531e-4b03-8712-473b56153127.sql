CREATE OR REPLACE FUNCTION public.preview_consultation_pipeline(
  p_start_date date,
  p_consultation_count int,
  p_consultation_frequency text,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE(
  sequence_index int,
  scheduled_date date,
  send_link_date date,
  exceeds_end_date boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cadence_weeks int;
  v_current date;
  v_send date;
  v_i int := 1;
  v_max int;
BEGIN
  IF p_start_date IS NULL THEN
    RETURN;
  END IF;

  v_cadence_weeks := CASE
    WHEN p_consultation_frequency IN ('six_weeks', '6_weeks') THEN 6
    WHEN p_consultation_frequency IN ('monthly', '4_weeks') THEN 4
    WHEN p_consultation_frequency = 'weekly' THEN 1
    WHEN p_consultation_frequency = 'biweekly' THEN 2
    ELSE 4
  END;

  -- Limite: se count = 0 ou null, projeta até end_date (cap em 24)
  IF p_consultation_count IS NULL OR p_consultation_count = 0 THEN
    v_max := 24;
  ELSE
    v_max := p_consultation_count;
  END IF;

  v_current := p_start_date;

  WHILE v_i <= v_max LOOP
    -- Primeira consulta = start_date; subsequentes = +cadence
    IF v_i > 1 THEN
      v_current := (v_current + (v_cadence_weeks * INTERVAL '1 week'))::date;
    END IF;

    -- Para projeção ilimitada, parar ao ultrapassar end_date
    IF (p_consultation_count IS NULL OR p_consultation_count = 0)
       AND p_end_date IS NOT NULL
       AND v_current > p_end_date THEN
      EXIT;
    END IF;

    -- Send link date = segunda da semana anterior à consulta
    v_send := (v_current - ((EXTRACT(DOW FROM v_current)::int + 6) % 7 + 7) * INTERVAL '1 day')::date;

    sequence_index := v_i;
    scheduled_date := v_current;
    send_link_date := v_send;
    exceeds_end_date := (p_end_date IS NOT NULL AND v_current > p_end_date);
    RETURN NEXT;

    v_i := v_i + 1;
  END LOOP;
END;
$$;