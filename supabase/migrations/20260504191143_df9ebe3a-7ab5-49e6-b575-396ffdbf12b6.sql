
-- 1. Fix task_gamification unique constraint
ALTER TABLE public.task_gamification
  ADD CONSTRAINT task_gamification_user_id_key UNIQUE (user_id);

-- 2. Reminder columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_minutes_before integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS reminder_method text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_reminder_method_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_reminder_method_check CHECK (reminder_method IN ('app','whatsapp','both'));

-- 3. In-app notifications
CREATE TABLE IF NOT EXISTS public.task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own notifications" ON public.task_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.task_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own notifications" ON public.task_notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "insert own notifications" ON public.task_notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_unread ON public.task_notifications(user_id, is_read, created_at DESC);

-- 4. Recreate on_task_completed with SECURITY DEFINER + search_path
CREATE OR REPLACE FUNCTION public.on_task_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Fortaleza')::date;
  v_g RECORD;
  v_new_xp int;
  v_new_streak int;
  v_next_date date;
BEGIN
  IF NEW.status = 'done' AND COALESCE(OLD.status::text,'') <> 'done' THEN
    INSERT INTO public.task_gamification(user_id) VALUES (NEW.user_id)
      ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_g FROM public.task_gamification WHERE user_id = NEW.user_id FOR UPDATE;

    v_new_xp := v_g.total_xp + COALESCE(NEW.xp_reward, 10);

    IF v_g.last_completed_date IS NULL THEN
      v_new_streak := 1;
    ELSIF v_g.last_completed_date = v_today THEN
      v_new_streak := v_g.current_streak;
    ELSIF v_g.last_completed_date = v_today - 1 THEN
      v_new_streak := v_g.current_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;

    UPDATE public.task_gamification
    SET total_xp = v_new_xp,
        level = public.calc_task_level(v_new_xp),
        current_streak = v_new_streak,
        longest_streak = GREATEST(v_g.longest_streak, v_new_streak),
        last_completed_date = v_today,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    IF NEW.recurrence_type IS NOT NULL AND NEW.recurrence_type <> 'none' THEN
      v_next_date := public.next_recurrence_date(
        COALESCE(NEW.due_date, v_today),
        NEW.recurrence_type,
        NEW.recurrence_interval,
        NEW.recurrence_days,
        NEW.recurrence_day_of_month
      );
      IF v_next_date IS NOT NULL
         AND (NEW.recurrence_end_date IS NULL OR v_next_date <= NEW.recurrence_end_date) THEN
        INSERT INTO public.tasks(
          user_id, title, description, day_of_week, due_date, due_time,
          client_id, task_type, status, priority, source,
          recurrence_type, recurrence_days, recurrence_day_of_month,
          recurrence_interval, recurrence_end_date,
          parent_task_id, xp_reward,
          reminder_enabled, reminder_minutes_before, reminder_method
        ) VALUES (
          NEW.user_id, NEW.title, NEW.description,
          EXTRACT(DOW FROM v_next_date)::int, v_next_date, NEW.due_time,
          NEW.client_id, NEW.task_type, 'pending', NEW.priority, 'manual',
          NEW.recurrence_type, NEW.recurrence_days, NEW.recurrence_day_of_month,
          NEW.recurrence_interval, NEW.recurrence_end_date,
          COALESCE(NEW.parent_task_id, NEW.id), NEW.xp_reward,
          NEW.reminder_enabled, NEW.reminder_minutes_before, NEW.reminder_method
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
