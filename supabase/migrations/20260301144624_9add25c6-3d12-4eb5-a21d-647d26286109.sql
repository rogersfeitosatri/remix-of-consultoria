
-- Table for scheduling links tied to strategic calls
CREATE TABLE public.call_scheduling_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  strategic_call_id UUID REFERENCES public.strategic_calls(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  timezone TEXT NOT NULL DEFAULT 'America/Fortaleza',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 10,
  min_advance_hours INTEGER NOT NULL DEFAULT 6,
  max_advance_days INTEGER NOT NULL DEFAULT 60,
  daily_limit INTEGER,
  slot_capacity INTEGER NOT NULL DEFAULT 1,
  allow_multiple_per_lead BOOLEAN NOT NULL DEFAULT false,
  require_manual_confirmation BOOLEAN NOT NULL DEFAULT false,
  -- Availability: recurring weekly slots
  weekly_availability JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Blocked dates
  blocked_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Extra open dates
  extra_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Notification templates
  confirmation_template TEXT DEFAULT 'Olá {{nome}}, sua call estratégica foi confirmada para {{data_horario}}. Em breve enviaremos o link da videochamada.',
  reminder_24h_template TEXT DEFAULT 'Lembrete: sua call estratégica é amanhã, {{data_horario}}. Nos vemos lá!',
  reminder_2h_template TEXT,
  reminder_15m_template TEXT,
  cancellation_template TEXT DEFAULT '{{nome}}, seu agendamento para {{data_horario}} foi cancelado.',
  meeting_link TEXT,
  send_reminder_24h BOOLEAN NOT NULL DEFAULT true,
  send_reminder_2h BOOLEAN NOT NULL DEFAULT false,
  send_reminder_15m BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings/reservations for call scheduling
CREATE TABLE public.call_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_link_id UUID NOT NULL REFERENCES public.call_scheduling_links(id) ON DELETE CASCADE,
  strategic_call_id UUID REFERENCES public.strategic_calls(id) ON DELETE SET NULL,
  strategic_call_response_id UUID REFERENCES public.strategic_call_responses(id) ON DELETE SET NULL,
  user_id UUID NOT NULL, -- admin/responsible
  lead_name TEXT,
  lead_email TEXT,
  lead_phone TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed, pending, cancelled, rescheduled, completed
  meeting_link TEXT,
  notes TEXT,
  reminder_24h_sent_at TIMESTAMPTZ,
  reminder_2h_sent_at TIMESTAMPTZ,
  reminder_15m_sent_at TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_call_scheduling_links_user_id ON public.call_scheduling_links(user_id);
CREATE INDEX idx_call_scheduling_links_slug ON public.call_scheduling_links(slug);
CREATE INDEX idx_call_bookings_date ON public.call_bookings(booking_date, booking_time);
CREATE INDEX idx_call_bookings_link ON public.call_bookings(scheduling_link_id);
CREATE INDEX idx_call_bookings_status ON public.call_bookings(status);

-- RLS
ALTER TABLE public.call_scheduling_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_bookings ENABLE ROW LEVEL SECURITY;

-- Admin can manage their own scheduling links
CREATE POLICY "Admin manages scheduling links"
  ON public.call_scheduling_links FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public can read active scheduling links by slug (for public booking page)
CREATE POLICY "Public reads active scheduling links"
  ON public.call_scheduling_links FOR SELECT
  TO anon
  USING (status = 'active');

-- Admin manages bookings
CREATE POLICY "Admin manages bookings"
  ON public.call_bookings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anon can insert bookings (public booking)
CREATE POLICY "Public creates bookings"
  ON public.call_bookings FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anon can read their own bookings by email (for confirmation page)
CREATE POLICY "Public reads bookings"
  ON public.call_bookings FOR SELECT
  TO anon
  USING (true);

-- Triggers
CREATE TRIGGER update_call_scheduling_links_updated_at
  BEFORE UPDATE ON public.call_scheduling_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_bookings_updated_at
  BEFORE UPDATE ON public.call_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic booking function to prevent race conditions
CREATE OR REPLACE FUNCTION public.create_call_booking(
  p_scheduling_link_id UUID,
  p_booking_date DATE,
  p_booking_time TIME,
  p_lead_name TEXT DEFAULT NULL,
  p_lead_email TEXT DEFAULT NULL,
  p_lead_phone TEXT DEFAULT NULL,
  p_strategic_call_response_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_booking_id UUID;
  v_existing_count INTEGER;
  v_daily_count INTEGER;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_conflict_count INTEGER;
BEGIN
  -- Lock the scheduling link row to prevent concurrent modifications
  SELECT * INTO v_link
  FROM public.call_scheduling_links
  WHERE id = p_scheduling_link_id AND status = 'active'
  FOR UPDATE;

  IF v_link IS NULL THEN
    RAISE EXCEPTION 'Link de agendamento não encontrado ou inativo.';
  END IF;

  -- Check slot capacity
  SELECT COUNT(*) INTO v_existing_count
  FROM public.call_bookings
  WHERE scheduling_link_id = p_scheduling_link_id
    AND booking_date = p_booking_date
    AND booking_time = p_booking_time
    AND status NOT IN ('cancelled');

  IF v_existing_count >= v_link.slot_capacity THEN
    RAISE EXCEPTION 'Horário indisponível. Outra pessoa já reservou este slot.';
  END IF;

  -- Check daily limit
  IF v_link.daily_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM public.call_bookings
    WHERE scheduling_link_id = p_scheduling_link_id
      AND booking_date = p_booking_date
      AND status NOT IN ('cancelled');

    IF v_daily_count >= v_link.daily_limit THEN
      RAISE EXCEPTION 'Limite diário de agendamentos atingido.';
    END IF;
  END IF;

  -- Check multiple bookings per lead
  IF NOT v_link.allow_multiple_per_lead AND p_lead_email IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_count
    FROM public.call_bookings
    WHERE scheduling_link_id = p_scheduling_link_id
      AND lead_email = p_lead_email
      AND status NOT IN ('cancelled');

    IF v_existing_count > 0 THEN
      RAISE EXCEPTION 'Você já possui um agendamento para esta call.';
    END IF;
  END IF;

  -- Check conflicts with existing appointments (buffer aware)
  v_slot_start := (p_booking_date || ' ' || p_booking_time)::TIMESTAMP
    - (v_link.buffer_before_minutes || ' minutes')::INTERVAL;
  v_slot_end := (p_booking_date || ' ' || p_booking_time)::TIMESTAMP
    + (v_link.slot_duration_minutes || ' minutes')::INTERVAL
    + (v_link.buffer_after_minutes || ' minutes')::INTERVAL;

  -- Check against appointments table
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.appointments a
  WHERE a.user_id = v_link.user_id
    AND a.appointment_date = p_booking_date
    AND a.status IN ('scheduled', 'confirmed')
    AND (
      (a.appointment_date || ' ' || a.appointment_time)::TIMESTAMP < v_slot_end
      AND (a.appointment_date || ' ' || a.appointment_time)::TIMESTAMP + (a.duration_minutes || ' minutes')::INTERVAL > v_slot_start
    );

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Conflito com outro agendamento existente.';
  END IF;

  -- Check against other call bookings (same responsible)
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.call_bookings cb
  JOIN public.call_scheduling_links csl ON csl.id = cb.scheduling_link_id
  WHERE csl.user_id = v_link.user_id
    AND cb.booking_date = p_booking_date
    AND cb.status NOT IN ('cancelled')
    AND cb.id IS DISTINCT FROM NULL -- exclude self
    AND (
      (cb.booking_date || ' ' || cb.booking_time)::TIMESTAMP < v_slot_end
      AND (cb.booking_date || ' ' || cb.booking_time)::TIMESTAMP + (cb.duration_minutes || ' minutes')::INTERVAL > v_slot_start
    );

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Conflito com outro agendamento de call.';
  END IF;

  -- Create booking
  INSERT INTO public.call_bookings (
    scheduling_link_id,
    strategic_call_id,
    strategic_call_response_id,
    user_id,
    lead_name,
    lead_email,
    lead_phone,
    booking_date,
    booking_time,
    duration_minutes,
    status,
    meeting_link
  ) VALUES (
    p_scheduling_link_id,
    v_link.strategic_call_id,
    p_strategic_call_response_id,
    v_link.user_id,
    p_lead_name,
    p_lead_email,
    p_lead_phone,
    p_booking_date,
    p_booking_time,
    v_link.slot_duration_minutes,
    CASE WHEN v_link.require_manual_confirmation THEN 'pending' ELSE 'confirmed' END,
    v_link.meeting_link
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- Function to get available slots for a scheduling link on a given date
CREATE OR REPLACE FUNCTION public.get_call_available_slots(
  p_scheduling_link_id UUID,
  p_date DATE
)
RETURNS TABLE(slot_time TIME, available BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_day_of_week INTEGER;
  v_slot TIME;
  v_avail JSONB;
  v_slot_start TIMESTAMP;
  v_slot_end TIMESTAMP;
  v_now TIMESTAMPTZ;
  v_min_advance INTERVAL;
  v_conflict_count INTEGER;
  v_booking_count INTEGER;
  v_daily_count INTEGER;
  v_is_blocked BOOLEAN;
  v_is_extra BOOLEAN;
  v_extra_slots JSONB;
BEGIN
  SELECT * INTO v_link FROM public.call_scheduling_links WHERE id = p_scheduling_link_id AND status = 'active';
  IF v_link IS NULL THEN RETURN; END IF;

  v_now := now() AT TIME ZONE v_link.timezone;
  v_min_advance := (v_link.min_advance_hours || ' hours')::INTERVAL;
  v_day_of_week := EXTRACT(DOW FROM p_date)::INTEGER;

  -- Check if date is blocked
  v_is_blocked := EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_link.blocked_dates) d
    WHERE d::DATE = p_date
  );

  -- Check if date has extra availability
  v_is_extra := FALSE;
  v_extra_slots := NULL;
  FOR v_avail IN SELECT * FROM jsonb_array_elements(v_link.extra_dates) LOOP
    IF (v_avail->>'date')::DATE = p_date THEN
      v_is_extra := TRUE;
      v_extra_slots := v_avail->'slots';
      EXIT;
    END IF;
  END LOOP;

  -- Check daily limit
  IF v_link.daily_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_daily_count
    FROM public.call_bookings
    WHERE scheduling_link_id = p_scheduling_link_id
      AND booking_date = p_date
      AND status NOT IN ('cancelled');
    IF v_daily_count >= v_link.daily_limit THEN RETURN; END IF;
  END IF;

  -- Generate time slots from weekly availability or extra dates
  IF v_is_extra AND v_extra_slots IS NOT NULL THEN
    -- Use extra date slots
    FOR v_avail IN SELECT * FROM jsonb_array_elements(v_extra_slots) LOOP
      v_slot := (v_avail->>'start')::TIME;
      WHILE v_slot < (v_avail->>'end')::TIME LOOP
        -- Check min advance
        IF (p_date || ' ' || v_slot)::TIMESTAMP > (v_now + v_min_advance)::TIMESTAMP THEN
          -- Check conflicts
          v_slot_start := (p_date || ' ' || v_slot)::TIMESTAMP - (v_link.buffer_before_minutes || ' minutes')::INTERVAL;
          v_slot_end := (p_date || ' ' || v_slot)::TIMESTAMP + (v_link.slot_duration_minutes || ' minutes')::INTERVAL + (v_link.buffer_after_minutes || ' minutes')::INTERVAL;

          SELECT COUNT(*) INTO v_conflict_count
          FROM public.appointments a
          WHERE a.user_id = v_link.user_id
            AND a.appointment_date = p_date
            AND a.status IN ('scheduled', 'confirmed')
            AND (a.appointment_date || ' ' || a.appointment_time)::TIMESTAMP < v_slot_end
            AND (a.appointment_date || ' ' || a.appointment_time)::TIMESTAMP + (a.duration_minutes || ' minutes')::INTERVAL > v_slot_start;

          SELECT COUNT(*) INTO v_booking_count
          FROM public.call_bookings cb
          JOIN public.call_scheduling_links csl ON csl.id = cb.scheduling_link_id
          WHERE csl.user_id = v_link.user_id
            AND cb.booking_date = p_date
            AND cb.booking_time = v_slot
            AND cb.status NOT IN ('cancelled');

          slot_time := v_slot;
          available := (v_conflict_count = 0 AND v_booking_count < v_link.slot_capacity);
          RETURN NEXT;
        END IF;
        v_slot := v_slot + (v_link.slot_duration_minutes || ' minutes')::INTERVAL;
      END LOOP;
    END LOOP;
  ELSIF NOT v_is_blocked THEN
    -- Use weekly availability
    FOR v_avail IN SELECT * FROM jsonb_array_elements(v_link.weekly_availability) LOOP
      IF (v_avail->>'day')::INTEGER = v_day_of_week THEN
        v_slot := (v_avail->>'start')::TIME;
        WHILE v_slot < (v_avail->>'end')::TIME LOOP
          IF (p_date || ' ' || v_slot)::TIMESTAMP > (v_now + v_min_advance)::TIMESTAMP THEN
            v_slot_start := (p_date || ' ' || v_slot)::TIMESTAMP - (v_link.buffer_before_minutes || ' minutes')::INTERVAL;
            v_slot_end := (p_date || ' ' || v_slot)::TIMESTAMP + (v_link.slot_duration_minutes || ' minutes')::INTERVAL + (v_link.buffer_after_minutes || ' minutes')::INTERVAL;

            SELECT COUNT(*) INTO v_conflict_count
            FROM public.appointments a
            WHERE a.user_id = v_link.user_id
              AND a.appointment_date = p_date
              AND a.status IN ('scheduled', 'confirmed')
              AND (a.appointment_date || ' ' || a.appointment_time)::TIMESTAMP < v_slot_end
              AND (a.appointment_date || ' ' || a.appointment_time)::TIMESTAMP + (a.duration_minutes || ' minutes')::INTERVAL > v_slot_start;

            SELECT COUNT(*) INTO v_booking_count
            FROM public.call_bookings cb
            JOIN public.call_scheduling_links csl ON csl.id = cb.scheduling_link_id
            WHERE csl.user_id = v_link.user_id
              AND cb.booking_date = p_date
              AND cb.booking_time = v_slot
              AND cb.status NOT IN ('cancelled');

            slot_time := v_slot;
            available := (v_conflict_count = 0 AND v_booking_count < v_link.slot_capacity);
            RETURN NEXT;
          END IF;
          v_slot := v_slot + (v_link.slot_duration_minutes || ' minutes')::INTERVAL;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
END;
$$;
